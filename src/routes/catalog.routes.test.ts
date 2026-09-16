import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app';

const repositories = vi.hoisted(() => ({
  units: { find: vi.fn(), findOneBy: vi.fn() },
  categories: { find: vi.fn(), findOneBy: vi.fn() },
  retailers: { find: vi.fn(), findOneBy: vi.fn() },
}));
vi.mock('../repositories/units.repo', () => ({
  unitRepository: repositories.units,
}));
vi.mock('../repositories/ingredient_category.repo', () => ({
  ingredientCategoryRepository: repositories.categories,
}));
vi.mock('../repositories/retailer.repo', () => ({
  retailerRepository: repositories.retailers,
}));
vi.mock('./auth.routes', async () => ({
  authRoutes: (await import('express')).Router(),
}));
vi.mock('./ingredients.routes', async () => ({
  ingredientRoutes: (await import('express')).Router(),
}));
vi.mock('./ingredient_products.routes', async () => ({
  ingredientProductRoutes: (await import('express')).Router(),
}));
vi.mock('../middleware/session.middleware', () => ({
  // No user identity: these are public reference-data endpoints.
  sessionMiddleware: ((_req, _res, next) => next()) satisfies RequestHandler,
}));
vi.mock('../middleware/logging.middleware', async () => ({
  logger: (await import('pino')).default({ level: 'silent' }),
}));

const createdAt = new Date('2026-01-01T00:00:00Z');
const catalogs = [
  {
    name: 'units',
    key: 'unitId',
    id: 32767,
    order: { unitId: 'ASC' },
    missing: 'Unit does not exist.',
    row: {
      unitId: 32767,
      name: 'Gram',
      abbreviation: 'g',
      unitType: 'weight',
      conversionToBase: '1.000000000',
      createdAt,
    },
  },
  {
    name: 'categories',
    key: 'categoryId',
    id: 32767,
    order: { name: 'ASC' },
    missing: 'Ingredient Category does not exist.',
    row: { categoryId: 32767, name: 'Baking', createdAt },
  },
  {
    name: 'retailers',
    key: 'retailerId',
    id: '9007199254740993',
    order: { name: 'ASC' },
    missing: 'Retailer does not exist.',
    row: {
      retailerId: '9007199254740993',
      name: 'Market',
      websiteUrl: null,
      createdAt,
      updatedAt: createdAt,
    },
  },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(catalogs)('public /api/$name endpoints', (catalog) => {
  const repository = repositories[catalog.name];
  const base = `/api/${catalog.name}`;
  const jsonRow = JSON.parse(JSON.stringify(catalog.row));

  it('lists records through app registration, controller and service in the requested order', async () => {
    repository.find.mockResolvedValue([catalog.row]);
    const response = await request(app).get(base);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [jsonRow] });
    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      order: catalog.order,
    });
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });

  it('returns an empty array for an empty catalog', async () => {
    repository.find.mockResolvedValue([]);
    const response = await request(app).get(base);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [] });
  });

  it('looks up an ID with the correct database type and serializes the record', async () => {
    repository.findOneBy.mockResolvedValue(catalog.row);
    const response = await request(app).get(`${base}/${catalog.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: jsonRow });
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      [catalog.key]: catalog.id,
    });
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('returns the resource-specific 404 for a valid but missing ID', async () => {
    repository.findOneBy.mockResolvedValue(null);
    const response = await request(app).get(`${base}/1`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'error',
      message: catalog.missing,
    });
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      [catalog.key]: catalog.name === 'retailers' ? '1' : 1,
    });
  });

  const invalidIds = [
    '0',
    '-1',
    'abc',
    '1.5',
    'Infinity',
    'NaN',
    ' ',
    '1 OR 1=1',
    ...(catalog.name === 'retailers'
      ? ['9223372036854775808', '1e2', '0x10', '1.0']
      : ['32768']),
  ];
  it.each(invalidIds)(
    'rejects invalid ID %j before repository access',
    async (id) => {
      const response = await request(app).get(
        `${base}/${encodeURIComponent(id)}`,
      );
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.any(String),
      });
      for (const repo of Object.values(repositories)) {
        expect(repo.find).not.toHaveBeenCalled();
        expect(repo.findOneBy).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['list', 'lookup'])(
    'handles a rejected %s query without exposing database details',
    async (operation) => {
      const failure = new Error('private database connection detail');
      repository[operation === 'list' ? 'find' : 'findOneBy'].mockRejectedValue(
        failure,
      );
      const response = await request(app).get(
        operation === 'list' ? base : `${base}/1`,
      );
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Internal Server Error',
      });
    },
  );

  it.each(['post', 'patch', 'delete'] as const)(
    'does not expose a %s write operation',
    async (method) => {
      const response = await request(app)
        [method](method === 'post' ? base : `${base}/1`)
        .send({ name: 'Changed' });
      expect(response.status).toBe(404);
      expect(repository.find).not.toHaveBeenCalled();
      expect(repository.findOneBy).not.toHaveBeenCalled();
    },
  );
});

describe('catalog ID boundary behavior', () => {
  it.each(['32768', '9223372036854775807'])(
    'preserves valid bigint retailer ID %s',
    async (retailerId) => {
      repositories.retailers.findOneBy.mockResolvedValue({
        ...catalogs[2].row,
        retailerId,
      });
      const response = await request(app).get(`/api/retailers/${retailerId}`);
      expect(response.status).toBe(200);
      expect(response.body.data.retailerId).toBe(retailerId);
      expect(repositories.retailers.findOneBy).toHaveBeenCalledExactlyOnceWith({
        retailerId,
      });
    },
  );

  it.each(['units', 'categories'] as const)(
    'converts accepted numeric notation for %s to a number',
    async (name) => {
      const key = name === 'units' ? 'unitId' : 'categoryId';
      repositories[name].findOneBy.mockResolvedValue({
        [key]: 100,
        name: 'Example',
      });
      const response = await request(app).get(`/api/${name}/1e2`);
      expect(response.status).toBe(200);
      expect(repositories[name].findOneBy).toHaveBeenCalledExactlyOnceWith({
        [key]: 100,
      });
    },
  );
});
