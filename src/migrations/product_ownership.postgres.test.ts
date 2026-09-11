/**
 * Opt in with PRODUCT_TEST_DATABASE_URL pointing at a disposable PostgreSQL DB.
 * Runs the actual ownership migration against minimal legacy table fixtures.
 * All objects live in a random schema; application env files are never loaded.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource, type QueryRunner } from 'typeorm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { CreateUsers1789107087042 } from './1789107087042-CreateUsers';

const databaseUrl = process.env.PRODUCT_TEST_DATABASE_URL;
const schema = `product_migration_tests_${randomUUID().replaceAll('-', '')}`;
const aliceId = '9007199254740993';
const bobId = '9007199254740994';
const migration = new CreateUsers1789107087042();

describe.skipIf(!databaseUrl)(
  'product ownership migration with PostgreSQL',
  () => {
    let source: DataSource | undefined;
    let runner: QueryRunner | undefined;

    beforeAll(async () => {
      source = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        schema,
        entities: [],
        synchronize: false,
        logging: false,
        extra: { connectionTimeoutMillis: 5000, statement_timeout: 10000 },
      });
      await source.initialize();
      runner = source.createQueryRunner();
      await runner.connect();
    }, 15000);

    beforeEach(async () => {
      await runner!.query(`CREATE SCHEMA "${schema}"`);
      // The migration uses unqualified tables. Excluding public isolates all SQL.
      await runner!.query(`SET search_path TO "${schema}"`);
      await runner!.query(`
      CREATE TABLE "users" (
        "user_id" bigint PRIMARY KEY
      )
    `);
      await runner!.query(`
      CREATE TABLE "ingredient_products" (
        "product_id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "product_name" text NOT NULL,
        "upc" varchar(20),
        CONSTRAINT "uq_product_upc" UNIQUE ("upc")
      )
    `);
      await runner!.query('INSERT INTO "users" ("user_id") VALUES ($1), ($2)', [
        aliceId,
        bobId,
      ]);
    });

    afterEach(async () => {
      if (runner && !runner.isReleased) {
        if (runner.isTransactionActive) {
          await runner.rollbackTransaction();
        }
        await runner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
    });

    afterAll(async () => {
      try {
        if (runner && !runner.isReleased) {
          await runner.release();
        }
      } finally {
        if (source?.isInitialized) {
          await source.destroy();
        }
      }
    });

    const runMigration = async (direction: 'up' | 'down') => {
      await runner!.startTransaction();
      try {
        await migration[direction](runner!);
        await runner!.commitTransaction();
      } catch (error) {
        await runner!.rollbackTransaction();
        throw error;
      }
    };

    const snapshot = async () => ({
      columns: await runner!.query(
        `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'ingredient_products'
       ORDER BY ordinal_position`,
        [schema],
      ),
      constraints: await runner!.query(
        `SELECT constraint_name, constraint_type
       FROM information_schema.table_constraints
       WHERE table_schema = $1 AND table_name = 'ingredient_products'
       ORDER BY constraint_name`,
        [schema],
      ),
      indexes: await runner!.query(
        `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = $1 AND tablename = 'ingredient_products'
       ORDER BY indexname`,
        [schema],
      ),
      products: await runner!.query(
        'SELECT * FROM "ingredient_products" ORDER BY "product_id"',
      ),
      users: await runner!.query('SELECT * FROM "users" ORDER BY "user_id"'),
    });

    const insertOwnedProduct = (userId: string | null, upc: string | null) =>
      runner!.query(
        'INSERT INTO "ingredient_products" ("product_name", "user_id", "upc") VALUES ($1, $2, $3)',
        ['Flour', userId, upc],
      );

    it('migrates an empty table and enforces required existing owners and UPC uniqueness per user', async () => {
      await runMigration('up');

      await expect(insertOwnedProduct(null, '000123')).rejects.toMatchObject({
        driverError: { code: '23502', column: 'user_id' },
      });
      await expect(insertOwnedProduct('999', '000123')).rejects.toMatchObject({
        driverError: { code: '23503' },
      });

      await insertOwnedProduct(aliceId, '000123');
      await insertOwnedProduct(bobId, '000123');
      await expect(insertOwnedProduct(aliceId, '000123')).rejects.toMatchObject(
        {
          driverError: { code: '23505', constraint: 'uq_product_user_upc' },
        },
      );
      await insertOwnedProduct(aliceId, null);
      await insertOwnedProduct(aliceId, null);
      await insertOwnedProduct(bobId, null);

      const rows = await runner!.query(
        'SELECT "user_id", "upc" FROM "ingredient_products" ORDER BY "product_id"',
      );
      expect(rows).toEqual([
        { user_id: aliceId, upc: '000123' },
        { user_id: bobId, upc: '000123' },
        { user_id: aliceId, upc: null },
        { user_id: aliceId, upc: null },
        { user_id: bobId, upc: null },
      ]);
      await expect(
        runner!.query('DELETE FROM "users" WHERE "user_id" = $1', [aliceId]),
      ).rejects.toMatchObject({
        driverError: { code: expect.stringMatching(/^(23001|23503)$/) },
      });
    });

    it('fails atomically with existing unowned products instead of inventing an owner', async () => {
      await runner!.query(
        'INSERT INTO "ingredient_products" ("product_name", "upc") VALUES ($1, $2)',
        ['Legacy flour', '000123'],
      );
      const before = await snapshot();

      await expect(runMigration('up')).rejects.toMatchObject({
        driverError: { code: '23502', column: 'user_id' },
      });

      expect(runner!.isTransactionActive).toBe(false);
      expect(await snapshot()).toEqual(before);
      await expect(
        runner!.query(
          'INSERT INTO "ingredient_products" ("product_name", "upc") VALUES ($1, $2)',
          ['Duplicate legacy flour', '000123'],
        ),
      ).rejects.toMatchObject({
        driverError: { code: '23505', constraint: 'uq_product_upc' },
      });
    });

    it('round-trips an empty schema and safely downgrades products with globally unique UPCs', async () => {
      const legacySchema = await snapshot();
      await runMigration('up');
      await runMigration('down');
      expect(await snapshot()).toEqual(legacySchema);

      await runMigration('up');
      await insertOwnedProduct(aliceId, '000123');
      await insertOwnedProduct(bobId, '000456');
      await insertOwnedProduct(aliceId, null);
      await insertOwnedProduct(bobId, null);
      const expectedRows = await runner!.query(
        'SELECT "product_id", "product_name", "upc" FROM "ingredient_products" ORDER BY "product_id"',
      );

      await runMigration('down');

      const restored = await snapshot();
      expect(restored.columns).toEqual(legacySchema.columns);
      expect(restored.constraints).toEqual(legacySchema.constraints);
      expect(restored.indexes).toEqual(legacySchema.indexes);
      expect(restored.products).toEqual(expectedRows);
      expect(restored.users).toEqual(legacySchema.users);
      await expect(
        runner!.query(
          'INSERT INTO "ingredient_products" ("product_name", "upc") VALUES ($1, $2)',
          ['Duplicate flour', '000123'],
        ),
      ).rejects.toMatchObject({
        driverError: { code: '23505', constraint: 'uq_product_upc' },
      });
    });

    it('rolls back every downgrade change if UPCs conflict across owners', async () => {
      await runMigration('up');
      await insertOwnedProduct(aliceId, '000123');
      await insertOwnedProduct(bobId, '000123');
      const before = await snapshot();

      await expect(runMigration('down')).rejects.toMatchObject({
        driverError: { code: '23505', constraint: 'uq_product_upc' },
      });

      expect(runner!.isTransactionActive).toBe(false);
      expect(await snapshot()).toEqual(before);
      await expect(insertOwnedProduct(aliceId, '000123')).rejects.toMatchObject(
        {
          driverError: { code: '23505', constraint: 'uq_product_user_upc' },
        },
      );
      await expect(insertOwnedProduct('999', '000789')).rejects.toMatchObject({
        driverError: { code: '23503' },
      });
    });
  },
);
