import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { GroceryItemSource } from '../generated/prisma/enums';
import { GroceryService } from '../grocery/grocery.service';
import { PendingGroceryItemPolicy } from '../grocery/types/policy-aware-grocery-addition';
import { getCanonicalProductName } from '../product/types/product-with-names';
import { UNDERSTANDING_FIELDS } from '../product/product-understanding';
import { AssistedBatchPreparation } from './assisted-batch-preparation.service';
import { AssistedActionTransactions } from './assisted-action-transactions.service';
import { AssistedCatalogWriter } from './assisted-catalog-writer.service';
import { applyPreparedCatalogBatch } from './assisted-catalog-batch';
import {
  parseAssistedActionRequest,
  type AssistedActionRequest,
} from './assisted-action-request';
import { assistedActionRequestHash } from './assisted-action-replay';
import type {
  AssistedAppliedResult,
  AssistedGroceryReceipt,
} from './assisted-action-result';
import type { AssistedActionWireResult } from './assisted-action-response.schema';
import type { PreparedCatalogProduct } from './assisted-preparation';

type GroceryRequest = Extract<
  AssistedActionRequest,
  { operation: 'grocery_add' }
>;

@Injectable()
export class AssistedGroceryService {
  constructor(
    private readonly preparation: AssistedBatchPreparation,
    private readonly transactions: AssistedActionTransactions,
    private readonly catalog: AssistedCatalogWriter,
    private readonly grocery: GroceryService,
  ) {}

  async apply(
    raw: unknown,
    source: 'api' | 'mcp',
  ): Promise<AssistedActionWireResult> {
    const request = parseAssistedActionRequest(raw);
    if (request.operation !== 'grocery_add')
      throw new BadRequestException('Expected grocery_add operation');
    const hash = assistedActionRequestHash(request);
    const replay = await this.transactions.findReplay(request, hash);
    if (replay) return replay;
    const prepared = await this.preparation.prepare(request.items);
    if (prepared.outcome !== 'prepared')
      return { ...prepared, requestId: request.requestId };
    return this.transactions.execute(request, hash, (tx) =>
      this.applyWithinTransaction(
        tx,
        request,
        prepared.products,
        source === 'mcp' ? GroceryItemSource.mcp : GroceryItemSource.api,
      ),
    );
  }

  private async applyWithinTransaction(
    tx: Prisma.TransactionClient,
    request: GroceryRequest,
    prepared: PreparedCatalogProduct[],
    source: GroceryItemSource,
  ): Promise<AssistedAppliedResult> {
    const products = await applyPreparedCatalogBatch(
      tx,
      prepared,
      this.catalog,
    );
    const receipts: AssistedGroceryReceipt[] =
      new Array<AssistedGroceryReceipt>(products.length);
    // Stable lock order avoids deadlocks when batches list the same products differently.
    const order = products
      .map(({ product }, index) => ({ id: product.id, index }))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const { index } of order) {
      const { product, catalogAction } = products[index];
      const item = request.items[index];
      const result = await this.grocery.addAssistedWithinTransaction(
        tx,
        product,
        {
          requestedQuantity: item.quantity,
          unit: item.unit,
          note: item.note,
          ifPendingExists:
            item.ifPendingExists === 'create_separate'
              ? PendingGroceryItemPolicy.create_separate
              : PendingGroceryItemPolicy.return_existing,
        },
        source,
      );
      receipts[index] = {
        inputIndex: index,
        suppliedName: prepared[index].suppliedName,
        productId: product.id,
        canonicalName: getCanonicalProductName(product),
        catalogAction,
        unresolvedMetadata: UNDERSTANDING_FIELDS.filter(
          (field) => product[field] === null,
        ),
        ...result,
      };
    }
    return {
      outcome: 'applied',
      operation: 'grocery_add',
      requestId: request.requestId,
      receipts,
    };
  }
}
