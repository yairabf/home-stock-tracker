import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migration = '20261005000000_nullable_product_perishability';
describe('nullable product perishability migration', () => {
  it('preserves existing booleans and leaves new omitted values unknown', async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error(
        'This test requires a dedicated database ending in _test',
      );
    const client = new Client({ connectionString: url });
    await client.connect();
    await client.query('BEGIN');
    try {
      const schema = `perishability_${randomUUID().replaceAll('-', '')}`;
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      const directory = join(process.cwd(), 'prisma/migrations');
      const migrations = readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const name of migrations.filter((name) => name < migration))
        await client.query(
          readFileSync(join(directory, name, 'migration.sql'), 'utf8').replace(
            /^BEGIN;|^COMMIT;/gm,
            '',
          ),
        );
      await client.query(
        'INSERT INTO "Product" (id, "isPerishable") VALUES ($1, true), ($2, false)',
        ['old_true', 'old_false'],
      );
      await client.query(
        readFileSync(join(directory, migration, 'migration.sql'), 'utf8'),
      );
      await client.query('INSERT INTO "Product" (id) VALUES ($1)', [
        'new_unknown',
      ]);
      const { rows } = await client.query(
        'SELECT id, "isPerishable" FROM "Product" ORDER BY id',
      );
      expect(rows).toEqual([
        { id: 'new_unknown', isPerishable: null },
        { id: 'old_false', isPerishable: false },
        { id: 'old_true', isPerishable: true },
      ]);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  });
});
