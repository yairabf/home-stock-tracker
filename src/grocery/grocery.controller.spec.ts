import { GroceryItemSource } from '../generated/prisma/enums';
import { GroceryController } from './grocery.controller';
import type { GroceryService } from './grocery.service';
import {
  PendingGroceryItemPolicy,
  UnknownProductPolicy,
} from './types/policy-aware-grocery-addition';

describe('GroceryController', () => {
  it('supplies api provenance to the shared service', async () => {
    const groceryService = {
      addPolicyAwareItem: jest.fn().mockResolvedValue({}),
    };
    const controller = new GroceryController(
      groceryService as unknown as GroceryService,
    );

    await controller.addItem({
      unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
      productName: 'milk',
      groceryItem: {
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
    });

    expect(groceryService.addPolicyAwareItem).toHaveBeenCalledWith({
      unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
      productName: 'milk',
      groceryItem: {
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
      source: GroceryItemSource.api,
    });
  });

  it('delegates quantity setting to the shared service', async () => {
    const result = { id: 'grocery-item-1', requestedQuantity: 4 };
    const groceryService = {
      setQuantity: jest.fn().mockResolvedValue(result),
    };
    const controller = new GroceryController(
      groceryService as unknown as GroceryService,
    );
    const dto = { requestedQuantity: 4, expectedRequestedQuantity: 2 };

    await expect(controller.setQuantity('grocery-item-1', dto)).resolves.toBe(
      result,
    );
    expect(groceryService.setQuantity).toHaveBeenCalledWith(
      'grocery-item-1',
      dto,
    );
  });

  it('supplies api provenance to confirmed product decisions', async () => {
    const groceryService = {
      confirmNewProduct: jest.fn().mockResolvedValue({}),
      confirmProductAlias: jest.fn().mockResolvedValue({}),
    };
    const controller = new GroceryController(
      groceryService as unknown as GroceryService,
    );
    const product = {
      canonicalName: 'Milk',
      aliases: [],
      category: 'dairy',
      typicalUnit: 'carton',
      productType: 'fast_consumable' as const,
      isPerishable: true,
    };

    await controller.confirmNewProduct({ product, groceryItem: {} });
    await controller.confirmProductAlias({
      targetProductId: '11111111-1111-4111-8111-111111111111',
      alias: 'Whole Milk',
      groceryItem: { requestedQuantity: 2 },
    });

    expect(groceryService.confirmNewProduct).toHaveBeenCalledWith({
      product,
      groceryItem: {},
      source: GroceryItemSource.api,
    });
    expect(groceryService.confirmProductAlias).toHaveBeenCalledWith({
      targetProductId: '11111111-1111-4111-8111-111111111111',
      alias: 'Whole Milk',
      groceryItem: { requestedQuantity: 2 },
      source: GroceryItemSource.api,
    });
  });
});
