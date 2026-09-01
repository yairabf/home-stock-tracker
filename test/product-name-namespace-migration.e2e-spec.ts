import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import {
  normalizeProductDisplayName,
  normalizeProductName,
} from '../src/product/product-name.util';

const MIGRATIONS_DIRECTORY = path.resolve(process.cwd(), 'prisma/migrations');
const NAMESPACE_MIGRATION = '20260901051613_add_product_name_namespace';
const CONTRACT_MIGRATION = '20260901113000_remove_legacy_product_names';
const migrationNames = readdirSync(MIGRATIONS_DIRECTORY, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const namespaceMigrationIndex = migrationNames.indexOf(NAMESPACE_MIGRATION);
const contractMigrationIndex = migrationNames.indexOf(CONTRACT_MIGRATION);
const previousMigrations = migrationNames.slice(0, namespaceMigrationIndex);
const expandedMigrations = migrationNames.slice(0, contractMigrationIndex);

describe('Product name namespace migration (e2e)', () => {
  const schemas = new Set<string>();

  beforeAll(() => {
    expect(namespaceMigrationIndex).toBeGreaterThan(0);
    expect(contractMigrationIndex).toBeGreaterThan(namespaceMigrationIndex);
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

      const { rows } = await client.query<{ count: string }>(
        'SELECT count(*) FROM "ProductName"',
      );
      expect(rows[0].count).toBe('0');
      await expectNamespaceIndexes(client);
      await expectLegacyProductNameColumns(client, false);
    });
  });

  it('backfills a previously migrated schema with runtime-equivalent names', async () => {
    await withTemporarySchema(async (client) => {
      await applyMigrations(client, previousMigrations);
      const productId = randomUUID();
      const canonicalName = '  ３％\tMilk  ';
      const aliases = ['Café Milk', ' Whole Milk﻿'];
      await client.query(
        'INSERT INTO "Product" ("id", "canonicalName", "aliases") VALUES ($1, $2, $3)',
        [productId, canonicalName, aliases],
      );

      await applyMigration(client, NAMESPACE_MIGRATION);

      const { rows } = await client.query<{
        displayName: string;
        normalizedName: string;
        kind: 'canonical' | 'alias';
      }>(
        'SELECT "displayName", "normalizedName", "kind" FROM "ProductName" WHERE "productId" = $1 ORDER BY "kind", "normalizedName"',
        [productId],
      );
      expect(rows).toEqual(
        [
          { rawName: canonicalName, kind: 'canonical' as const },
          ...aliases.map((rawName) => ({ rawName, kind: 'alias' as const })),
        ]
          .map(({ rawName, kind }) => ({
            displayName: normalizeProductDisplayName(rawName),
            normalizedName: normalizeProductName(rawName),
            kind,
          }))
          .sort(
            (left, right) =>
              right.kind.localeCompare(left.kind) ||
              left.normalizedName.localeCompare(right.normalizedName),
          ),
      );
      await expectNamespaceIndexes(client);
      await expectLegacyProductNameColumns(client, true);
    });
  });

  it('contracts an expanded schema without changing namespace data', async () => {
    await withTemporarySchema(async (client) => {
      await applyMigrations(client, previousMigrations);
      const productId = randomUUID();
      await client.query(
        'INSERT INTO "Product" ("id", "canonicalName", "aliases") VALUES ($1, $2, $3)',
        [productId, '3% Milk', ['Three Percent Milk']],
      );
      await applyMigration(client, NAMESPACE_MIGRATION);

      await applyMigration(client, CONTRACT_MIGRATION);

      const { rows } = await client.query<{
        displayName: string;
        kind: 'canonical' | 'alias';
      }>(
        'SELECT "displayName", "kind" FROM "ProductName" WHERE "productId" = $1 ORDER BY "kind"',
        [productId],
      );
      expect(rows).toEqual([
        { displayName: '3% Milk', kind: 'canonical' },
        { displayName: 'Three Percent Milk', kind: 'alias' },
      ]);
      await expectLegacyProductNameColumns(client, false);
    });
  });

  it.each([
    {
      label: 'no canonical namespace row',
      insertCorruption: async (client: Client, productId: string) => {
        await client.query(
          'INSERT INTO "ProductName" ("id", "productId", "displayName", "normalizedName", "kind") VALUES ($1, $2, $3, $4, $5)',
          [randomUUID(), productId, 'Milk Alias', 'milk alias', 'alias'],
        );
      },
    },
    {
      label: 'multiple canonical namespace rows',
      insertCorruption: async (client: Client, productId: string) => {
        await client.query(
          'DROP INDEX "ProductName_one_canonical_per_product"',
        );
        await client.query(
          'INSERT INTO "ProductName" ("id", "productId", "displayName", "normalizedName", "kind") VALUES ($1, $2, $3, $4, $5), ($6, $2, $7, $8, $5)',
          [
            randomUUID(),
            productId,
            'Milk',
            'milk',
            'canonical',
            randomUUID(),
            'Whole Milk',
            'whole milk',
          ],
        );
      },
    },
  ])(
    'rejects $label before removing legacy columns',
    async ({ insertCorruption }) => {
      await withTemporarySchema(async (client) => {
        await applyMigrations(client, expandedMigrations);
        const productId = randomUUID();
        await client.query(
          'INSERT INTO "Product" ("id", "canonicalName", "aliases") VALUES ($1, $2, $3)',
          [productId, 'Milk', []],
        );
        await insertCorruption(client, productId);

        await expect(
          applyMigration(client, CONTRACT_MIGRATION),
        ).rejects.toThrow('every product must have exactly one canonical name');
        await expectLegacyProductNameColumns(client, true);
      });
    },
  );

  it.each([
    {
      label: 'a blank canonical name',
      products: [{ canonicalName: '   ', aliases: [] }],
      diagnostic: 'blank product name',
    },
    {
      label: 'a duplicate name within one product',
      products: [{ canonicalName: 'Milk', aliases: [' milk '] }],
      diagnostic: 'duplicate normalized name within one product',
    },
    {
      label: 'one normalized name owned by two products',
      products: [
        { canonicalName: 'Milk', aliases: [] },
        { canonicalName: 'ＭＩＬＫ', aliases: [] },
      ],
      diagnostic: 'normalized name belongs to multiple products',
    },
  ])(
    'rejects $label before committing namespace data',
    async ({ products, diagnostic }) => {
      await withTemporarySchema(async (client) => {
        await applyMigrations(client, previousMigrations);
        for (const product of products) {
          await client.query(
            'INSERT INTO "Product" ("id", "canonicalName", "aliases") VALUES ($1, $2, $3)',
            [randomUUID(), product.canonicalName, product.aliases],
          );
        }

        await expect(
          applyMigration(client, NAMESPACE_MIGRATION),
        ).rejects.toThrow(diagnostic);
        const { rows } = await client.query<{ exists: boolean }>(
          'SELECT to_regclass(\'"ProductName"\') IS NOT NULL AS exists',
        );
        expect(rows[0].exists).toBe(false);
      });
    },
  );

  async function withTemporarySchema(
    operation: (client: Client) => Promise<void>,
  ): Promise<void> {
    const schema = `product_name_${randomUUID().replaceAll('-', '')}`;
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

async function expectNamespaceIndexes(client: Client): Promise<void> {
  const { rows } = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'ProductName' ORDER BY indexname",
  );
  expect(rows.map(({ indexname }) => indexname)).toEqual(
    expect.arrayContaining([
      'ProductName_normalizedName_key',
      'ProductName_one_canonical_per_product',
      'ProductName_productId_idx',
    ]),
  );
}

async function expectLegacyProductNameColumns(
  client: Client,
  expected: boolean,
): Promise<void> {
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'Product'
       AND column_name IN ('canonicalName', 'aliases')
     ORDER BY column_name`,
  );
  expect(rows.map(({ column_name }) => column_name)).toEqual(
    expected ? ['aliases', 'canonicalName'] : [],
  );
}
