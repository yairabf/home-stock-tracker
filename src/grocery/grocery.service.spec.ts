import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  GroceryItemSource,
  GroceryItemStatus,
} from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProductService } from '../product/product.service';
import { GroceryService } from './grocery.service';

describe('GroceryService removeItem', () => {
  const id = 'grocery-item-1';
  const item = {
    id,
    productId: 'product-1',
    requestedQuantity: 1,
    unit: 'unit',
    dateAdded: new Date('2026-08-30T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: null,
    source: GroceryItemSource.api,
    relatedInventoryEventId: null,
    product: { canonicalName: 'milk' },
  };
  let findUnique: jest.Mock;
  let updateMany: jest.Mock;
  let service: GroceryService;

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue(item);
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      groceryListItem: { findUnique, updateMany },
    } as unknown as PrismaService;
    service = new GroceryService(prisma, {} as ProductService);
  });

  it('atomically transitions a pending item to removed', async () => {
    await expect(service.removeItem(id)).resolves.toMatchObject({
      id,
      productName: 'milk',
      status: GroceryItemStatus.removed,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, status: GroceryItemStatus.pending },
      data: { status: GroceryItemStatus.removed },
    });
  });

  it('returns 404 for an unknown item', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.removeItem(id)).rejects.toEqual(
      new NotFoundException(`Grocery list item ${id} not found`),
    );
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([GroceryItemStatus.purchased, GroceryItemStatus.removed])(
    'returns 409 without overwriting a %s item',
    async (status) => {
      findUnique.mockResolvedValue({ ...item, status });

      await expect(service.removeItem(id)).rejects.toEqual(
        new ConflictException(`Grocery list item ${id} is not pending`),
      );
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it('returns 409 when another terminal transition wins the race', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.removeItem(id)).rejects.toEqual(
      new ConflictException(`Grocery list item ${id} is not pending`),
    );
  });
});
