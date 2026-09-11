/**
 * Real PostgreSQL integration tests. Every database operation uses PostgreSQL;
 * the response-race tests wrap an update only to schedule a second real write.
 *
 * Opt in with INGREDIENT_TEST_DATABASE_URL pointing to a disposable PostgreSQL
 * instance. Example:
 * INGREDIENT_TEST_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/recipecost_test npm test
 *
 * The suite never uses DATABASE_URL. It creates a randomly named schema, builds
 * the actual entity tables there, and drops only that schema during cleanup.
 * Without the explicit test URL, only this integration suite is skipped.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import { QueryFailedError, type QueryRunner } from 'typeorm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../schemas/env.schema', () => ({
  env: {
    DATABASE_URL:
      process.env.INGREDIENT_TEST_DATABASE_URL ??
      'postgresql://unused:unused@127.0.0.1:1/unused',
  },
}));

vi.mock('../middleware/logging.middleware', async () => {
  const { default: pino } = await import('pino');
  return { logger: pino({ level: 'silent' }) };
});

vi.mock('./auth.routes', async () => {
  const { Router } = await import('express');
  return { authRoutes: Router() };
});
vi.mock('../middleware/session.middleware', () => ({
  sessionMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { app } from '../app';
import { AppDataSource } from '../data-source';
import { Ingredient } from '../entities/Ingredient';
import { IngredientCategory } from '../entities/IngredientCategory';
import { IngredientProduct } from '../entities/IngredientProduct';
import { IngredientUnitConversion } from '../entities/IngredientUnitConversion';
import { Unit } from '../entities/Unit';
import { User } from '../entities/User';
import { ProductPrice } from '../entities/ProductPrice';
import { StoreLocation } from '../entities/StoreLocation';
import { Retailer } from '../entities/Retailer';
import { ingredientRepository } from '../repositories/ingredient.repo';

const testUrl = process.env.INGREDIENT_TEST_DATABASE_URL;
const schema = `ingredient_tests_${randomUUID().replaceAll('-', '')}`;
const ingredientsTable = `"${schema}"."ingredients"`;

describe.skipIf(!testUrl)('ingredients API with real PostgreSQL', () => {
  beforeAll(async () => {
    AppDataSource.setOptions({
      schema,
      // Use the test URL's TLS settings instead of the development DB defaults.
      ssl: undefined,
      synchronize: false,
      // Import entities through Vitest instead of loading .ts globs via Node.
      entities: [
        Ingredient,
        IngredientCategory,
        IngredientProduct,
        IngredientUnitConversion,
        Unit,
        User,
        ProductPrice,
        StoreLocation,
        Retailer,
      ],
      migrations: [],
      extra: {
        max: 10,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
        lock_timeout: 8000,
      },
    });
    await AppDataSource.initialize();
    await AppDataSource.query(`CREATE SCHEMA "${schema}"`);
    await AppDataSource.synchronize();
  }, 30000);

  beforeEach(async () => {
    await AppDataSource.query(
      `TRUNCATE TABLE ${ingredientsTable}, "${schema}"."ingredient_categories", "${schema}"."units", "${schema}"."users" RESTART IDENTITY CASCADE`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await AppDataSource.destroy();
      }
    }
  });

  async function seedIngredient(
    overrides: Partial<Ingredient> = {},
  ): Promise<Ingredient> {
    return ingredientRepository.save(
      ingredientRepository.create({
        name: 'Flour',
        categoryId: null,
        description: 'Original description',
        ...overrides,
      }),
    );
  }

  async function seedCategory() {
    const repository = AppDataSource.getRepository(IngredientCategory);
    return repository.save(repository.create({ name: 'Baking' }));
  }

  async function seedUnit(name = 'Gram', abbreviation = 'g') {
    const repository = AppDataSource.getRepository(Unit);
    return repository.save(
      repository.create({
        name,
        abbreviation,
        unitType: 'weight',
        conversionToBase: '1',
      }),
    );
  }

  async function seedProduct(ingredient: Ingredient) {
    const unit = await seedUnit();
    const users = AppDataSource.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `ingredient-fixture-${randomUUID()}@example.com`,
        passwordHash: 'not-used-for-authentication-in-ingredient-tests',
      }),
    );
    const repository = AppDataSource.getRepository(IngredientProduct);
    return repository.save(
      repository.create({
        userId: owner.userId,
        ingredientId: ingredient.ingredientId,
        packageUnitId: unit.unitId,
        productName: 'Flour bag',
        packageQuantity: '1000',
        brand: null,
        upc: null,
      }),
    );
  }

  async function lockIngredient(ingredientId: string): Promise<QueryRunner> {
    const runner = AppDataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      await runner.query(
        `SELECT ingredient_id FROM ${ingredientsTable} WHERE ingredient_id = $1 FOR UPDATE`,
        [ingredientId],
      );
      return runner;
    } catch (error) {
      await releaseLock(runner);
      throw error;
    }
  }

  async function waitForBlockedUpdates(count: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [row] = await AppDataSource.query(
        `SELECT count(*)::integer AS count
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND wait_event_type = 'Lock'
           AND query LIKE $1`,
        [`UPDATE ${ingredientsTable}%`],
      );
      if (row.count >= count) return;
      await delay(20);
    }
    throw new Error(`Expected ${count} updates to wait on the held row lock`);
  }

  async function releaseLock(runner: QueryRunner) {
    try {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
    } finally {
      await runner.release();
    }
  }

  async function unwrapResponses<T>(
    pending: Promise<PromiseSettledResult<T>[]>,
  ): Promise<T[]> {
    return (await pending).map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
  }

  it('creates persisted defaults and returns the same record through GET', async () => {
    const created = await request(app)
      .post('/api/ingredients')
      .send({ name: '  Flour  ' });

    expect(created.status).toBe(201);
    expect(created.body.data).toEqual({
      ingredientId: expect.any(String),
      name: 'Flour',
      categoryId: null,
      description: null,
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(created.body.data.createdAt))).toBe(false);

    const fetched = await request(app).get(
      `/api/ingredients/${created.body.data.ingredientId}`,
    );
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).toEqual(created.body.data);
    expect(await ingredientRepository.count()).toBe(1);
  });

  it('persists a valid category and trimmed description', async () => {
    const category = await seedCategory();
    const response = await request(app).post('/api/ingredients').send({
      name: 'Flour',
      categoryId: category.categoryId,
      description: '  For bread  ',
    });
    expect(response.status).toBe(201);
    const stored = await ingredientRepository.findOneByOrFail({
      ingredientId: response.body.data.ingredientId,
    });
    expect(stored).toMatchObject({
      categoryId: category.categoryId,
      description: 'For bread',
      version: 1,
    });
  });

  it('lists persisted ingredients in name order', async () => {
    await seedIngredient({ name: 'Sugar' });
    await seedIngredient({ name: 'Butter' });
    const response = await request(app).get('/api/ingredients');
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: Ingredient) => row.name)).toEqual([
      'Butter',
      'Sugar',
    ]);
  });

  it('preserves bigint identity precision through GET, PATCH, and DELETE', async () => {
    const ingredientId = '9007199254740993';
    await AppDataSource.query(
      `INSERT INTO ${ingredientsTable} (ingredient_id, name)
       OVERRIDING SYSTEM VALUE VALUES ($1, $2)`,
      [ingredientId, 'Flour'],
    );
    const fetched = await request(app).get(`/api/ingredients/${ingredientId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.ingredientId).toBe(ingredientId);

    const patched = await request(app)
      .patch(`/api/ingredients/${ingredientId}`)
      .send({ name: 'Bread flour', version: 1 });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ ingredientId, version: 2 });

    const deleted = await request(app).delete(
      `/api/ingredients/${ingredientId}`,
    );
    expect(deleted.status).toBe(204);
    expect(await ingredientRepository.count()).toBe(0);
  });

  it('translates a real unique constraint violation without adding another row', async () => {
    await seedIngredient();
    const response = await request(app)
      .post('/api/ingredients')
      .send({ name: ' Flour ' });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'error',
      message: 'An ingredient with this name already exists.',
    });
    expect(await ingredientRepository.count()).toBe(1);
  });

  it('allows exactly one of two simultaneous creates for the same name', async () => {
    const responses = await Promise.all([
      request(app).post('/api/ingredients').send({ name: 'Flour' }),
      request(app).post('/api/ingredients').send({ name: 'Flour' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await ingredientRepository.count()).toBe(1);
  });

  it('rejects a nonexistent category through the real foreign key', async () => {
    const response = await request(app).post('/api/ingredients').send({
      name: 'Flour',
      categoryId: 123,
    });
    expect(response.status).toBe(409);
    expect(response.body.message).not.toMatch(/23503|INSERT|constraint|FK_/);
    expect(await ingredientRepository.count()).toBe(0);
  });

  it('updates only the patch fields, increments version, and returns database values', async () => {
    const category = await seedCategory();
    const ingredient = await seedIngredient({
      categoryId: category.categoryId,
    });
    const other = await seedIngredient({ name: 'Sugar' });

    const response = await request(app)
      .patch(`/api/ingredients/${ingredient.ingredientId}`)
      .send({ name: 'Bread flour', version: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      ingredientId: ingredient.ingredientId,
      name: 'Bread flour',
      description: 'Original description',
      categoryId: category.categoryId,
      version: 2,
      createdAt: ingredient.createdAt.toISOString(),
    });
    const stored = await ingredientRepository.findOneByOrFail({
      ingredientId: ingredient.ingredientId,
    });
    expect(response.body.data).toEqual(JSON.parse(JSON.stringify(stored)));
    expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(
      ingredient.updatedAt.getTime(),
    );
    expect(
      await ingredientRepository.findOneByOrFail({
        ingredientId: other.ingredientId,
      }),
    ).toMatchObject({ name: 'Sugar', version: 1 });
  });

  it('clears explicitly null fields and accepts the returned version for the next edit', async () => {
    const category = await seedCategory();
    const ingredient = await seedIngredient({
      categoryId: category.categoryId,
    });
    const cleared = await request(app)
      .patch(`/api/ingredients/${ingredient.ingredientId}`)
      .send({ categoryId: null, description: null, version: 1 });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({
      name: 'Flour',
      categoryId: null,
      description: null,
      version: 2,
    });
    const next = await request(app)
      .patch(`/api/ingredients/${ingredient.ingredientId}`)
      .send({
        description: 'New description',
        version: cleared.body.data.version,
      });
    expect(next.status).toBe(200);
    expect(next.body.data).toMatchObject({
      description: 'New description',
      version: 3,
    });
  });

  it.each([1, 3])(
    'rejects mismatched version %i without changing the row',
    async (version) => {
      const ingredient = await seedIngredient();
      const first = await request(app)
        .patch(`/api/ingredients/${ingredient.ingredientId}`)
        .send({ description: 'Accepted description', version: 1 });
      expect(first.status).toBe(200);
      const rejected = await request(app)
        .patch(`/api/ingredients/${ingredient.ingredientId}`)
        .send({ name: 'Must not persist', version });
      expect(rejected.status).toBe(409);
      expect(rejected.body.message).toContain('Reload');
      expect(
        await ingredientRepository.findOneByOrFail({
          ingredientId: ingredient.ingredientId,
        }),
      ).toMatchObject({
        name: 'Flour',
        description: 'Accepted description',
        version: 2,
      });
    },
  );

  it('distinguishes a deleted ingredient from an existing stale version', async () => {
    const ingredient = await seedIngredient();
    await ingredientRepository.delete({
      ingredientId: ingredient.ingredientId,
    });
    const response = await request(app)
      .patch(`/api/ingredients/${ingredient.ingredientId}`)
      .send({ name: 'Must not be inserted', version: 1 });
    expect(response.status).toBe(404);
    expect(await ingredientRepository.count()).toBe(0);
  });

  it.each([
    ['duplicate name', { name: 'Sugar' }],
    ['nonexistent category', { categoryId: 123 }],
  ])(
    'rolls back the entire update for a %s, including its version increment',
    async (_label, patch) => {
      const ingredient = await seedIngredient();
      await seedIngredient({ name: 'Sugar' });
      const response = await request(app)
        .patch(`/api/ingredients/${ingredient.ingredientId}`)
        .send({ ...patch, description: 'Must not persist', version: 1 });
      expect(response.status).toBe(409);
      expect(
        await ingredientRepository.findOneByOrFail({
          ingredientId: ingredient.ingredientId,
        }),
      ).toMatchObject({
        name: 'Flour',
        categoryId: null,
        description: 'Original description',
        version: 1,
      });
    },
  );

  it('rejects invalid requests before they can increment the version', async () => {
    const ingredient = await seedIngredient();
    for (const body of [
      { version: 1 },
      { name: 'Changed' },
      { name: 'Changed', version: '1' },
    ]) {
      const response = await request(app)
        .patch(`/api/ingredients/${ingredient.ingredientId}`)
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(
      await ingredientRepository.findOneByOrFail({
        ingredientId: ingredient.ingredientId,
      }),
    ).toMatchObject({ name: 'Flour', version: 1 });
  });

  it('deletes an unreferenced ingredient and returns 404 for a repeated delete', async () => {
    const ingredient = await seedIngredient();
    const removed = await request(app).delete(
      `/api/ingredients/${ingredient.ingredientId}`,
    );
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');
    expect(await ingredientRepository.count()).toBe(0);
    expect(
      (await request(app).delete(`/api/ingredients/${ingredient.ingredientId}`))
        .status,
    ).toBe(404);
  });

  it('restricts deletion while a product references the ingredient', async () => {
    const ingredient = await seedIngredient();
    await seedProduct(ingredient);
    const blocked = await request(app).delete(
      `/api/ingredients/${ingredient.ingredientId}`,
    );
    expect(await ingredientRepository.count()).toBe(1);
    expect(await AppDataSource.getRepository(IngredientProduct).count()).toBe(
      1,
    );
    expect(blocked.status).toBe(409);
  });

  it('allows deleting the ingredient after its product references are removed', async () => {
    const ingredient = await seedIngredient();
    const product = await seedProduct(ingredient);
    await AppDataSource.getRepository(IngredientProduct).delete({
      productId: product.productId,
    });
    const removed = await request(app).delete(
      `/api/ingredients/${ingredient.ingredientId}`,
    );
    expect(removed.status).toBe(204);
  });

  it('cascades deletion to ingredient-specific unit conversions', async () => {
    const ingredient = await seedIngredient();
    const from = await seedUnit();
    const to = await seedUnit('Kilogram', 'kg');
    const conversions = AppDataSource.getRepository(IngredientUnitConversion);
    await conversions.save(
      conversions.create({
        ingredientId: ingredient.ingredientId,
        fromUnitId: from.unitId,
        toUnitId: to.unitId,
        conversionFactor: '0.001',
      }),
    );
    expect(
      (await request(app).delete(`/api/ingredients/${ingredient.ingredientId}`))
        .status,
    ).toBe(204);
    expect(await conversions.count()).toBe(0);
  });

  it.each([
    ['same field', { name: 'Bread flour' }, { name: 'Cake flour' }],
    [
      'different fields',
      { name: 'Bread flour' },
      { description: 'Second editor' },
    ],
  ])(
    'allows one winner for concurrent edits to %s using the same version',
    async (_label, firstPatch, secondPatch) => {
      const ingredient = await seedIngredient();
      const blocker = await lockIngredient(ingredient.ingredientId);
      const pending = Promise.allSettled(
        [firstPatch, secondPatch].map((patch) =>
          request(app)
            .patch(`/api/ingredients/${ingredient.ingredientId}`)
            .send({ ...patch, version: 1 })
            .then((response) => response),
        ),
      );

      try {
        // Both statements must actually overlap before the lock is released.
        await waitForBlockedUpdates(2);
        await blocker.commitTransaction();
        const responses = await unwrapResponses(pending);
        expect(responses.map((response) => response.status).sort()).toEqual([
          200, 409,
        ]);
        const winnerIndex = responses.findIndex(
          (response) => response.status === 200,
        );
        const winner = responses[winnerIndex];
        const stored = await ingredientRepository.findOneByOrFail({
          ingredientId: ingredient.ingredientId,
        });
        expect(stored).toMatchObject({
          name: ingredient.name,
          description: ingredient.description,
          categoryId: ingredient.categoryId,
          ...[firstPatch, secondPatch][winnerIndex],
          version: 2,
        });
        expect(JSON.parse(JSON.stringify(stored))).toEqual(winner.body.data);
      } finally {
        try {
          await releaseLock(blocker);
        } finally {
          await pending;
        }
      }
    },
    15000,
  );

  it('does not recreate a row deleted while the update waits for its lock', async () => {
    const ingredient = await seedIngredient();
    const blocker = await lockIngredient(ingredient.ingredientId);
    const pending = Promise.allSettled([
      request(app)
        .patch(`/api/ingredients/${ingredient.ingredientId}`)
        .send({ name: 'Must not be inserted', version: 1 })
        .then((response) => response),
    ]);
    try {
      await waitForBlockedUpdates(1);
      await blocker.query(
        `DELETE FROM ${ingredientsTable} WHERE ingredient_id = $1`,
        [ingredient.ingredientId],
      );
      await blocker.commitTransaction();
      const [response] = await unwrapResponses(pending);
      expect(response.status).toBe(404);
      expect(await ingredientRepository.count()).toBe(0);
    } finally {
      try {
        await releaseLock(blocker);
      } finally {
        await pending;
      }
    }
  }, 15000);

  it.each(['update', 'delete'] as const)(
    'returns its own updated row even if another %s occurs immediately afterward',
    async (operation) => {
      const ingredient = await seedIngredient();
      const originalUpdate =
        ingredientRepository.update.bind(ingredientRepository);
      vi.spyOn(ingredientRepository, 'update').mockImplementationOnce(
        async (...args) => {
          const result = await originalUpdate(...args);
          // Interleave a real second database write after UPDATE RETURNING completes.
          if (operation === 'update') {
            await AppDataSource.query(
              `UPDATE ${ingredientsTable} SET name = $1, version = version + 1 WHERE ingredient_id = $2`,
              ['Later edit', ingredient.ingredientId],
            );
          } else {
            await AppDataSource.query(
              `DELETE FROM ${ingredientsTable} WHERE ingredient_id = $1`,
              [ingredient.ingredientId],
            );
          }
          return result;
        },
      );

      const response = await request(app)
        .patch(`/api/ingredients/${ingredient.ingredientId}`)
        .send({ name: 'My edit', version: 1 });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ name: 'My edit', version: 2 });
      const stored = await ingredientRepository.findOneBy({
        ingredientId: ingredient.ingredientId,
      });
      if (operation === 'update') {
        expect(stored).toMatchObject({ name: 'Later edit', version: 3 });
      } else {
        expect(stored).toBeNull();
      }
    },
  );

  it('enforces database uniqueness independently of HTTP validation', async () => {
    await seedIngredient();
    await expect(seedIngredient()).rejects.toMatchObject({
      driverError: { code: '23505', constraint: 'uq_ingredients_name' },
    });
  });

  it('enforces the database name length even when HTTP validation is bypassed', async () => {
    await expect(
      seedIngredient({ name: 'x'.repeat(101) }),
    ).rejects.toMatchObject({
      driverError: { code: '22001' },
    });
  });

  it('enforces the required name independently of HTTP validation', async () => {
    await expect(
      AppDataSource.query(
        `INSERT INTO ${ingredientsTable} (name) VALUES ($1)`,
        [null],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23502' } });
    expect(await ingredientRepository.count()).toBe(0);
  });

  it('exposes actual PostgreSQL failures as TypeORM QueryFailedError instances', async () => {
    await expect(seedIngredient({ categoryId: 123 })).rejects.toBeInstanceOf(
      QueryFailedError,
    );
  });
});
