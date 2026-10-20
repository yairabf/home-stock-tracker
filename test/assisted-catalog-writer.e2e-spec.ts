import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import {
  AssistedCatalogWriter,
  isAssistedCatalogWriteRace,
} from '../src/assisted-action/assisted-catalog-writer.service';
import { AssistedCatalogConflict } from '../src/assisted-action/assisted-catalog-conflict';
import type { PreparedCatalogProduct } from '../src/assisted-action/assisted-preparation';
import { toProductSearchProduct } from '../src/product/types/product-search';
import { PRODUCT_WITH_NAMES_ARGS } from '../src/product/types/product-with-names';

const connectionString = process.env.ASSISTED_CATALOG_TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test'))
  throw new Error(
    'Set ASSISTED_CATALOG_TEST_DATABASE_URL to a dedicated database ending in _test',
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const writer = new AssistedCatalogWriter();
const prefix = `assisted-writer-${randomUUID()}`;
const receiptIds: string[] = [];
let index = 0;

function prepared(name = `${prefix}-${index++}`): PreparedCatalogProduct {
  return {
    canonicalName: name,
    suppliedName: `${name} brand`,
    aliasToAdd: `${name} brand`,
    existing: null,
    metadata: {
      category: 'dairy',
      typicalUnit: 'liter',
      productType: 'fast_consumable',
      isPerishable: true,
    },
    identityEvidence: null,
    understanding: null,
  };
}
function write(value: PreparedCatalogProduct) {
  return prisma.$transaction((tx) => writer.applyWithinTransaction(tx, value), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
function barrier() {
  let count = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    if (++count === 2) release();
    await ready;
  };
}
async function raceWrite(
  value: PreparedCatalogProduct,
  rendezvous: () => Promise<void>,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          if (attempt === 0) {
            // Both transactions establish a snapshot before either can write.
            await tx.productName.findUnique({
              where: { normalizedName: value.canonicalName },
            });
            await rendezvous();
          }
          return writer.applyWithinTransaction(tx, value);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        },
      );
      return { ...result, retries: attempt };
    } catch (error) {
      if (!isAssistedCatalogWriteRace(error) || attempt === 2) throw error;
    }
  }
}

describe('Assisted catalog writer (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.assistedActionReceipt.deleteMany({
      where: { requestId: { in: receiptIds } },
    });
    const products = await prisma.product.findMany({
      where: { names: { some: { displayName: { startsWith: prefix } } } },
      select: { id: true },
    });
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: products.map((p) => p.id) } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: products.map((p) => p.id) } },
    });
    await prisma.$disconnect();
  });

  it('creates one canonical name and preserves the submitted alias', async () => {
    const value = prepared();
    value.suppliedName = `${value.canonicalName}  Brand 3%`;
    value.aliasToAdd = value.suppliedName;
    const result = await write(value);
    expect(result.catalogAction).toBe('created');
    expect(result.product.names).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'canonical',
          displayName: value.canonicalName,
        }),
        expect.objectContaining({
          kind: 'alias',
          displayName: value.suppliedName,
          normalizedName: `${value.canonicalName} brand 3%`,
        }),
      ]),
    );
    expect(result.product).toMatchObject(value.metadata);
  });

  it('does not create a duplicate alias for the canonical normalized phrase', async () => {
    const value = prepared();
    value.suppliedName = value.canonicalName.toUpperCase();
    value.aliasToAdd = null;
    const result = await write(value);
    expect(result.product.names).toHaveLength(1);
    expect((await write(value)).catalogAction).toBe('existing');
  });

  it('reuses a compatible newly-created owner and adds only the missing alias', async () => {
    const value = prepared();
    const first = await write(value);
    const next = {
      ...value,
      suppliedName: `${value.canonicalName} other brand`,
      aliasToAdd: `${value.canonicalName} other brand`,
    };
    const second = await write(next);
    expect(second.product.id).toBe(first.product.id);
    expect(second.catalogAction).toBe('alias_added');
    expect((await write(next)).catalogAction).toBe('existing');
    expect(second.product.names).toHaveLength(3);
  });

  it('fills only missing fields and retains stored explicit false', async () => {
    const value = prepared();
    const initial = await write({
      ...value,
      metadata: { ...value.metadata, category: null, isPerishable: false },
    });
    const next = {
      ...value,
      existing: toProductSearchProduct(initial.product),
      metadata: { ...value.metadata, isPerishable: false },
    };
    const result = await write(next);
    expect(result.product.category).toBe('dairy');
    expect(result.product.isPerishable).toBe(false);
  });

  it('rejects stale metadata without adding the pending alias', async () => {
    const value = prepared();
    const initial = await write(value);
    const next = {
      ...value,
      suppliedName: `${value.canonicalName} stale brand`,
      existing: toProductSearchProduct(initial.product),
    };
    await prisma.product.update({
      where: { id: initial.product.id },
      data: { category: 'corrected' },
    });
    await expect(write(next)).rejects.toMatchObject({
      code: 'metadata_conflict',
    });
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: next.suppliedName },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: initial.product.id },
        })
      ).category,
    ).toBe('corrected');
  });

  it('rejects renamed or deleted selected identities instead of recreating them', async () => {
    const value = prepared();
    const initial = await write(value);
    const next = {
      ...value,
      existing: toProductSearchProduct(initial.product),
    };
    await prisma.productName.updateMany({
      where: { productId: initial.product.id, kind: 'canonical' },
      data: {
        displayName: `${value.canonicalName} renamed`,
        normalizedName: `${value.canonicalName} renamed`,
      },
    });
    await expect(write(next)).rejects.toMatchObject({
      code: 'ambiguous_product',
    });
    await prisma.product.delete({ where: { id: initial.product.id } });
    await expect(write(next)).rejects.toMatchObject({
      code: 'ambiguous_product',
    });
  });

  it('rejects an alias owned by another product without creating an orphan', async () => {
    const owner = prepared();
    const original = await write(owner);
    const value = {
      ...prepared(),
      suppliedName: owner.suppliedName,
      aliasToAdd: owner.suppliedName,
    };
    await expect(write(value)).rejects.toMatchObject({
      code: 'alias_conflict',
    });
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: value.canonicalName },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.productName.findUniqueOrThrow({
          where: { normalizedName: owner.suppliedName! },
        })
      ).productId,
    ).toBe(original.product.id);
  });

  it('rolls back catalog, grocery and receipt writes on downstream failure', async () => {
    const value = prepared();
    const requestId = randomUUID();
    receiptIds.push(requestId);
    await expect(
      prisma.$transaction(
        async (tx) => {
          const result = await writer.applyWithinTransaction(tx, value);
          await tx.groceryListItem.create({
            data: { productId: result.product.id, requestedQuantity: 1 },
          });
          await tx.assistedActionReceipt.create({
            data: {
              requestId,
              requestHash: 'a'.repeat(64),
              operation: 'grocery_add',
              response: { outcome: 'applied' },
            },
          });
          throw new Error('Downstream failure');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    ).rejects.toThrow('Downstream failure');
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: value.canonicalName },
      }),
    ).toBeNull();
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: value.suppliedName! },
      }),
    ).toBeNull();
    expect(
      await prisma.assistedActionReceipt.findUnique({ where: { requestId } }),
    ).toBeNull();
  });

  it('rolls back alias and metadata enrichment on a later failure', async () => {
    const value = prepared();
    const initial = await write({
      ...value,
      metadata: { ...value.metadata, category: null },
    });
    const next = {
      ...value,
      suppliedName: `${value.canonicalName} rollback brand`,
      existing: toProductSearchProduct(initial.product),
    };
    await expect(
      prisma.$transaction(
        async (tx) => {
          await writer.applyWithinTransaction(tx, next);
          throw new Error('Later failure');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    ).rejects.toThrow('Later failure');
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: initial.product.id },
        })
      ).category,
    ).toBeNull();
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: next.suppliedName },
      }),
    ).toBeNull();
  });

  it('reuses one canonical product after a real concurrent creation race', async () => {
    const value = prepared();
    const rendezvous = barrier();
    const other = {
      ...value,
      suppliedName: `${value.canonicalName} other`,
      aliasToAdd: `${value.canonicalName} other`,
    };
    const [a, b] = await Promise.all([
      raceWrite(value, rendezvous),
      raceWrite(other, rendezvous),
    ]);
    expect(a.product.id).toBe(b.product.id);
    expect(a.retries + b.retries).toBeGreaterThan(0);
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: a.product.id },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    expect(
      product.names.filter((name) => name.kind === 'canonical'),
    ).toHaveLength(1);
    expect(product.names).toHaveLength(3);
  });

  it('never transfers alias ownership during competing canonical creations', async () => {
    const value = prepared();
    const rendezvous = barrier();
    const other = {
      ...prepared(),
      suppliedName: value.suppliedName,
      aliasToAdd: value.suppliedName,
    };
    const results = await Promise.allSettled([
      raceWrite(value, rendezvous),
      raceWrite(other, rendezvous),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(AssistedCatalogConflict);
    expect(
      await prisma.productName.count({
        where: {
          normalizedName: { in: [value.canonicalName, other.canonicalName] },
        },
      }),
    ).toBe(1);
  });
});
