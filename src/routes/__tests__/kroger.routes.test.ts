import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandling/errorHandler.middleware';
import { krogerRoutes } from '../kroger.routes';

const getProduct = vi.hoisted(() => vi.fn());
vi.mock('../../services/kroger_service.client', () => ({
  getKrogerProduct: getProduct,
}));

let sessionUserId: string | undefined;
const app = express();
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.session = { userId: sessionUserId } as Request['session'];
  next();
});
app.use('/api/kroger', krogerRoutes);
app.use(errorHandler);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  sessionUserId = '7';
  getProduct.mockResolvedValue({ data: [{ price: { regular: 4.99 } }] });
});
afterEach(() => vi.unstubAllEnvs());

describe('Kroger product lookup route', () => {
  it('requires authentication', async () => {
    sessionUserId = undefined;

    const response = await request(app).get(
      '/api/kroger/products/0001234567890?locationId=01400390',
    );

    expect(response.status).toBe(401);
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('validates the UPC and location before proxying the request', async () => {
    const response = await request(app).get(
      '/api/kroger/products/not-a-upc?locationId=01400390',
    );

    expect(response.status).toBe(400);
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('returns product data without caching and passes lookup keys through', async () => {
    const response = await request(app).get(
      '/api/kroger/products/0001234567890?locationId=01400390',
    );

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      status: 'success',
      data: { data: [{ price: { regular: 4.99 } }] },
    });
    expect(getProduct).toHaveBeenCalledExactlyOnceWith(
      '0001234567890',
      '01400390',
    );
  });
});
