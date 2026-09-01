import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIRECTORY = path.resolve(process.cwd(), 'prisma/migrations');
const QUANTITY_MIGRATION = '20260901140000_enforce_positive_grocery_quantity';
const migrationNames = readdirSync(MIGRATIONS_DIRECTORY, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const quantityMigrationIndex = migrationNames.indexOf(QUANTITY_MIGRATION);
const previousMigrations = migrationNames.slice(0, quantityMigrationIndex);

describe('Grocery quantity migration (e2e)', () => {
  const schemas = new Set<string>();

  beforeAll(() => {
    expect(quantityMigrationIndex).toBeGreaterThan(0);
  });

  afterAll(async () => {
    for (const schema of schemas) {
      await withClient(async (client) => {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      });
    }
  });

  it('applies the full migration history to a fresh schema', async () => {
    await withTemporarySchema(async (client) => {
      await applyMigrations(client, migrationNames);

      await expectQuantityContract(client);
    });
  });

  it('backfills nulls while preserving positive quantities', async () => {
    await withTemporarySchema(async (client) => {
      await applyMigrations(client, previousMigrations);
      const productId = await insertProduct(client);
      const nullId = await insertGroceryItem(client, productId, null);
      const integerId = await insertGroceryItem(client, productId, 3);
      const fractionId = await insertGroceryItem(client, productId, 0.5);

      await applyMigration(client, QUANTITY_MIGRATION);

      const { rows } = await client.query<{
        id: string;
        requestedQuantity: number;
      }>(
        'SELECT "id", "requestedQuantity" FROM "GroceryListItem" ORDER BY "id"',
      );
      expect(rows).toEqual(
        [
          { id: nullId, requestedQuantity: 1 },
          { id: integerId, requestedQuantity: 3 },
          { id: fractionId, requestedQuantity: 0.5 },
        ].sort((left, right) => left.id.localeCompare(right.id)),
      );
      await expectQuantityContract(client);

      const defaultedId = randomUUID();
      await client.query(
        'INSERT INTO "GroceryListItem" ("id", "productId") VALUES ($1, $2)',
        [defaultedId, productId],
      );
      const defaulted = await groceryQuantity(client, defaultedId);
      expect(defaulted).toBe(1);
    });
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', 'NaN'],
    ['positive infinity', 'Infinity'],
    ['negative infinity', '-Infinity'],
  ])('rejects post-migration %s values', async (_, quantity) => {
    await withTemporarySchema(async (client) => {
      await applyMigrations(client, migrationNames);
      const productId = await insertProduct(client);

      await expect(
        insertGroceryItem(client, productId, quantity),
      ).rejects.toMatchObject({
        constraint: 'GroceryListItem_requestedQuantity_positive_finite_check',
      });
    });
  });

  it.each([
    {
      label: 'zero',
      quantity: 0,
      counts:
        'zero=1, negative=0, nan=0, positive_infinity=0, negative_infinity=0',
    },
    {
      label: 'negative',
      quantity: -1,
      counts:
        'zero=0, negative=1, nan=0, positive_infinity=0, negative_infinity=0',
    },
    {
      label: 'NaN',
      quantity: 'NaN',
      counts:
        'zero=0, negative=0, nan=1, positive_infinity=0, negative_infinity=0',
    },
    {
      label: 'positive infinity',
      quantity: 'Infinity',
      counts:
        'zero=0, negative=0, nan=0, positive_infinity=1, negative_infinity=0',
    },
    {
      label: 'negative infinity',
      quantity: '-Infinity',
      counts:
        'zero=0, negative=0, nan=0, positive_infinity=0, negative_infinity=1',
    },
  ])(
    'rejects legacy $label before changing data or schema',
    async ({ quantity, counts }) => {
      await withTemporarySchema(async (client) => {
        await applyMigrations(client, previousMigrations);
        const productId = await insertProduct(client);
        const invalidId = await insertGroceryItem(client, productId, quantity);
        const nullId = await insertGroceryItem(client, productId, null);

        let migrationError: Error | undefined;
        try {
          await applyMigration(client, QUANTITY_MIGRATION);
        } catch (error) {
          migrationError = error as Error;
          await client.query('ROLLBACK');
        }

        expect(migrationError?.message).toContain(counts);
        expect(migrationError?.message).not.toContain(invalidId);
        expect(migrationError?.message).not.toContain(productId);
        expect(await groceryQuantity(client, invalidId)).toBe(
          normalizedQuantity(quantity),
        );
        expect(await groceryQuantity(client, nullId)).toBeNull();
        await expectNullableQuantityColumn(client);
        await expectQuantityConstraint(client, false);
      });
    },
  );

  async function withTemporarySchema(
    operation: (client: Client) => Promise<void>,
  ): Promise<void> {
    const schema = `grocery_quantity_${randomUUID().replaceAll('-', '')}`;
    schemas.add(schema);
    await withClient(async (client) => {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await operation(client);
    });
  }
});

async function withClient(
  operation: (client: Client) => Promise<void>,
): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await operation(client);
  } finally {
    await client.end();
  }
}

async function applyMigrations(
  client: Client,
  migrations: string[],
): Promise<void> {
  for (const migration of migrations) {
    await applyMigration(client, migration);
  }
}

async function applyMigration(
  client: Client,
  migration: string,
): Promise<void> {
  const sql = await readFile(
    path.join(MIGRATIONS_DIRECTORY, migration, 'migration.sql'),
    'utf8',
  );
  await client.query(sql);
}

async function insertProduct(client: Client): Promise<string> {
  const productId = randomUUID();
  await client.query('INSERT INTO "Product" ("id") VALUES ($1)', [productId]);
  return productId;
}

async function insertGroceryItem(
  client: Client,
  productId: string,
  quantity: number | string | null,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    'INSERT INTO "GroceryListItem" ("id", "productId", "requestedQuantity") VALUES ($1, $2, $3::DOUBLE PRECISION)',
    [id, productId, quantity],
  );
  return id;
}

async function groceryQuantity(
  client: Client,
  id: string,
): Promise<number | null> {
  const { rows } = await client.query<{ requestedQuantity: number | null }>(
    'SELECT "requestedQuantity" FROM "GroceryListItem" WHERE "id" = $1',
    [id],
  );
  return rows[0].requestedQuantity;
}

function normalizedQuantity(quantity: number | string): number {
  return typeof quantity === 'number' ? quantity : Number(quantity);
}

async function expectQuantityContract(client: Client): Promise<void> {
  const { rows } = await client.query<{
    isNullable: 'YES' | 'NO';
    columnDefault: string | null;
  }>(
    `SELECT is_nullable AS "isNullable", column_default AS "columnDefault"
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'GroceryListItem'
       AND column_name = 'requestedQuantity'`,
  );
  expect(rows[0]).toMatchObject({ isNullable: 'NO' });
  expect(rows[0].columnDefault).toContain('1');
  await expectQuantityConstraint(client, true);
}

async function expectNullableQuantityColumn(client: Client): Promise<void> {
  const { rows } = await client.query<{
    isNullable: 'YES' | 'NO';
    columnDefault: string | null;
  }>(
    `SELECT is_nullable AS "isNullable", column_default AS "columnDefault"
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'GroceryListItem'
       AND column_name = 'requestedQuantity'`,
  );
  expect(rows[0]).toEqual({ isNullable: 'YES', columnDefault: null });
}

async function expectQuantityConstraint(
  client: Client,
  expected: boolean,
): Promise<void> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE connamespace = current_schema()::regnamespace
         AND conname = 'GroceryListItem_requestedQuantity_positive_finite_check'
     ) AS exists`,
  );
  expect(rows[0].exists).toBe(expected);
}
