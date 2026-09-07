import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { InventoryEventType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { normalizeProductName } from '../product/product-name.util';
import { StockLedgerService } from './stock-ledger.service';
import { StockStateConflictException } from './stock-ledger.exception';
import { StatisticsService } from '../statistics/statistics.service';
import { OperationalLogger } from '../observability/operational-logger.service';
import { TransportSource } from '../common/transport-source';
import { InventoryEventResponseDto } from './dto/inventory-event-response.dto';
import { StockProjectionResponseDto } from './dto/stock-mutation-response.dto';
import type { StockProductConfirmationResponse } from './dto/stock-product-confirmation-response';
import {
  assertCompatibleStockProduct,
  encodeConfirmationPayload,
  stockProductConfirmationSchema,
  type StockProductConfirmationInput,
  type StockConfirmationPayload,
} from './types/stock-product-confirmation';

@Injectable()
export class StockProductConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductService,
    private readonly ledger: StockLedgerService,
    private readonly statistics: StatisticsService,
    private readonly logger: OperationalLogger,
  ) {}

  async confirm(
    raw: StockProductConfirmationInput,
  ): Promise<StockProductConfirmationResponse> {
    const parsed = stockProductConfirmationSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException('Invalid stock confirmation payload');
    const result = await this.runConfirmation(parsed.data);
    if (!result.replayed) await this.afterCommit(result.response);
    return result.response;
  }

  private async runConfirmation(input: StockProductConfirmationInput) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.confirmWithinTransaction(tx, input),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isWriteRace(error)) throw error;
        // A losing transaction is aborted; recover the winner outside it.
        const receipt = await this.prisma.stockProductConfirmation.findUnique({
          where: { operationId: input.operationId },
        });
        if (receipt) {
          const payload = { product: input.product, stock: input.stock };
          return { response: this.replay(receipt, payload), replayed: true };
        }
        if (attempt === 3) throw error;
      }
    }
  }

  private isWriteRace(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2034' || error.code === 'P2002';
    }
    // The shared product helper maps both name uniqueness and serialization races.
    return (
      error instanceof ConflictException &&
      (error.getResponse() as { code?: string }).code ===
        'PRODUCT_NAME_CONFLICT'
    );
  }

  private async confirmWithinTransaction(
    tx: Prisma.TransactionClient,
    input: StockProductConfirmationInput,
  ) {
    const { operationId, ...payload } = input;
    const receipt = await tx.stockProductConfirmation.findUnique({
      where: { operationId },
    });
    if (receipt) {
      return { response: this.replay(receipt, payload), replayed: true };
    }
    const owner = await tx.productName.findUnique({
      where: {
        normalizedName: normalizeProductName(input.product.canonicalName),
      },
      select: { productId: true },
    });
    const product = await this.products.confirmExplicitWithinTransaction(
      tx,
      input.product,
    );
    if (owner) {
      const projection = await tx.stockProjection.findUnique({
        where: { productId: product.id },
      });
      assertCompatibleStockProduct(product, projection?.unit ?? null, payload);
    }
    const response = await this.setStock(
      tx,
      input,
      product.id,
      owner ? 'reused' : 'created',
    );
    await tx.stockProductConfirmation.create({
      data: {
        operationId,
        requestVersion: 1,
        requestPayload: payload,
        responsePayload: JSON.parse(
          JSON.stringify(response),
        ) as Prisma.InputJsonObject,
      },
    });
    return { response, replayed: false };
  }

  private replay(
    receipt: {
      requestVersion: number;
      requestPayload: Prisma.JsonValue;
      responsePayload: Prisma.JsonValue;
    },
    payload: StockConfirmationPayload,
  ): StockProductConfirmationResponse {
    if (
      receipt.requestVersion !== 1 ||
      encodeConfirmationPayload(receipt.requestPayload) !==
        encodeConfirmationPayload(payload)
    ) {
      throw new ConflictException({
        code: 'STOCK_CONFIRMATION_ID_CONFLICT',
        message:
          'This operation ID already completed with another payload; do not change a confirmation retry',
      });
    }
    return receipt.responsePayload as unknown as StockProductConfirmationResponse;
  }

  private async setStock(
    tx: Prisma.TransactionClient,
    input: StockProductConfirmationInput,
    productId: string,
    productOutcome: 'created' | 'reused',
  ): Promise<StockProductConfirmationResponse> {
    const occurredAt = new Date();
    const event = await tx.inventoryEvent.create({
      data: {
        productId,
        eventType: InventoryEventType.STOCK_SET,
        ...input.stock,
        timestamp: occurredAt,
        source: TransportSource.mcp,
      },
    });
    const stock = await this.ledger.setWithinTransaction(tx, {
      productId,
      eventId: event.id,
      occurredAt,
      quantity: input.stock.quantity,
      explicitUnit: input.stock.unit,
      source: TransportSource.mcp,
      reason: 'stock_set',
    });
    if (stock.recordedEventId !== event.id) {
      throw new StockStateConflictException(
        'Stock changed after this confirmation; clarify before setting it',
      );
    }
    return {
      operationId: input.operationId,
      productId,
      productOutcome,
      event: {
        ...InventoryEventResponseDto.fromEntity(event),
        timestamp: event.timestamp.toISOString(),
      },
      stock: {
        ...StockProjectionResponseDto.fromEntity(stock),
        recordedAt: stock.recordedAt.toISOString(),
        evaluatedAt: stock.evaluatedAt.toISOString(),
      },
    };
  }

  private async afterCommit(
    response: StockProductConfirmationResponse,
  ): Promise<void> {
    try {
      await this.statistics.calculateProductStatistics(response.productId);
    } catch {
      this.logger.inventoryAction({
        action: 'recalculate_statistics',
        outcome: 'failure',
        productId: response.productId,
        errorType: 'persistence_error',
      });
    }
    this.logger.inventoryAction({
      action: 'update_stock',
      outcome: 'success',
      productId: response.productId,
      inventoryEventId: response.event.id,
    });
  }
}
