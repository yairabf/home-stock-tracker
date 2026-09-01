import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  GroceryItemSource,
  GroceryItemStatus,
  ProductNameKind,
} from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProductService } from '../product/product.service';
import { GroceryService } from './grocery.service';
import { PendingGroceryItemPolicy } from './dto/add-grocery-item.dto';
import { AddGroceryItemOutcome } from './dto/add-grocery-item-result.dto';

const product = {
  id: 'product-1',
  names: [
    {
      id: 'name-1',
      productId: 'product-1',
      displayName: 'milk',
      normalizedName: 'milk',
      kind: ProductNameKind.canonical,
    },
  ],
};

describe('GroceryService addItem', () => {
  const item = {
    id: 'grocery-item-1',
    productId: product.id,
    requestedQuantity: 1,
    unit: 'liter',
    dateAdded: new Date('2026-08-30T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: null,
    source: GroceryItemSource.api,
    relatedInventoryEventId: null,
  };
  let queryRaw: jest.Mock;
  let findMany: jest.Mock;
  let create: jest.Mock;
  let transaction: jest.Mock;
  let findOrCreateProduct: jest.Mock;
  let service: GroceryService;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    findMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockResolvedValue(item);
    const tx = {
      $queryRaw: queryRaw,
      groceryListItem: { findMany, create },
    };
    transaction = jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    const prisma = {
      $transaction: transaction,
      groceryListItem: { create },
    } as unknown as PrismaService;
    findOrCreateProduct = jest.fn().mockResolvedValue(product);
    const productService = {
      findOrCreateByExactOrAliasMatch: findOrCreateProduct,
    } as unknown as ProductService;
    service = new GroceryService(prisma, productService);
  });

  it('creates the first pending item inside the product lock', async () => {
    await expect(
      service.addItem({
        productName: 'whole milk',
        requestedQuantity: 1,
        unit: 'liter',
      }),
    ).resolves.toMatchObject({
      outcome: AddGroceryItemOutcome.created,
      createdItem: { id: item.id },
      existingItems: [],
      requestedAddition: { requestedQuantity: 1, unit: 'liter' },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { productId: product.id, status: GroceryItemStatus.pending },
      orderBy: { dateAdded: 'desc' },
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('defaults an omitted quantity only when persisting a new line', async () => {
    await expect(
      service.addItem({ productName: 'whole milk' }),
    ).resolves.toMatchObject({
      outcome: AddGroceryItemOutcome.created,
      requestedAddition: { requestedQuantity: null },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestedQuantity: 1 }),
    });
  });

  it('preserves a positive fractional quantity', async () => {
    await service.addItem({
      productName: 'whole milk',
      requestedQuantity: 0.5,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestedQuantity: 0.5 }),
    });
  });

  it('returns every canonical-product pending match without mutation', async () => {
    findMany.mockResolvedValue([item, { ...item, id: 'grocery-item-2' }]);

    await expect(
      service.addItem({ productName: 'whole milk', requestedQuantity: 1 }),
    ).resolves.toMatchObject({
      outcome: AddGroceryItemOutcome.confirmation_required,
      createdItem: null,
      existingItems: [{ id: item.id }, { id: 'grocery-item-2' }],
      requestedAddition: { requestedQuantity: 1 },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('preserves omission in a duplicate result without mutation', async () => {
    findMany.mockResolvedValue([item]);

    await expect(
      service.addItem({ productName: 'whole milk' }),
    ).resolves.toMatchObject({
      outcome: AddGroceryItemOutcome.confirmation_required,
      requestedAddition: { requestedQuantity: null },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates an explicit separate line without checking pending items', async () => {
    await expect(
      service.addItem({
        productName: 'milk',
        ifPendingExists: PendingGroceryItemPolicy.create_separate,
      }),
    ).resolves.toMatchObject({
      outcome: AddGroceryItemOutcome.created,
      requestedAddition: { requestedQuantity: null },
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ requestedQuantity: 1 }),
    });
  });

  it.each([
    ['zero', 0],
    ['a negative value', -1],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ])(
    'rejects %s before product lookup or mutation',
    async (_, requestedQuantity) => {
      await expect(
        service.addItem({ productName: 'milk', requestedQuantity }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_QUANTITY' } });
      expect(findOrCreateProduct).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );
});

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
    product: product,
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

describe('GroceryService setQuantity', () => {
  const id = 'grocery-item-1';
  const item = {
    id,
    productId: 'product-1',
    requestedQuantity: 2,
    unit: 'Liters',
    dateAdded: new Date('2026-08-30T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: 'usual brand',
    source: GroceryItemSource.api,
    relatedInventoryEventId: null,
    product,
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

  it.each([4, 0.5])(
    'sets the absolute quantity to %s while preserving other fields',
    async (requestedQuantity) => {
      await expect(
        service.setQuantity(id, {
          requestedQuantity,
          expectedRequestedQuantity: 2,
        }),
      ).resolves.toMatchObject({
        requestedQuantity,
        unit: 'Liters',
        note: 'usual brand',
        source: GroceryItemSource.api,
        status: GroceryItemStatus.pending,
        relatedInventoryEventId: null,
      });
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id,
          status: GroceryItemStatus.pending,
          requestedQuantity: 2,
        },
        data: { requestedQuantity },
      });
    },
  );

  it('returns a stable not-found error', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.setQuantity(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).rejects.toMatchObject({ response: { code: 'GROCERY_ITEM_NOT_FOUND' } });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not update a non-pending item', async () => {
    findUnique.mockResolvedValue({
      ...item,
      status: GroceryItemStatus.purchased,
    });

    await expect(
      service.setQuantity(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'GROCERY_ITEM_NOT_PENDING',
        currentItem: { id, requestedQuantity: 2 },
      },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a stale expected quantity without mutation', async () => {
    await expect(
      service.setQuantity(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'GROCERY_ITEM_CHANGED',
        currentItem: { id, requestedQuantity: 2 },
      },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns the latest item when a concurrent update wins', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce({ ...item, requestedQuantity: 5 });

    await expect(
      service.setQuantity(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'GROCERY_ITEM_CHANGED',
        currentItem: { requestedQuantity: 5 },
      },
    });
  });

  it.each([
    ['final zero', 0, 2],
    ['final negative', -1, 2],
    ['final NaN', Number.NaN, 2],
    ['final positive infinity', Number.POSITIVE_INFINITY, 2],
    ['final negative infinity', Number.NEGATIVE_INFINITY, 2],
    ['expected zero', 4, 0],
    ['expected negative', 4, -1],
    ['expected NaN', 4, Number.NaN],
    ['expected positive infinity', 4, Number.POSITIVE_INFINITY],
    ['expected negative infinity', 4, Number.NEGATIVE_INFINITY],
  ])(
    'rejects invalid %s before persistence',
    async (_, requestedQuantity, expectedRequestedQuantity) => {
      await expect(
        service.setQuantity(id, {
          requestedQuantity,
          expectedRequestedQuantity,
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_QUANTITY' } });
      expect(findUnique).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    },
  );
});

describe('GroceryService updateItem', () => {
  const id = 'grocery-item-1';
  const item = {
    id,
    productId: 'product-1',
    requestedQuantity: 2,
    unit: 'Liters',
    dateAdded: new Date('2026-08-30T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: 'usual brand',
    source: GroceryItemSource.api,
    relatedInventoryEventId: null,
    product: product,
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

  it('sets the final requested quantity without arithmetic', async () => {
    await expect(
      service.updateItem(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).resolves.toMatchObject({
      requestedQuantity: 4,
      unit: 'Liters',
      note: 'usual brand',
      source: GroceryItemSource.api,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id,
        status: GroceryItemStatus.pending,
        requestedQuantity: 2,
      },
      data: { requestedQuantity: 4 },
    });
  });

  it('sets a trimmed unit while preserving other fields', async () => {
    await expect(
      service.updateItem(id, {
        unit: ' cartons ',
        expectedUnit: 'Liters',
      }),
    ).resolves.toMatchObject({
      requestedQuantity: 2,
      unit: 'cartons',
      note: 'usual brand',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, status: GroceryItemStatus.pending, unit: 'Liters' },
      data: { unit: 'cartons' },
    });
  });

  it('clears a unit', async () => {
    await expect(
      service.updateItem(id, { unit: null, expectedUnit: 'Liters' }),
    ).resolves.toMatchObject({ unit: null });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, status: GroceryItemStatus.pending, unit: 'Liters' },
      data: { unit: null },
    });
  });

  it('sets a trimmed note while preserving other fields', async () => {
    await expect(
      service.updateItem(id, {
        note: ' lactose-free ',
        expectedNote: 'usual brand',
      }),
    ).resolves.toMatchObject({
      requestedQuantity: 2,
      unit: 'Liters',
      note: 'lactose-free',
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, status: GroceryItemStatus.pending, note: 'usual brand' },
      data: { note: 'lactose-free' },
    });
  });

  it('clears a note', async () => {
    await expect(
      service.updateItem(id, { note: null, expectedNote: 'usual brand' }),
    ).resolves.toMatchObject({ note: null });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, status: GroceryItemStatus.pending, note: 'usual brand' },
      data: { note: null },
    });
  });

  it('updates selected fields in one atomic write', async () => {
    await expect(
      service.updateItem(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
        unit: 'cartons',
        expectedUnit: 'Liters',
        note: null,
        expectedNote: 'usual brand',
      }),
    ).resolves.toMatchObject({
      requestedQuantity: 4,
      unit: 'cartons',
      note: null,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id,
        status: GroceryItemStatus.pending,
        requestedQuantity: 2,
        unit: 'Liters',
        note: 'usual brand',
      },
      data: { requestedQuantity: 4, unit: 'cartons', note: null },
    });
  });

  it('returns a stable not-found error', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.updateItem(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).rejects.toMatchObject({ response: { code: 'GROCERY_ITEM_NOT_FOUND' } });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not update a non-pending item', async () => {
    findUnique.mockResolvedValue({
      ...item,
      status: GroceryItemStatus.purchased,
    });

    await expect(
      service.updateItem(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).rejects.toMatchObject({
      response: { code: 'GROCERY_ITEM_NOT_PENDING' },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'empty update',
      input: {},
      code: 'INVALID_UPDATE',
    },
    {
      name: 'quantity without expected value',
      input: { requestedQuantity: 4 },
      code: 'INVALID_QUANTITY',
    },
    {
      name: 'orphan expected quantity',
      input: {
        note: null,
        expectedNote: 'usual brand',
        expectedRequestedQuantity: 2,
      },
      code: 'INVALID_QUANTITY',
    },
    {
      name: 'unit without expected value',
      input: { unit: 'cartons' },
      code: 'INVALID_UNIT',
    },
    {
      name: 'orphan expected unit',
      input: {
        note: null,
        expectedNote: 'usual brand',
        expectedUnit: 'Liters',
      },
      code: 'INVALID_UNIT',
    },
    {
      name: 'note without expected value',
      input: { note: 'lactose-free' },
      code: 'INVALID_NOTE',
    },
    {
      name: 'orphan expected note',
      input: {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
        expectedNote: 'usual brand',
      },
      code: 'INVALID_NOTE',
    },
    {
      name: 'empty unit',
      input: { unit: ' ', expectedUnit: 'Liters' },
      code: 'INVALID_UNIT',
    },
    {
      name: 'empty note',
      input: { note: ' ', expectedNote: 'usual brand' },
      code: 'INVALID_NOTE',
    },
  ])('rejects $name without mutation', async ({ input, code }) => {
    await expect(service.updateItem(id, input)).rejects.toMatchObject({
      response: { code },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['final NaN', Number.NaN, 2],
    ['final positive infinity', Number.POSITIVE_INFINITY, 2],
    ['final negative infinity', Number.NEGATIVE_INFINITY, 2],
    ['final zero', 0, 2],
    ['final negative', -1, 2],
    ['expected null', 4, null],
    ['expected NaN', 4, Number.NaN],
    ['expected positive infinity', 4, Number.POSITIVE_INFINITY],
    ['expected negative infinity', 4, Number.NEGATIVE_INFINITY],
    ['expected zero', 4, 0],
    ['expected negative', 4, -1],
  ])(
    'rejects invalid %s without mutation',
    async (_, requestedQuantity, expectedRequestedQuantity) => {
      await expect(
        service.updateItem(id, {
          requestedQuantity,
          expectedRequestedQuantity,
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_QUANTITY' } });
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: 'quantity',
      current: {},
      input: { requestedQuantity: 4, expectedRequestedQuantity: 1 },
    },
    {
      name: 'unit',
      current: {},
      input: { unit: 'cartons', expectedUnit: 'liter' },
    },
    {
      name: 'note',
      current: {},
      input: { note: 'lactose-free', expectedNote: 'old note' },
    },
  ])(
    'rejects stale $name state without mutation',
    async ({ current, input }) => {
      findUnique.mockResolvedValue({ ...item, ...current });

      await expect(service.updateItem(id, input)).rejects.toMatchObject({
        response: {
          code: 'GROCERY_ITEM_CHANGED',
          currentItem: { id, requestedQuantity: 2, note: 'usual brand' },
        },
      });
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it('returns the latest item when a concurrent update wins', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce({ ...item, requestedQuantity: 5 });

    await expect(
      service.updateItem(id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'GROCERY_ITEM_CHANGED',
        currentItem: { requestedQuantity: 5 },
      },
    });
  });
});
