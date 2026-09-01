import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  GroceryItemSource,
  GroceryItemStatus,
  ProductNameKind,
  ProductType,
} from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProductService } from '../product/product.service';
import type { ProductResolutionService } from '../product/product-resolution.service';
import { GroceryService } from './grocery.service';
import {
  PendingGroceryItemPolicy as PolicyAwarePendingPolicy,
  UnknownProductPolicy,
} from './types/policy-aware-grocery-addition';
import { PRODUCT_NAME_CONFLICT } from '../product/product-name.exception';

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

describe('GroceryService policy-aware deterministic addition', () => {
  const item = {
    id: 'grocery-item-1',
    productId: product.id,
    requestedQuantity: 1,
    unit: null,
    dateAdded: new Date('2026-09-01T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: null,
    source: GroceryItemSource.api,
    relatedInventoryEventId: null,
  };
  const request = {
    unknownProductPolicy: UnknownProductPolicy.create_if_missing as const,
    product: {
      canonicalName: '  Milk  ',
      aliases: [],
      category: 'dairy',
      typicalUnit: 'carton',
      productType: ProductType.fast_consumable,
      isPerishable: true,
    },
    groceryItem: {
      ifPendingExists: PolicyAwarePendingPolicy.return_existing,
    },
    source: GroceryItemSource.api,
  };
  let tx: {
    $queryRaw: jest.Mock;
    groceryListItem: { findMany: jest.Mock; create: jest.Mock };
  };
  let transaction: jest.Mock;
  let explicitProduct: jest.Mock;
  let findProduct: jest.Mock;
  let resolveProduct: jest.Mock;
  let service: GroceryService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      groceryListItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(item),
      },
    };
    transaction = jest.fn((operation: (client: typeof tx) => unknown) =>
      operation(tx),
    );
    explicitProduct = jest.fn().mockResolvedValue(product);
    findProduct = jest.fn().mockResolvedValue(product);
    resolveProduct = jest.fn();
    service = new GroceryService(
      { $transaction: transaction } as unknown as PrismaService,
      {
        findOrCreateExplicitWithinTransaction: explicitProduct,
        findByExactOrAliasName: findProduct,
      } as unknown as ProductService,
      { resolve: resolveProduct } as unknown as ProductResolutionService,
    );
  });

  it('creates product and grocery item inside one serializable transaction', async () => {
    await expect(service.addPolicyAwareItem(request)).resolves.toMatchObject({
      outcome: 'created',
      requestedAddition: {
        productName: 'Milk',
        requestedQuantity: null,
        ifPendingExists: PolicyAwarePendingPolicy.return_existing,
      },
    });
    expect(explicitProduct).toHaveBeenCalledWith(tx, request.product);
    expect(tx.groceryListItem.create).toHaveBeenCalledWith({
      data: {
        productId: product.id,
        requestedQuantity: 1,
        unit: undefined,
        note: undefined,
        source: GroceryItemSource.api,
      },
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('returns pending lines without changing their quantity', async () => {
    tx.groceryListItem.findMany.mockResolvedValue([
      { ...item, requestedQuantity: 3 },
    ]);

    await expect(service.addPolicyAwareItem(request)).resolves.toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ requestedQuantity: 3 }],
    });
    expect(tx.groceryListItem.create).not.toHaveBeenCalled();
  });

  it('creates an intentional separate line in the same transaction', async () => {
    await service.addPolicyAwareItem({
      ...request,
      groceryItem: {
        ...request.groceryItem,
        ifPendingExists: PolicyAwarePendingPolicy.create_separate,
      },
    });

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.groceryListItem.findMany).not.toHaveBeenCalled();
    expect(tx.groceryListItem.create).toHaveBeenCalledTimes(1);
  });

  it('recovers a concurrent canonical winner and continues pending detection', async () => {
    explicitProduct.mockRejectedValue(
      new ConflictException({ code: PRODUCT_NAME_CONFLICT }),
    );

    await expect(service.addPolicyAwareItem(request)).resolves.toMatchObject({
      outcome: 'created',
    });
    expect(findProduct).toHaveBeenCalledWith('  Milk  ');
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('preserves a cross-name conflict when canonical recovery fails', async () => {
    const conflict = new ConflictException({ code: PRODUCT_NAME_CONFLICT });
    explicitProduct.mockRejectedValue(conflict);
    findProduct.mockRejectedValue(new Error('not found'));

    await expect(service.addPolicyAwareItem(request)).rejects.toBe(conflict);
  });

  it('rejects invalid quantities before opening a transaction', async () => {
    await expect(
      service.addPolicyAwareItem({
        ...request,
        groceryItem: { ...request.groceryItem, requestedQuantity: 0 },
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_QUANTITY' } });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns candidates and advice without a grocery transaction', async () => {
    resolveProduct.mockResolvedValue({
      exactMatch: null,
      candidates: [
        {
          id: 'candidate-1',
          canonicalName: 'Whole Milk',
          aliases: [],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: ProductType.fast_consumable,
          isPerishable: true,
          predictionEnabled: true,
        },
      ],
      proposal: null,
    });

    await expect(
      service.addPolicyAwareItem({
        unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
        productName: '  milky thing  ',
        groceryItem: {
          requestedQuantity: 2,
          ifPendingExists: PolicyAwarePendingPolicy.return_existing,
        },
        source: GroceryItemSource.mcp,
      }),
    ).resolves.toMatchObject({
      outcome: 'product_resolution_required',
      requestedAddition: {
        productName: 'milky thing',
        requestedQuantity: 2,
      },
      candidates: [{ id: 'candidate-1' }],
      allowedActions: [
        'use_existing_product',
        'add_alias',
        'create_product',
        'cancel',
      ],
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(explicitProduct).not.toHaveBeenCalled();
  });

  it('continues an exact proposal match through pending detection', async () => {
    resolveProduct.mockResolvedValue({
      exactMatch: {
        id: product.id,
        canonicalName: 'milk',
        aliases: [],
        category: 'dairy',
        typicalUnit: 'carton',
        productType: ProductType.fast_consumable,
        isPerishable: true,
        predictionEnabled: true,
      },
      candidates: [],
      proposal: null,
    });

    await expect(
      service.addPolicyAwareItem({
        unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
        productName: 'milk',
        groceryItem: {
          ifPendingExists: PolicyAwarePendingPolicy.return_existing,
        },
        source: GroceryItemSource.mcp,
      }),
    ).resolves.toMatchObject({ outcome: 'created' });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(explicitProduct).not.toHaveBeenCalled();
  });
});

describe('GroceryService confirmed new product', () => {
  const groceryItem = {
    id: 'grocery-item-1',
    productId: product.id,
    requestedQuantity: 2,
    unit: 'cartons',
    dateAdded: new Date('2026-09-01T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: null,
    source: GroceryItemSource.mcp,
    relatedInventoryEventId: null,
  };
  const request = {
    product: {
      canonicalName: '  Milk  ',
      aliases: ['Whole Milk'],
      category: 'dairy',
      typicalUnit: 'carton',
      productType: ProductType.fast_consumable,
      isPerishable: true,
    },
    groceryItem: { requestedQuantity: 2, unit: 'cartons' },
    source: GroceryItemSource.mcp,
  };
  let tx: {
    $queryRaw: jest.Mock;
    groceryListItem: { findMany: jest.Mock; create: jest.Mock };
  };
  let transaction: jest.Mock;
  let confirmProduct: jest.Mock;
  let resolveProduct: jest.Mock;
  let service: GroceryService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      groceryListItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(groceryItem),
      },
    };
    transaction = jest.fn((operation: (client: typeof tx) => unknown) =>
      operation(tx),
    );
    confirmProduct = jest.fn().mockResolvedValue(product);
    resolveProduct = jest.fn();
    service = new GroceryService(
      { $transaction: transaction } as unknown as PrismaService,
      {
        confirmExplicitWithinTransaction: confirmProduct,
      } as unknown as ProductService,
      { resolve: resolveProduct } as unknown as ProductResolutionService,
    );
  });

  it('atomically confirms the identity and creates the grocery line', async () => {
    await expect(service.confirmNewProduct(request)).resolves.toMatchObject({
      outcome: 'created',
      requestedAddition: {
        productName: 'Milk',
        requestedQuantity: 2,
        ifPendingExists: PolicyAwarePendingPolicy.return_existing,
      },
    });
    expect(confirmProduct).toHaveBeenCalledWith(tx, request.product);
    expect(tx.groceryListItem.create).toHaveBeenCalledWith({
      data: {
        productId: product.id,
        requestedQuantity: 2,
        unit: 'cartons',
        note: undefined,
        source: GroceryItemSource.mcp,
      },
    });
    expect(resolveProduct).not.toHaveBeenCalled();
  });

  it('returns existing pending lines without changing quantity', async () => {
    tx.groceryListItem.findMany.mockResolvedValue([
      { ...groceryItem, requestedQuantity: 4 },
    ]);

    await expect(service.confirmNewProduct(request)).resolves.toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ requestedQuantity: 4 }],
    });
    expect(tx.groceryListItem.create).not.toHaveBeenCalled();
  });

  it('retries a concurrent identity winner through the same validated path', async () => {
    confirmProduct
      .mockRejectedValueOnce(
        new ConflictException({ code: PRODUCT_NAME_CONFLICT }),
      )
      .mockResolvedValueOnce(product);

    await expect(service.confirmNewProduct(request)).resolves.toMatchObject({
      outcome: 'created',
    });
    expect(confirmProduct).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('preserves a confirmed namespace conflict after one convergence retry', async () => {
    const conflict = new ConflictException({ code: PRODUCT_NAME_CONFLICT });
    confirmProduct.mockRejectedValue(conflict);

    await expect(service.confirmNewProduct(request)).rejects.toBe(conflict);
    expect(confirmProduct).toHaveBeenCalledTimes(2);
    expect(tx.groceryListItem.create).not.toHaveBeenCalled();
  });

  it('rejects invalid quantities before opening a transaction', async () => {
    await expect(
      service.confirmNewProduct({
        ...request,
        groceryItem: { requestedQuantity: 0 },
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_QUANTITY' } });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('GroceryService confirmed product alias', () => {
  const groceryItem = {
    id: 'grocery-item-1',
    productId: product.id,
    requestedQuantity: 1,
    unit: null,
    dateAdded: new Date('2026-09-01T10:00:00.000Z'),
    status: GroceryItemStatus.pending,
    note: null,
    source: GroceryItemSource.api,
    relatedInventoryEventId: null,
  };
  const request = {
    targetProductId: product.id,
    alias: '  Whole Milk  ',
    groceryItem: {},
    source: GroceryItemSource.api,
  };
  let tx: {
    $queryRaw: jest.Mock;
    groceryListItem: { findMany: jest.Mock; create: jest.Mock };
  };
  let transaction: jest.Mock;
  let confirmAlias: jest.Mock;
  let service: GroceryService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      groceryListItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(groceryItem),
      },
    };
    transaction = jest.fn((operation: (client: typeof tx) => unknown) =>
      operation(tx),
    );
    confirmAlias = jest.fn().mockResolvedValue(product);
    service = new GroceryService(
      { $transaction: transaction } as unknown as PrismaService,
      {
        confirmAliasWithinTransaction: confirmAlias,
      } as unknown as ProductService,
      { resolve: jest.fn() } as unknown as ProductResolutionService,
    );
  });

  it('persists the approved alias before normal grocery creation', async () => {
    await expect(service.confirmProductAlias(request)).resolves.toMatchObject({
      outcome: 'created',
      requestedAddition: {
        productName: 'Whole Milk',
        requestedQuantity: null,
        ifPendingExists: PolicyAwarePendingPolicy.return_existing,
      },
    });
    expect(confirmAlias).toHaveBeenCalledWith(
      tx,
      request.targetProductId,
      request.alias,
    );
    expect(tx.groceryListItem.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the alias transaction successful when quantity confirmation is required', async () => {
    tx.groceryListItem.findMany.mockResolvedValue([
      { ...groceryItem, requestedQuantity: 3 },
    ]);

    await expect(service.confirmProductAlias(request)).resolves.toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ requestedQuantity: 3 }],
    });
    expect(confirmAlias).toHaveBeenCalledTimes(1);
    expect(tx.groceryListItem.create).not.toHaveBeenCalled();
  });

  it('retries a concurrent same-owner alias through the validated path', async () => {
    confirmAlias
      .mockRejectedValueOnce(
        new ConflictException({ code: PRODUCT_NAME_CONFLICT }),
      )
      .mockResolvedValueOnce(product);

    await expect(service.confirmProductAlias(request)).resolves.toMatchObject({
      outcome: 'created',
    });
    expect(confirmAlias).toHaveBeenCalledTimes(2);
  });

  it('preserves target-deleted errors without retrying', async () => {
    const missing = new NotFoundException({ code: 'PRODUCT_NOT_FOUND' });
    confirmAlias.mockRejectedValue(missing);

    await expect(service.confirmProductAlias(request)).rejects.toBe(missing);
    expect(confirmAlias).toHaveBeenCalledTimes(1);
  });
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
    service = new GroceryService(
      prisma,
      {} as ProductService,
      {} as ProductResolutionService,
    );
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
    service = new GroceryService(
      prisma,
      {} as ProductService,
      {} as ProductResolutionService,
    );
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
    service = new GroceryService(
      prisma,
      {} as ProductService,
      {} as ProductResolutionService,
    );
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
