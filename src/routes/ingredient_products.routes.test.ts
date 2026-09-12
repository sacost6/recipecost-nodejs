import { IngredientProduct } from '../entities/IngredientProduct';
import { metadataSource } from '../test-utils/entityMetadata';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { app } from '../app';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  update: vi.fn(),
  existsBy: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
const ingredients = vi.hoisted(() => ({ findOneBy: vi.fn() }));
vi.mock('../repositories/ingredient.repo', () => ({
  ingredientRepository: ingredients,
}));
const source = metadataSource();
beforeAll(async () => {
  await source.prepareMetadata();
  const real = source.getRepository(IngredientProduct);
  Object.defineProperties(repository, {
    metadata: { get: () => real.metadata },
    manager: { get: () => real.manager },
  });
});
const query = vi.hoisted(() => ({
  where: vi.fn(),
  andWhere: vi.fn(),
  orderBy: vi.fn(),
  addOrderBy: vi.fn(),
  take: vi.fn(),
  skip: vi.fn(),
  getMany: vi.fn(),
}));
const session = vi.hoisted(() => ({ userId: undefined as string | undefined }));

// Real app mounting, product router, validation, controllers, services and errors.
// Session persistence and PostgreSQL semantics belong to their integration suites.
vi.mock('../repositories/ingredient_products.repo', () => ({
  ingredientProductRepository: repository,
}));
vi.mock('./ingredients.routes', async () => {
  const { Router } = await import('express');
  return { ingredientRoutes: Router() };
});
vi.mock('./auth.routes', async () => {
  const { Router } = await import('express');
  return { authRoutes: Router() };
});
vi.mock('../middleware/session.middleware', () => ({
  sessionMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.session = { userId: session.userId } as Request['session'];
    next();
  },
}));
vi.mock('../middleware/logging.middleware', async () => {
  const { default: pino } = await import('pino');
  return { logger: pino({ level: 'silent' }) };
});

const base = '/api/ingredient-products';
const aliceId = '9007199254740993';
const bobId = '9007199254740994';
const productId = '9007199254740995';
const upc = '000123456789';
const input = {
  ingredientId: '9007199254740997',
  packageUnitId: 1,
  productName: 'Bread flour',
  packageQuantity: '500.0000',
};
const product = {
  ...input,
  productId,
  userId: aliceId,
  upc,
  brand: null,
  version: 1,
};
const patch = { ingredientId: input.ingredientId, version: 1 };
const rawProduct = (value: typeof product) => ({
  product_id: value.productId,
  ingredient_id: value.ingredientId,
  package_unit_id: value.packageUnitId,
  product_name: value.productName,
  package_quantity: value.packageQuantity,
  user_id: value.userId,
  brand: value.brand,
  upc: value.upc,
  version: value.version,
});
const bobProduct = { ...product, productId: '9007199254740996', userId: bobId };
let stored = [product, bobProduct];
type Criteria = {
  userId: string;
  productId?: string;
  upc?: string;
  version?: number;
};
const findOwned = (criteria: Criteria) =>
  stored.find(
    (row) =>
      row.userId === criteria.userId &&
      (criteria.productId === undefined ||
        row.productId === criteria.productId) &&
      (criteria.upc === undefined || row.upc === criteria.upc) &&
      (criteria.version === undefined || row.version === criteria.version),
  );
const noStorageCalls = () => {
  expect(ingredients.findOneBy).not.toHaveBeenCalled();
  for (const operation of Object.values(repository))
    expect(operation).not.toHaveBeenCalled();
};
const endpoints = [
  { method: 'get', path: '', body: undefined, operation: 'createQueryBuilder' },
  {
    method: 'get',
    path: `/${productId}`,
    body: undefined,
    operation: 'findOneBy',
  },
  {
    method: 'get',
    path: `/upc/${upc}`,
    body: undefined,
    operation: 'findOneBy',
  },
  { method: 'post', path: '', body: input, operation: 'save' },
  {
    method: 'patch',
    path: `/${productId}`,
    body: { ...patch, brand: null },
    operation: 'update',
  },
  {
    method: 'delete',
    path: `/${productId}`,
    body: undefined,
    operation: 'delete',
  },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
  session.userId = aliceId;
  stored = [{ ...product }, { ...bobProduct }];
  ingredients.findOneBy.mockImplementation(
    async (conditions: { ingredientId: string }[]) =>
      conditions.some((c) => c.ingredientId === input.ingredientId)
        ? { ingredientId: input.ingredientId, userId: null }
        : null,
  );
  repository.create.mockImplementation((values) =>
    source.getRepository(IngredientProduct).create(values ?? {}),
  );
  repository.save.mockImplementation(async (values) => ({
    ...values,
    productId,
    version: 1,
  }));
  repository.findOneBy.mockImplementation(
    async (criteria: Criteria) => findOwned(criteria) ?? null,
  );
  repository.existsBy.mockImplementation(
    async (criteria: Criteria) => !!findOwned(criteria),
  );
  repository.update.mockImplementation(
    async (criteria: Criteria, changes: Partial<typeof product>) => {
      const current = findOwned(criteria);
      if (!current) return { affected: 0, raw: [] };
      const updated = {
        ...current,
        ...Object.fromEntries(
          Object.entries(changes).filter(([, v]) => v !== undefined),
        ),
        version: current.version + 1,
      };
      stored = stored.map((row) =>
        row.productId === current.productId ? updated : row,
      );
      return { affected: 1, raw: [rawProduct(updated)] };
    },
  );
  repository.delete.mockImplementation(async (criteria: Criteria) => ({
    affected: findOwned(criteria) ? 1 : 0,
  }));
  repository.createQueryBuilder.mockReturnValue(query);
  for (const [name, method] of Object.entries(query)) {
    if (name !== 'getMany') method.mockReturnValue(query);
  }
  query.getMany.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('product route authentication and error handling', () => {
  it.each(endpoints)(
    'rejects anonymous $method $path before storage',
    async ({ method, path, body }) => {
      session.userId = undefined;
      const response = await request(app)
        [method](base + path)
        .send(body);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Please log in.',
      });
      noStorageCalls();
    },
  );

  it('checks authentication before validating the request', async () => {
    session.userId = undefined;
    const response = await request(app)
      .patch(`${base}/invalid-id`)
      .send({ userId: bobId });
    expect(response.status).toBe(401);
    noStorageCalls();
  });

  it.each(endpoints)(
    'converts storage failure on $method $path to a sanitized 500',
    async ({ method, path, body, operation }) => {
      repository[operation].mockImplementation(() => {
        throw new Error('private database details');
      });
      const response = await request(app)
        [method](base + path)
        .send(body);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Internal Server Error',
      });
    },
  );
});

describe('GET product routes', () => {
  it('returns an empty collection with default pagination and session ownership', async () => {
    const response = await request(app).get(base);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [] });
    expect(query.where).toHaveBeenCalledExactlyOnceWith(
      'product.userId = :userId',
      { userId: aliceId },
    );
    expect(query.take).toHaveBeenCalledExactlyOnceWith(25);
    expect(query.skip).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('passes trimmed filters and numeric pagination through the mounted app', async () => {
    query.getMany.mockResolvedValue([product]);
    const response = await request(app).get(base).query({
      ingredientId: input.ingredientId,
      query: ' flour ',
      brand: ' Pantry ',
      limit: '10',
      offset: '20',
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [product] });
    expect(query.andWhere).toHaveBeenCalledWith(
      'product.ingredientId = :ingredientId',
      { ingredientId: input.ingredientId },
    );
    expect(query.andWhere).toHaveBeenCalledWith(expect.any(String), {
      search: '%flour%',
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'LOWER(product.brand) = LOWER(:brand)',
      { brand: 'Pantry' },
    );
    expect(query.take).toHaveBeenCalledExactlyOnceWith(10);
    expect(query.skip).toHaveBeenCalledExactlyOnceWith(20);
  });

  it.each([
    { limit: '0' },
    { limit: '101' },
    { offset: '-1' },
    { limit: '1.5' },
    { limit: ['1', '2'] },
    { ingredientId: '0' },
    { userId: bobId },
  ])('rejects invalid list query %j', async (filters) => {
    const response = await request(app).get(base).query(filters);
    expect(response.status).toBe(400);
    noStorageCalls();
  });

  it('routes an exact bigint ID to the ID lookup', async () => {
    const response = await request(app).get(`${base}/${productId}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: product });
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      productId,
    });
  });

  it('routes a UPC separately, preserves leading zeros, and ignores body identity', async () => {
    const response = await request(app)
      .get(`${base}/upc/${upc}`)
      .send({ upc: 'wrong', userId: bobId });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: product });
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      upc,
    });
  });

  it('trims the validated UPC path before lookup', async () => {
    const response = await request(app).get(
      `${base}/upc/${encodeURIComponent(` ${upc} `)}`,
    );
    expect(response.status).toBe(200);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      upc,
    });
  });

  it('rejects an oversized UPC without storage access', async () => {
    const response = await request(app).get(`${base}/upc/${'1'.repeat(21)}`);
    expect(response.status).toBe(400);
    noStorageCalls();
  });

  it.each([`/9223372036854775807`, '/upc/missing'])(
    'returns 404 for missing lookup %s',
    async (path) => {
      const response = await request(app).get(base + path);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Product not found.',
      });
    },
  );
});

describe('product writes and ownership', () => {
  it('creates a product from validated fields and the session owner', async () => {
    const response = await request(app)
      .post(base)
      .send({ ...input, productName: ' Bread flour ', upc: ` ${upc} ` });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ status: 'success', data: product });
    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      ...input,
      userId: aliceId,
      upc,
      brand: null,
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('updates supplied fields, allows explicit null and returns the saved product', async () => {
    const updated = {
      ...product,
      productName: 'New name',
      brand: null,
      version: 2,
    };
    const response = await request(app)
      .patch(`${base}/${productId}`)
      .send({ ...patch, productName: ' New name ', brand: null });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: updated });
    expect(repository.update).toHaveBeenCalledExactlyOnceWith(
      { userId: aliceId, productId, version: 1 },
      {
        ingredientId: input.ingredientId,
        packageUnitId: undefined,
        brand: null,
        productName: 'New name',
        packageQuantity: undefined,
        upc: undefined,
      },
      { returning: '*' },
    );
    expect(repository.findOneBy).not.toHaveBeenCalled();
    expect(repository.existsBy).not.toHaveBeenCalled();
  });

  it('returns 409 for a stale version and preserves the successful update', async () => {
    const winner = await request(app)
      .patch(`${base}/${productId}`)
      .send({ ...patch, productName: 'Winner' });
    expect(winner.status).toBe(200);
    expect(winner.body.data.version).toBe(2);

    const stale = await request(app)
      .patch(`${base}/${productId}`)
      .send({ ...patch, productName: 'Stale edit' });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({
      status: 'error',
      message: 'Ingredient Product has changed. Reload it before saving again.',
    });
    expect(repository.existsBy).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      productId,
    });
    const current = await request(app).get(`${base}/${productId}`);
    expect(current.status).toBe(200);
    expect(current.body.data).toEqual(winner.body.data);
  });

  it.each([
    { ingredientId: input.ingredientId, productName: 'Missing version' },
    { version: 1, productName: 'Missing ingredient' },
    { ...patch, version: 0 },
  ])(
    'rejects an incomplete or invalid versioned patch before storage: %j',
    async (body) => {
      const response = await request(app)
        .patch(`${base}/${productId}`)
        .send(body);
      expect(response.status).toBe(400);
      noStorageCalls();
    },
  );

  it('deletes from the product repository and returns an empty 204', async () => {
    const response = await request(app).delete(`${base}/${productId}`);
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(repository.delete).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      productId,
    });
  });

  it.each(['get', 'patch', 'delete'] as const)(
    'rejects invalid IDs on %s before storage',
    async (method) => {
      const response = await request(app)
        [method](`${base}/not-an-id`)
        .send({ ...patch, brand: null });
      expect(response.status).toBe(400);
      noStorageCalls();
    },
  );

  it.each(['get', 'patch', 'delete'] as const)(
    "prevents %s access to another owner's product",
    async (method) => {
      const response = await request(app)
        [method](`${base}/${bobProduct.productId}`)
        .send({ ...patch, brand: null });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'error',
        message:
          method === 'patch'
            ? 'Ingredient Product not found.'
            : 'Product not found.',
      });
      const operation =
        method === 'get'
          ? repository.findOneBy
          : method === 'patch'
            ? repository.update
            : repository.delete;
      expect(operation.mock.calls[0][0]).toEqual({
        userId: aliceId,
        productId: bobProduct.productId,
        ...(method === 'patch' ? { version: 1 } : {}),
      });
    },
  );

  it('selects the session owner when two users share a UPC', async () => {
    session.userId = bobId;
    const response = await request(app).get(`${base}/upc/${upc}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(bobProduct);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: bobId,
      upc,
    });
  });

  it('returns 404 for a UPC owned only by somebody else', async () => {
    repository.findOneBy.mockImplementation(async (criteria: Criteria) =>
      criteria.userId === bobId && criteria.upc === 'bob-only'
        ? bobProduct
        : null,
    );
    const response = await request(app).get(`${base}/upc/bob-only`);
    expect(response.status).toBe(404);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      upc: 'bob-only',
    });
  });

  it.each([
    { method: 'post', body: {} },
    { method: 'post', body: { ...input, packageQuantity: 500 } },
    { method: 'post', body: { ...input, userId: bobId } },
    { method: 'patch', body: {} },
    { method: 'patch', body: { productName: ' ' } },
    { method: 'patch', body: { userId: bobId } },
  ] as const)(
    'rejects invalid $method body $body before storage',
    async ({ method, body }) => {
      const response = await request(app)
        [method](method === 'post' ? base : `${base}/${productId}`)
        .send(body);
      expect(response.status).toBe(400);
      noStorageCalls();
    },
  );

  it.each(['post', 'patch'] as const)(
    'rejects a missing body on %s',
    async (method) => {
      const response = await request(app)[method](
        method === 'post' ? base : `${base}/${productId}`,
      );
      expect(response.status).toBe(400);
      noStorageCalls();
    },
  );

  it.each(['23505', '23503'])(
    'maps database constraint %s to 409',
    async (code) => {
      repository.save.mockRejectedValue(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('private row details'), { code }),
        ),
      );
      const response = await request(app).post(base).send(input);
      expect(response.status).toBe(409);
      expect(response.body.status).toBe('error');
      expect(response.text).not.toContain('private row details');
    },
  );
});
