import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/errorHandling/errorHandler.middleware';
import { ingredientUnitConversionRoutes } from './ingredient_unit_conversion.routes';

const services = vi.hoisted(() => ({
  getIngredientUnitConversionsService: vi.fn(),
  getIngredientUnitConversionByIngredientIdService: vi.fn(),
  getIngredientUnitConversionByIdService: vi.fn(),
  createIngredientUnitConversionService: vi.fn(),
  updateIngredientUnitConversionService: vi.fn(),
  deleteIngredientUnitConversionService: vi.fn(),
}));
vi.mock('../services/ingredient_unit_conversion.service', () => services);

let currentUserId: string | undefined;
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.session = { userId: currentUserId } as Request['session'];
  next();
});
app.use('/api/ingredient-unit-conversions', ingredientUnitConversionRoutes);
app.use(errorHandler);

const userId = '9007199254740994';
const ingredientId = '9007199254740993';
const conversion = {
  ingredientId,
  fromUnitId: 1,
  toUnitId: 2,
  conversionFactor: '1000.000000000',
};
const createBody = conversion;
const compositePath = `/${ingredientId}/1/2`;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  currentUserId = userId;
  services.getIngredientUnitConversionsService.mockResolvedValue([conversion]);
  services.getIngredientUnitConversionByIngredientIdService.mockResolvedValue([
    conversion,
  ]);
  services.getIngredientUnitConversionByIdService.mockResolvedValue(conversion);
  services.createIngredientUnitConversionService.mockResolvedValue(conversion);
  services.updateIngredientUnitConversionService.mockResolvedValue(conversion);
  services.deleteIngredientUnitConversionService.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('ingredient unit conversion routes', () => {
  it('registers the router at the API base path', async () => {
    vi.stubEnv('API_SECRET', 'conversion-route-test-secret');
    vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/unused');
    vi.stubEnv(
      'SESSION_SECRET',
      'conversion-route-test-session-secret-32-chars',
    );
    const { RouteMap } = await import('./index.js');

    expect(
      RouteMap.find(
        ([path]) => path === '/api/ingredient-unit-conversions',
      )?.[1],
    ).toBe(ingredientUnitConversionRoutes);
  });

  it('lists visible conversions for the authenticated user', async () => {
    const response = await request(app).get('/api/ingredient-unit-conversions');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [conversion] });
    expect(
      services.getIngredientUnitConversionsService,
    ).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it('returns every conversion for one accessible ingredient', async () => {
    const response = await request(app).get(
      `/api/ingredient-unit-conversions/${ingredientId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([conversion]);
    expect(
      services.getIngredientUnitConversionByIngredientIdService,
    ).toHaveBeenCalledExactlyOnceWith(userId, ingredientId);
  });

  it('looks up by the full composite key and parses unit IDs from the path', async () => {
    const response = await request(app).get(
      `/api/ingredient-unit-conversions${compositePath}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: conversion });
    expect(
      services.getIngredientUnitConversionByIdService,
    ).toHaveBeenCalledExactlyOnceWith(userId, ingredientId, 1, 2);
  });

  it('creates and updates a conversion after validating each input', async () => {
    const created = await request(app)
      .post('/api/ingredient-unit-conversions')
      .send(createBody);
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ status: 'success', data: conversion });
    expect(
      services.createIngredientUnitConversionService,
    ).toHaveBeenCalledExactlyOnceWith(userId, createBody);

    const updated = await request(app)
      .patch(`/api/ingredient-unit-conversions${compositePath}`)
      .send({ conversionFactor: '500.000000000' });
    expect(updated.status).toBe(200);
    expect(
      services.updateIngredientUnitConversionService,
    ).toHaveBeenCalledExactlyOnceWith(userId, ingredientId, 1, 2, {
      conversionFactor: '500.000000000',
    });
  });

  it('deletes exactly one conversion using all three key fields', async () => {
    const response = await request(app).delete(
      `/api/ingredient-unit-conversions${compositePath}`,
    );

    expect(response.status).toBe(204);
    expect(
      services.deleteIngredientUnitConversionService,
    ).toHaveBeenCalledExactlyOnceWith(userId, ingredientId, 1, 2);
  });

  it.each([
    ['get', '/api/ingredient-unit-conversions', undefined],
    ['get', `/api/ingredient-unit-conversions/${ingredientId}`, undefined],
    ['get', `/api/ingredient-unit-conversions${compositePath}`, undefined],
    ['post', '/api/ingredient-unit-conversions', createBody],
    [
      'patch',
      `/api/ingredient-unit-conversions${compositePath}`,
      { conversionFactor: '500.000000000' },
    ],
    ['delete', `/api/ingredient-unit-conversions${compositePath}`, undefined],
  ] as const)(
    'requires authentication for %s %s',
    async (method, path, body) => {
      currentUserId = undefined;
      const response = await request(app)[method](path).send(body);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Please log in.',
      });
      for (const service of Object.values(services)) {
        expect(service).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    ['GET', `/api/ingredient-unit-conversions/${ingredientId}/1/32768`],
    ['GET', `/api/ingredient-unit-conversions/${ingredientId}/1.5/2`],
    ['GET', '/api/ingredient-unit-conversions/9223372036854775808/1/2'],
  ])('rejects invalid route identifiers for %s %s', async (method, path) => {
    const response = await request(app)[method.toLowerCase() as 'get'](path);
    expect(response.status).toBe(400);
    expect(
      services.getIngredientUnitConversionByIdService,
    ).not.toHaveBeenCalled();
  });

  it('rejects invalid create and update bodies without calling services', async () => {
    const invalidCreate = await request(app)
      .post('/api/ingredient-unit-conversions')
      .send({ ...createBody, fromUnitId: 2, toUnitId: 2 });
    const invalidUpdate = await request(app)
      .patch(`/api/ingredient-unit-conversions${compositePath}`)
      .send({ conversionFactor: '-1' });

    expect(invalidCreate.status).toBe(400);
    expect(invalidUpdate.status).toBe(400);
    expect(
      services.createIngredientUnitConversionService,
    ).not.toHaveBeenCalled();
    expect(
      services.updateIngredientUnitConversionService,
    ).not.toHaveBeenCalled();
  });

  it('passes service errors through the standard error handler', async () => {
    services.getIngredientUnitConversionByIdService.mockRejectedValue(
      new Error('private database details'),
    );
    const response = await request(app).get(
      `/api/ingredient-unit-conversions${compositePath}`,
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Internal Server Error',
    });
  });
});
