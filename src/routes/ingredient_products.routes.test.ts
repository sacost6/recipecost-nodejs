import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
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
const product = { ...input, productId, userId: aliceId, upc, brand: null };
const bobProduct = { ...product, productId: '9007199254740996', userId: bobId };
const stored = [product, bobProduct];
type Criteria = { userId: string; productId?: string; upc?: string };
const findOwned = (criteria: Criteria) =>
  stored.find(
    (row) =>
      row.userId === criteria.userId &&
      (criteria.productId === undefined ||
        row.productId === criteria.productId) &&
      (criteria.upc === undefined || row.upc === criteria.upc),
  );
const noStorageCalls = () => {
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
    body: { brand: null },
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
  repository.create.mockImplementation((values) => ({ ...values }));
  repository.save.mockImplementation(async (values) => ({
    ...values,
    productId,
  }));
  repository.findOneBy.mockImplementation(
    async (criteria: Criteria) => findOwned(criteria) ?? null,
  );
  repository.update.mockImplementation(async (criteria: Criteria) => ({
    affected: findOwned(criteria) ? 1 : 0,
  }));
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
    const updated = { ...product, productName: 'New name', brand: null };
    repository.findOneBy.mockResolvedValue(updated);
    const response = await request(app)
      .patch(`${base}/${productId}`)
      .send({ productName: ' New name ', brand: null });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: updated });
    expect(repository.update).toHaveBeenCalledExactlyOnceWith(
      { userId: aliceId, productId },
      {
        ingredientId: undefined,
        packageUnitId: undefined,
        brand: null,
        productName: 'New name',
        packageQuantity: undefined,
        upc: undefined,
      },
    );
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId: aliceId,
      productId,
    });
  });

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
        .send({ brand: null });
      expect(response.status).toBe(400);
      noStorageCalls();
    },
  );

  it.each(['get', 'patch', 'delete'] as const)(
    "prevents %s access to another owner's product",
    async (method) => {
      const response = await request(app)
        [method](`${base}/${bobProduct.productId}`)
        .send({ brand: null });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Product not found.',
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
