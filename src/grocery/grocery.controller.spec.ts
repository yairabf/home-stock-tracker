import { GroceryItemSource } from '../generated/prisma/enums';
import { GroceryController } from './grocery.controller';
import type { GroceryService } from './grocery.service';

describe('GroceryController provenance', () => {
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
});
