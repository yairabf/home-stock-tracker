import { GroceryItemSource } from '../generated/prisma/enums';
import { GroceryController } from './grocery.controller';
import type { GroceryService } from './grocery.service';

describe('GroceryController', () => {
  it('supplies api provenance to the shared service', async () => {
    const groceryService = {
      addItem: jest.fn().mockResolvedValue({}),
    };
    const controller = new GroceryController(
      groceryService as unknown as GroceryService,
    );

    await controller.addItem({ productName: 'milk' });

    expect(groceryService.addItem).toHaveBeenCalledWith({
      productName: 'milk',
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
