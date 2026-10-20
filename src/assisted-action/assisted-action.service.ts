import { BadRequestException, Injectable } from '@nestjs/common';
import { PurchaseTimestampException } from '../inventory/types/purchase-contract';
import { assistedActionRequestSchema } from './assisted-action-request';
import { AssistedGroceryService } from './assisted-grocery.service';
import { AssistedStockService } from './assisted-stock.service';
import type { AssistedActionWireResult } from './assisted-action-response.schema';

@Injectable()
export class AssistedActionService {
  constructor(
    private readonly grocery: AssistedGroceryService,
    private readonly stock: AssistedStockService,
  ) {}

  async apply(
    raw: unknown,
    source: 'api' | 'mcp',
  ): Promise<AssistedActionWireResult> {
    const parsed = assistedActionRequestSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_ASSISTED_ACTION',
        message: 'Invalid assisted-action request',
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    try {
      return await (parsed.data.operation === 'grocery_add'
        ? this.grocery.apply(parsed.data, source)
        : this.stock.apply(parsed.data, source));
    } catch (error) {
      if (error instanceof PurchaseTimestampException)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
