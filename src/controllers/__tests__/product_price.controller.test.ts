import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProductPrice,
  getProductPricesByProductId,
} from '../product_price.controller';

const services = vi.hoisted(() => ({
  createProductPriceService: vi.fn(),
  getProductPricesByProductIdService: vi.fn(),
}));
vi.mock('../../services/product_price.service', () => services);

const userId = '9007199254740993';
const productId = '9007199254740995';
const input = {
  productId,
  storeLocationId: '9007199254740997',
  price: '3.49',
  currencyCode: 'USD',
};
const price = { priceId: '9007199254740999', ...input };

const responseFor = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { res, response: res as unknown as Response };
};

beforeEach(() => {
  vi.resetAllMocks();
  services.createProductPriceService.mockResolvedValue(price);
  services.getProductPricesByProductIdService.mockResolvedValue([price]);
});

describe('product price controller', () => {
  it('creates a price with the session owner and validated body', async () => {
    const req = { session: { userId }, body: input } as unknown as Request<
      Record<string, never>,
      unknown,
      typeof input
    >;
    const { res, response } = responseFor();
    await createProductPrice(req, response);

    expect(services.createProductPriceService).toHaveBeenCalledExactlyOnceWith(
      userId,
      input,
    );
    expect(res.status).toHaveBeenCalledExactlyOnceWith(201);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: price,
    });
  });

  it('lists a product price history by exact product ID and session owner', async () => {
    const req = {
      session: { userId },
      params: { productId },
    } as unknown as Request<{ productId: string }>;
    const { res, response } = responseFor();
    await getProductPricesByProductId(req, response);

    expect(
      services.getProductPricesByProductIdService,
    ).toHaveBeenCalledExactlyOnceWith(userId, productId);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: [price],
    });
  });

  it('rejects both operations when session identity is missing', async () => {
    const { response: createResponse } = responseFor();
    const createReq = { session: {}, body: input } as unknown as Request<
      Record<string, never>,
      unknown,
      typeof input
    >;
    await expect(
      createProductPrice(createReq, createResponse),
    ).rejects.toMatchObject({
      statusCode: 401,
    });

    const { response: listResponse } = responseFor();
    const listReq = {
      session: {},
      params: { productId },
    } as unknown as Request<{ productId: string }>;
    await expect(
      getProductPricesByProductId(listReq, listResponse),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(services.createProductPriceService).not.toHaveBeenCalled();
    expect(services.getProductPricesByProductIdService).not.toHaveBeenCalled();
  });
});
