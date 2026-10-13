import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/errorHandling/errorHandler.middleware';
import { productPriceRoutes } from './product_prices.routes';

const services = vi.hoisted(() => ({ createProductPriceService: vi.fn() }));
vi.mock('../services/product_price.service', () => services);

let sessionUserId: string | undefined;
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.session = { userId: sessionUserId } as Request['session'];
  next();
});
app.use('/api/product-prices', productPriceRoutes);
app.use(errorHandler);

const userId = '9007199254740993';
const body = {
  productId: '9007199254740995',
  storeLocationId: '9007199254740997',
  price: '3.49',
  currencyCode: 'USD',
};
const result = { priceId: '9007199254740999', ...body };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  sessionUserId = userId;
  services.createProductPriceService.mockResolvedValue(result);
});
afterEach(() => vi.unstubAllEnvs());

describe('product price create route', () => {
  it('requires authentication before reaching the controller', async () => {
    sessionUserId = undefined;
    const response = await request(app).post('/api/product-prices').send(body);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Please log in.',
    });
    expect(services.createProductPriceService).not.toHaveBeenCalled();
  });

  it('validates, normalizes currency, uses session identity and returns 201', async () => {
    const response = await request(app)
      .post('/api/product-prices')
      .send({ ...body, currencyCode: ' usd ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ status: 'success', data: result });
    expect(services.createProductPriceService).toHaveBeenCalledExactlyOnceWith(
      userId,
      body,
    );
  });

  it.each([
    { ...body, productId: '0' },
    { ...body, storeLocationId: '9223372036854775808' },
    { ...body, price: '-0.01' },
    { ...body, currencyCode: 'US' },
    { ...body, userId: 'forged' },
  ])(
    'rejects invalid or injected data before service call: %j',
    async (input) => {
      const response = await request(app)
        .post('/api/product-prices')
        .send(input);
      expect(response.status).toBe(400);
      expect(services.createProductPriceService).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing request body', async () => {
    const response = await request(app).post('/api/product-prices');
    expect(response.status).toBe(400);
    expect(services.createProductPriceService).not.toHaveBeenCalled();
  });

  it('passes service errors to the standard error handler', async () => {
    services.createProductPriceService.mockRejectedValue(
      new Error('private database details'),
    );
    const response = await request(app).post('/api/product-prices').send(body);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Internal Server Error',
    });
  });
});
