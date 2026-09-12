import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import {
  createIngredientProduct,
  deleteIngredientProduct,
  getIngredientProductById,
  getIngredientProductByUpc,
  getIngredientProducts,
  updateIngredientProduct,
} from './ingredient_products.controller';

const services = vi.hoisted(() => ({
  getIngredientProductsService: vi.fn(),
  getIngredientProductByIdService: vi.fn(),
  getIngredientProductByUpcService: vi.fn(),
  createIngredientProductService: vi.fn(),
  updateIngredientProductService: vi.fn(),
  deleteIngredientProductService: vi.fn(),
}));
vi.mock('../services/ingredient_products.service', () => services);

type ProductResponse = Parameters<typeof getIngredientProducts>[1];

const userId = '9007199254740993';
const productId = '9007199254740995';
const upc = '000123456789';
const input = {
  ingredientId: '9007199254740997',
  packageUnitId: 1,
  productName: 'Bread flour',
  packageQuantity: '500.0000',
};
const product = { ...input, userId, productId, upc, brand: null };
const filters = { query: 'flour', limit: 10, offset: 20 };

const makeRequest = () =>
  ({
    session: { userId },
    params: { productId, upc, userId: 'forged-param-owner' },
    body: {
      ...input,
      productId: 'wrong-body-id',
      upc: 'wrong-body-upc',
      userId: 'forged-body-owner',
    },
    query: {
      query: 'unvalidated query',
      limit: '99',
      userId: 'forged-query-owner',
    },
  }) as unknown as Request;

const response = () => {
  const res = {
    locals: { query: filters },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return { res, expressResponse: res as unknown as ProductResponse };
};

// Cast only at the test boundary: each fixture supplies the handler's params/body.
const cases = [
  {
    name: 'list',
    invoke: (req: Request, res: ProductResponse) =>
      getIngredientProducts(req, res),
    service: services.getIngredientProductsService,
    args: (_req: Request) => [userId, filters],
    result: [product],
    status: 200,
  },
  {
    name: 'get by ID',
    invoke: (req: Request, res: ProductResponse) =>
      getIngredientProductById(
        req as Parameters<typeof getIngredientProductById>[0],
        res,
      ),
    service: services.getIngredientProductByIdService,
    args: (_req: Request) => [userId, productId],
    result: product,
    status: 200,
  },
  {
    name: 'get by UPC',
    invoke: (req: Request, res: ProductResponse) =>
      getIngredientProductByUpc(
        req as Parameters<typeof getIngredientProductByUpc>[0],
        res,
      ),
    service: services.getIngredientProductByUpcService,
    args: (_req: Request) => [userId, upc],
    result: product,
    status: 200,
  },
  {
    name: 'create',
    invoke: (req: Request, res: ProductResponse) =>
      createIngredientProduct(
        req as Parameters<typeof createIngredientProduct>[0],
        res,
      ),
    service: services.createIngredientProductService,
    args: (req: Request) => [userId, req.body],
    result: product,
    status: 201,
  },
  {
    name: 'update',
    invoke: (req: Request, res: ProductResponse) =>
      updateIngredientProduct(
        req as Parameters<typeof updateIngredientProduct>[0],
        res,
      ),
    service: services.updateIngredientProductService,
    args: (req: Request) => [userId, productId, req.body],
    result: product,
    status: 200,
  },
  {
    name: 'delete',
    invoke: (req: Request, res: ProductResponse) =>
      deleteIngredientProduct(
        req as Parameters<typeof deleteIngredientProduct>[0],
        res,
      ),
    service: services.deleteIngredientProductService,
    args: (_req: Request) => [userId, productId],
    result: undefined,
    status: 204,
  },
];

beforeEach(() => vi.resetAllMocks());

describe.each(cases)(
  '$name product controller',
  ({ invoke, service, args, result, status }) => {
    it('uses the session owner and waits for the service before sending one success response', async () => {
      let resolve!: (value: unknown) => void;
      service.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const req = makeRequest();
      const { res, expressResponse } = response();

      const pending = invoke(req, expressResponse);
      expect(service).toHaveBeenCalledExactlyOnceWith(...args(req));
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
      resolve(result);
      await pending;

      expect(res.status).toHaveBeenCalledExactlyOnceWith(status);
      if (status === 204) {
        expect(res.send).toHaveBeenCalledExactlyOnceWith();
        expect(res.json).not.toHaveBeenCalled();
      } else {
        expect(res.json).toHaveBeenCalledExactlyOnceWith({
          status: 'success',
          data: result,
        });
        expect(res.send).not.toHaveBeenCalled();
      }
      for (const other of Object.values(services)) {
        if (other !== service) expect(other).not.toHaveBeenCalled();
      }
    });

    it.each([undefined, ''])(
      'rejects session identity %s before calling any service',
      async (identity) => {
        const req = makeRequest();
        req.session.userId = identity;
        const { res, expressResponse } = response();

        await expect(invoke(req, expressResponse)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Please log in.',
        });
        for (const operation of Object.values(services))
          expect(operation).not.toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
        expect(res.send).not.toHaveBeenCalled();
      },
    );

    it.each([
      new HttpError(404, 'Product not found.'),
      new Error('storage unavailable'),
    ])('propagates %s without sending success', async (error) => {
      service.mockRejectedValue(error);
      const { res, expressResponse } = response();
      await expect(invoke(makeRequest(), expressResponse)).rejects.toBe(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  },
);

it('returns a successful empty product collection', async () => {
  services.getIngredientProductsService.mockResolvedValue([]);
  const { res, expressResponse } = response();
  await getIngredientProducts(makeRequest(), expressResponse);
  expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
  expect(res.json).toHaveBeenCalledExactlyOnceWith({
    status: 'success',
    data: [],
  });
});
