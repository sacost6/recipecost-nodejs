import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ingredient } from '../entities/Ingredient';
import type { IngredientRow } from '../services/ingredients.service';
import { app } from '../app';

const repository = vi.hoisted(() => ({
  find: vi.fn(),
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  existsBy: vi.fn(),
  delete: vi.fn(),
}));

// Exercise actual routing, validation, controllers, services and error handling.
// Repository stubs do not prove database constraints or concurrency guarantees;
// separate PostgreSQL integration tests exercise those behaviors.
vi.mock('../repositories/ingredient.repo', () => ({
  ingredientRepository: repository,
}));
// These tests cover ingredients; authentication has its own HTTP/session suite.
vi.mock('./auth.routes', async () => {
  const { Router } = await import('express');
  return { authRoutes: Router() };
});
vi.mock('./ingredient_products.routes', async () => {
  const { Router } = await import('express');
  return { ingredientProductRoutes: Router() };
});
vi.mock('../middleware/session.middleware', () => ({
  sessionMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../middleware/logging.middleware', async () => {
  const { default: pino } = await import('pino');
  return { logger: pino({ level: 'silent' }) };
});

const ingredientId = '9007199254740993';
const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T04:05:06.000Z');

const ingredient = (overrides: Partial<Ingredient> = {}): Ingredient =>
  Object.assign(new Ingredient(), {
    ingredientId,
    name: 'Flour',
    categoryId: 3,
    description: 'Unbleached flour',
    createdAt,
    updatedAt: createdAt,
    version: 7,
    ...overrides,
  });

const returnedRow = (
  overrides: Partial<IngredientRow> = {},
): IngredientRow => ({
  ingredient_id: ingredientId,
  category_id: 3,
  name: 'Bread flour',
  description: 'Unbleached flour',
  created_at: createdAt,
  updated_at: updatedAt,
  version: 8,
  ...overrides,
});

const jsonIngredient = (value: Ingredient) => ({
  ingredientId: value.ingredientId,
  categoryId: value.categoryId,
  name: value.name,
  description: value.description,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
  version: value.version,
});

const databaseError = (code: string, constraint?: string) =>
  new QueryFailedError(
    'UPDATE ingredients SET name = $1',
    ['private ingredient name'],
    Object.assign(new Error('private database failure'), {
      code,
      constraint,
      detail: 'private row details',
      table: 'ingredients',
    }),
  );

const expectNoRepositoryCalls = () => {
  for (const operation of Object.values(repository)) {
    expect(operation).not.toHaveBeenCalled();
  }
};

const endpoint = (method: string) =>
  method === 'post' ? '/api/ingredients' : `/api/ingredients/${ingredientId}`;

const validBody = (method: string) =>
  method === 'patch' ? { name: 'Flour', version: 7 } : { name: 'Flour' };

describe('ingredients API (repository mocked)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    repository.find.mockResolvedValue([]);
    repository.findOneBy.mockResolvedValue(null);
    repository.create.mockImplementation((values: Partial<Ingredient>) =>
      Object.assign(new Ingredient(), values),
    );
    repository.save.mockImplementation(async (value: Ingredient) =>
      Object.assign(value, {
        ingredientId,
        createdAt,
        updatedAt: createdAt,
        version: 1,
      }),
    );
    repository.update.mockResolvedValue({ affected: 1, raw: [returnedRow()] });
    repository.existsBy.mockResolvedValue(false);
    repository.delete.mockResolvedValue({ affected: 1, raw: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET /api/ingredients', () => {
    it('returns an empty list instead of a 404 when no ingredients exist', async () => {
      const response = await request(app).get('/api/ingredients');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'success', data: [] });
    });

    it('requests alphabetical order and serializes the current entity fields', async () => {
      const flour = ingredient();
      const salt = ingredient({ ingredientId: '2', name: 'Salt', version: 1 });
      repository.find.mockResolvedValue([flour, salt]);
      const response = await request(app).get('/api/ingredients');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        status: 'success',
        data: [jsonIngredient(flour), jsonIngredient(salt)],
      });
      expect(repository.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });
  });

  describe('GET /api/ingredients/:ingredientId', () => {
    it.each(['1', ingredientId, '9223372036854775807'])(
      'preserves valid bigint ID %s as an exact string',
      async (id) => {
        const stored = ingredient({ ingredientId: id });
        repository.findOneBy.mockResolvedValue(stored);
        const response = await request(app).get(`/api/ingredients/${id}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          status: 'success',
          data: jsonIngredient(stored),
        });
        expect(repository.findOneBy).toHaveBeenCalledWith({ ingredientId: id });
      },
    );

    it('trims a valid ID before querying the repository', async () => {
      repository.findOneBy.mockResolvedValue(ingredient());
      const response = await request(app).get(
        `/api/ingredients/${encodeURIComponent(` ${ingredientId} `)}`,
      );
      expect(response.status).toBe(200);
      expect(repository.findOneBy).toHaveBeenCalledWith({ ingredientId });
    });

    it('returns a JSON 404 for a valid ID that does not exist', async () => {
      const response = await request(app).get('/api/ingredients/123');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Ingredient not found',
      });
    });
  });

  describe.each(['get', 'patch', 'delete'] as const)(
    '%s invalid ingredient IDs',
    (method) => {
      it.each([
        'abc',
        '0',
        '-1',
        '01',
        '+1',
        '1.5',
        '1e3',
        '9223372036854775808',
        '99999999999999999999999999999999999999',
        ' ',
        '1 OR 1=1',
      ])('rejects %j before touching the database', async (id) => {
        const pending = request(app)[method](
          `/api/ingredients/${encodeURIComponent(id)}`,
        );
        const response = await (method === 'patch'
          ? pending.send(validBody(method))
          : pending);
        expect(response.status).toBe(400);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body).toEqual({
          status: 'error',
          message:
            'ID must be a positive integer no greater than 9223372036854775807',
        });
        expectNoRepositoryCalls();
      });
    },
  );

  describe('POST /api/ingredients', () => {
    it('defaults nullable fields and returns persisted ID, initial version and timestamps', async () => {
      const response = await request(app)
        .post('/api/ingredients')
        .send({ name: '  Flour  ' });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        status: 'success',
        data: jsonIngredient(
          ingredient({ categoryId: null, description: null, version: 1 }),
        ),
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Flour',
          categoryId: null,
          description: null,
        }),
      );
    });

    it('persists trimmed fields and a numeric category', async () => {
      const response = await request(app).post('/api/ingredients').send({
        name: '  Flour  ',
        categoryId: 3,
        description: '  Unbleached flour  ',
      });
      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(
        jsonIngredient(ingredient({ version: 1 })),
      );
    });

    it('accepts explicit nulls for nullable fields', async () => {
      const response = await request(app).post('/api/ingredients').send({
        name: 'Flour',
        categoryId: null,
        description: null,
      });
      expect(response.status).toBe(201);
      expect(response.body.data.categoryId).toBeNull();
      expect(response.body.data.description).toBeNull();
    });

    it('accepts the maximum name length and category ID', async () => {
      const response = await request(app)
        .post('/api/ingredients')
        .send({
          name: 'a'.repeat(100),
          categoryId: 32767,
        });
      expect(response.status).toBe(201);
      expect(response.body.data.name).toHaveLength(100);
      expect(response.body.data.categoryId).toBe(32767);
    });

    it.each([
      ['missing name', {}],
      ['empty name', { name: '' }],
      ['whitespace name', { name: ' \t ' }],
      ['name too long', { name: 'a'.repeat(101) }],
      ['null name', { name: null }],
      ['numeric name', { name: 42 }],
      ['string category', { name: 'Flour', categoryId: '3' }],
      ['zero category', { name: 'Flour', categoryId: 0 }],
      ['negative category', { name: 'Flour', categoryId: -1 }],
      ['fractional category', { name: 'Flour', categoryId: 1.5 }],
      ['oversized category', { name: 'Flour', categoryId: 32768 }],
      ['numeric description', { name: 'Flour', description: 42 }],
      ['unknown field', { name: 'Flour', unexpected: true }],
      ['obsolete unit', { name: 'Flour', unit: 'g' }],
      ['obsolete package size', { name: 'Flour', packageSize: 5000 }],
      ['obsolete package cost', { name: 'Flour', packageCost: 8.99 }],
      ['client-provided ID', { name: 'Flour', ingredientId: '1' }],
      ['client-provided version', { name: 'Flour', version: 1 }],
      ['client-provided timestamp', { name: 'Flour', createdAt }],
      ['array body', [{ name: 'Flour' }]],
    ])('rejects %s without a database operation', async (_label, body) => {
      const response = await request(app).post('/api/ingredients').send(body);
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toEqual(expect.any(String));
      expect(response.body.message.length).toBeGreaterThan(0);
      expect(response.body).not.toHaveProperty('stack');
      expectNoRepositoryCalls();
    });
  });

  describe('PATCH /api/ingredients/:ingredientId', () => {
    it('matches the expected version, changes only supplied fields and returns the written row', async () => {
      // Any follow-up read would return a different writer's newer result.
      repository.findOneBy.mockResolvedValue(
        ingredient({ name: 'Later edit', version: 9 }),
      );
      const response = await request(app)
        .patch(endpoint('patch'))
        .send({ name: '  Bread flour  ', version: 7 });
      expect(response.status).toBe(200);
      expect(repository.update).toHaveBeenCalledWith(
        { ingredientId, version: 7 },
        { name: 'Bread flour' },
        { returning: '*' },
      );
      expect(response.body).toEqual({
        status: 'success',
        data: jsonIngredient(
          ingredient({ name: 'Bread flour', updatedAt, version: 8 }),
        ),
      });
      expect(response.body.data).not.toHaveProperty('ingredient_id');
      expect(repository.findOneBy).not.toHaveBeenCalled();
      expect(repository.existsBy).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['categoryId', null],
      ['description', null],
      ['categoryId', 5],
      ['description', 'New description'],
      ['description', ''],
    ] as const)(
      'passes explicit %s=%j without clearing omitted fields',
      async (field, value) => {
        const row = returnedRow({
          name: 'Flour',
          ...(field === 'categoryId'
            ? { category_id: value as number | null }
            : { description: value as string | null }),
        });
        repository.update.mockResolvedValue({ affected: 1, raw: [row] });
        const response = await request(app)
          .patch(endpoint('patch'))
          .send({ [field]: value, version: 7 });
        expect(response.status).toBe(200);
        expect(repository.update).toHaveBeenCalledWith(
          { ingredientId, version: 7 },
          { [field]: value },
          { returning: '*' },
        );
        expect(response.body.data[field]).toBe(value);
        expect(response.body.data.name).toBe('Flour');
      },
    );

    it('accepts all editable fields together while keeping version out of the patch', async () => {
      repository.update.mockResolvedValue({
        affected: 1,
        raw: [
          returnedRow({ category_id: null, description: 'Fresh description' }),
        ],
      });
      const response = await request(app).patch(endpoint('patch')).send({
        name: 'Bread flour',
        categoryId: null,
        description: '  Fresh description  ',
        version: 7,
      });
      expect(response.status).toBe(200);
      expect(repository.update).toHaveBeenCalledWith(
        { ingredientId, version: 7 },
        {
          name: 'Bread flour',
          categoryId: null,
          description: 'Fresh description',
        },
        { returning: '*' },
      );
    });

    it('returns 409 when the ingredient exists but its version no longer matches', async () => {
      repository.update.mockResolvedValue({ affected: 0, raw: [] });
      repository.existsBy.mockResolvedValue(true);
      const response = await request(app)
        .patch(endpoint('patch'))
        .send(validBody('patch'));
      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        status: 'error',
        message: 'This ingredient has changed. Reload it before saving again.',
      });
      expect(repository.existsBy).toHaveBeenCalledWith({ ingredientId });
      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the update matches nothing and the ingredient is absent', async () => {
      repository.update.mockResolvedValue({ affected: 0, raw: [] });
      const response = await request(app)
        .patch(endpoint('patch'))
        .send(validBody('patch'));
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Ingredient not found',
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['missing version', { name: 'Bread flour' }],
      ['string version', { name: 'Bread flour', version: '7' }],
      ['null version', { name: 'Bread flour', version: null }],
      ['zero version', { name: 'Bread flour', version: 0 }],
      ['negative version', { name: 'Bread flour', version: -1 }],
      ['fractional version', { name: 'Bread flour', version: 1.5 }],
      ['oversized version', { name: 'Bread flour', version: 2147483648 }],
      ['empty patch', {}],
      ['version-only patch', { version: 7 }],
      ['blank name', { name: '  ', version: 7 }],
      ['null name', { name: null, version: 7 }],
      ['name too long', { name: 'a'.repeat(101), version: 7 }],
      ['invalid category', { categoryId: 32768, version: 7 }],
      ['numeric description', { description: 42, version: 7 }],
      ['unknown field', { name: 'Flour', unknown: true, version: 7 }],
      ['ID overwrite', { name: 'Flour', ingredientId: '2', version: 7 }],
      ['timestamp overwrite', { name: 'Flour', updatedAt, version: 7 }],
    ])('rejects %s before the update', async (_label, body) => {
      const response = await request(app).patch(endpoint('patch')).send(body);
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toEqual(expect.any(String));
      expectNoRepositoryCalls();
    });
  });

  describe('DELETE /api/ingredients/:ingredientId', () => {
    it('deletes by exact ID and returns 204 with no body', async () => {
      const response = await request(app).delete(endpoint('delete'));
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(repository.delete).toHaveBeenCalledWith({ ingredientId });
      expect(repository.findOneBy).not.toHaveBeenCalled();
    });

    it('returns a JSON 404 when no row was deleted', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });
      const response = await request(app).delete(endpoint('delete'));
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Ingredient not found',
      });
    });
  });

  describe('repository failures through the HTTP error handler', () => {
    it.each(['post', 'patch'] as const)(
      'returns safe 409 for %s duplicate ingredient names',
      async (method) => {
        repository[method === 'post' ? 'save' : 'update'].mockRejectedValue(
          databaseError('23505', 'uq_ingredients_name'),
        );
        const response = await request(app)
          [method](endpoint(method))
          .send(validBody(method));
        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          status: 'error',
          message: 'An ingredient with this name already exists.',
        });
      },
    );

    it.each(['post', 'patch', 'delete'] as const)(
      'returns safe 409 for %s foreign-key violations',
      async (method) => {
        const operation =
          method === 'post' ? 'save' : method === 'patch' ? 'update' : 'delete';
        repository[operation].mockRejectedValue(
          databaseError('23503', 'private_foreign_key_name'),
        );
        const pending = request(app)[method](endpoint(method));
        const response = await (method === 'delete'
          ? pending
          : pending.send({ ...validBody(method), categoryId: 3 }));
        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          status: 'error',
          message:
            'A related record is missing or this record is still in use.',
        });
      },
    );

    it.each([
      ['list', 'find', 'get', '/api/ingredients'],
      ['detail', 'findOneBy', 'get', `/api/ingredients/${ingredientId}`],
      ['create', 'save', 'post', '/api/ingredients'],
      ['update', 'update', 'patch', `/api/ingredients/${ingredientId}`],
      ['delete', 'delete', 'delete', `/api/ingredients/${ingredientId}`],
    ] as const)(
      'masks unexpected %s failures in production',
      async (_label, operation, method, url) => {
        vi.stubEnv('NODE_ENV', 'production');
        repository[operation].mockRejectedValue(
          new Error('secret connection string and internal file path'),
        );
        const pending = request(app)[method](url);
        const response = await (method === 'post' || method === 'patch'
          ? pending.send(validBody(method))
          : pending);
        expect(response.status).toBe(500);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body).toEqual({
          status: 'error',
          message: 'Internal Server Error',
        });
      },
    );

    it('masks failures while checking whether a conflicted ingredient exists', async () => {
      repository.update.mockResolvedValue({ affected: 0, raw: [] });
      repository.existsBy.mockRejectedValue(
        new Error('private database failure'),
      );
      const response = await request(app)
        .patch(endpoint('patch'))
        .send(validBody('patch'));
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Internal Server Error',
      });
    });

    it('keeps unrecognized database errors private', async () => {
      repository.save.mockRejectedValue(databaseError('08006'));
      const response = await request(app)
        .post('/api/ingredients')
        .send({ name: 'Flour' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Internal Server Error',
      });
    });

    it('includes the original stack in development responses', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const failure = new Error('development failure details');
      repository.find.mockRejectedValue(failure);
      const response = await request(app).get('/api/ingredients');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Internal Server Error',
        stack: failure.stack,
      });
    });
  });

  describe('request parsing', () => {
    it.each(['post', 'patch'] as const)(
      'returns JSON 400 for malformed %s JSON before database access',
      async (method) => {
        const response = await request(app)
          [method](endpoint(method))
          .set('Content-Type', 'application/json')
          .send('{"name":');
        expect(response.status).toBe(400);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(response.body.status).toBe('error');
        expect(response.body.message).toEqual(expect.any(String));
        expectNoRepositoryCalls();
      },
    );

    it('rejects oversized JSON with 413 before database access', async () => {
      const response = await request(app)
        .post('/api/ingredients')
        .send({ name: 'Flour', description: 'x'.repeat(110 * 1024) });
      expect(response.status).toBe(413);
      expect(response.body.status).toBe('error');
      expect(response.body).not.toHaveProperty('stack');
      expectNoRepositoryCalls();
    });

    it('rejects a missing JSON body before database access', async () => {
      const response = await request(app).post('/api/ingredients');
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expectNoRepositoryCalls();
    });
  });
});
