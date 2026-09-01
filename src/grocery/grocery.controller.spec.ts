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
});
