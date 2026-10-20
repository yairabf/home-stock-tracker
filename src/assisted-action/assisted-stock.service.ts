import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { StockMutationOperation } from '../inventory/types/stock-mutation';
import { InventoryEventResponseDto } from '../inventory/dto/inventory-event-response.dto';
import { StockProjectionResponseDto } from '../inventory/dto/stock-mutation-response.dto';
import { getCanonicalProductName } from '../product/types/product-with-names';
import { UNDERSTANDING_FIELDS } from '../product/product-understanding';
import { AssistedBatchPreparation } from './assisted-batch-preparation.service';
import { AssistedActionTransactions } from './assisted-action-transactions.service';
import {
  AssistedCatalogWriter,
  type AppliedCatalogProduct,
} from './assisted-catalog-writer.service';
import { applyPreparedCatalogBatch } from './assisted-catalog-batch';
import { AssistedBatchIssues } from './assisted-batch-issues';
import { resolveAssistedStockUnit } from './assisted-stock-unit';
import {
  parseAssistedActionRequest,
  type AssistedActionRequest,
} from './assisted-action-request';
import { assistedActionRequestHash } from './assisted-action-replay';
import type {
  AssistedAppliedResult,
  AssistedIssue,
  AssistedStockReceipt,
} from './assisted-action-result';
import type { AssistedActionWireResult } from './assisted-action-response.schema';
import type { PreparedCatalogProduct } from './assisted-preparation';

type StockRequest = Exclude<
  AssistedActionRequest,
  { operation: 'grocery_add' }
>;

@Injectable()
export class AssistedStockService {
  constructor(
    private readonly preparation: AssistedBatchPreparation,
    private readonly transactions: AssistedActionTransactions,
    private readonly catalog: AssistedCatalogWriter,
    private readonly inventory: InventoryService,
  ) {}

  async apply(
    raw: unknown,
    source: 'api' | 'mcp',
  ): Promise<AssistedActionWireResult> {
    const receivedAt = new Date();
    const request = parseAssistedActionRequest(raw, receivedAt);
    if (request.operation === 'grocery_add')
      throw new BadRequestException('Expected stock_set or purchase');
    const hash = assistedActionRequestHash(request);
    const replay = await this.transactions.findReplay(request, hash);
    if (replay) return replay;
    const prepared = await this.preparation.prepare(request.items);
    if (prepared.outcome !== 'prepared')
      return { ...prepared, requestId: request.requestId };
    return this.transactions.execute(
      request,
      hash,
      (tx) =>
        this.applyWithinTransaction(
          tx,
          request,
          prepared.products,
          source,
          receivedAt,
        ),
      (result) =>
        this.inventory.afterAssistedStockCommit(
          result.receipts.map((r: { productId: string }) => r.productId),
        ),
    );
  }

  private async applyWithinTransaction(
    tx: Prisma.TransactionClient,
    request: StockRequest,
    prepared: PreparedCatalogProduct[],
    source: string,
    receivedAt: Date,
  ): Promise<AssistedAppliedResult> {
    const products = await applyPreparedCatalogBatch(
      tx,
      prepared,
      this.catalog,
    );
    const units = await this.resolveUnits(tx, request, products);
    const order = products
      .map(({ product }, index) => ({ id: product.id, index }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const results =
      request.operation === 'purchase'
        ? (
            await this.inventory.recordPurchasesWithinTransaction(
              tx,
              {
                source,
                items: order.map(({ id, index }) => ({
                  productId: id,
                  quantity: request.items[index].quantity,
                  unit: units[index],
                  purchasedAt: request.items[index].purchasedAt,
                })),
              },
              receivedAt,
            )
          ).items
        : await this.setItems(tx, request, order, units, source, receivedAt);
    const receipts = new Array<AssistedStockReceipt>(products.length);
    order.forEach(({ index }, position) => {
      const { product, catalogAction } = products[index];
      const { event, stock } = results[position];
      receipts[index] = {
        inputIndex: index,
        suppliedName: prepared[index].suppliedName,
        productId: product.id,
        canonicalName: getCanonicalProductName(product),
        catalogAction,
        unresolvedMetadata: UNDERSTANDING_FIELDS.filter(
          (field) => product[field] === null,
        ),
        inventory: {
          event: InventoryEventResponseDto.fromEntity(event),
          stock: StockProjectionResponseDto.fromEntity(stock),
        },
      };
    });
    return {
      outcome: 'applied',
      operation: request.operation,
      requestId: request.requestId,
      receipts,
    };
  }

  private async setItems(
    tx: Prisma.TransactionClient,
    request: Extract<StockRequest, { operation: 'stock_set' }>,
    order: Array<{ id: string; index: number }>,
    units: string[],
    source: string,
    receivedAt: Date,
  ) {
    const results: Awaited<
      ReturnType<InventoryService['updateStockWithinTransaction']>
    >[] = [];
    for (const { id, index } of order)
      results.push(
        await this.inventory.updateStockWithinTransaction(
          tx,
          {
            productId: id,
            operation: StockMutationOperation.set,
            quantity: request.items[index].quantity,
            unit: units[index],
            source,
          },
          receivedAt,
        ),
      );
    return results;
  }

  private async resolveUnits(
    tx: Prisma.TransactionClient,
    request: StockRequest,
    products: AppliedCatalogProduct[],
  ): Promise<string[]> {
    const projections = await tx.stockProjection.findMany({
      where: { productId: { in: products.map(({ product }) => product.id) } },
      select: { productId: true, unit: true },
    });
    const existing = new Map(projections.map((p) => [p.productId, p.unit]));
    const issues: AssistedIssue[] = [];
    const units: string[] = [];
    products.forEach(({ product }, inputIndex) => {
      const resolved = resolveAssistedStockUnit(
        request.operation,
        request.items[inputIndex].unit,
        existing.get(product.id) ?? null,
        product.typicalUnit,
      );
      if (resolved.outcome === 'resolved') units.push(resolved.unit);
      else issues.push({ inputIndex, code: resolved.code });
    });
    if (issues.length) throw new AssistedBatchIssues(issues);
    return units;
  }
}
