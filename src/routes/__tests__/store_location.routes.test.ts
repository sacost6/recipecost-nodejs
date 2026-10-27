import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandling/errorHandler.middleware';
import { storeLocationRoutes } from '../store_location.routes';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
}));
vi.mock('../../repositories/store_location.repo', () => ({
  storeLocationRepository: repository,
}));

let sessionUserId: string | undefined;
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.session = { userId: sessionUserId } as Request['session'];
  next();
});
app.use('/api/store-locations', storeLocationRoutes);
app.use(errorHandler);

const storeLocationId = '9007199254740993';
const retailerId = '9007199254740995';
const row = {
  storeLocationId,
  retailerId,
  retailer: { retailerId, name: 'Market' },
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Madison',
  stateCode: 'WI',
  postalCode: '53703',
  countryCode: 'US',
};
const input = {
  retailerId,
  streetName: '123 Main St',
  city: 'Madison',
  stateCode: 'WI',
  postalCode: '53703',
  countryCode: 'US',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  sessionUserId = '9007199254740997';
  repository.create.mockImplementation((value) => ({ ...value }));
  repository.save.mockResolvedValue({ storeLocationId });
  repository.find.mockResolvedValue([row]);
  repository.findOne.mockResolvedValue(row);
});
afterEach(() => vi.unstubAllEnvs());

describe('store location endpoints', () => {
  it('requires authentication before listing or reading locations', async () => {
    sessionUserId = undefined;
    const list = await request(app).get('/api/store-locations');
    const detail = await request(app).get(
      `/api/store-locations/${storeLocationId}`,
    );
    expect(list.status).toBe(401);
    expect(detail.status).toBe(401);
    expect(repository.find).not.toHaveBeenCalled();
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('lists retailer-hydrated locations', async () => {
    const response = await request(app).get('/api/store-locations');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [row] });
    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      relations: { retailer: true },
      order: { retailerId: 'ASC' },
    });
  });

  it('looks up a valid bigint location ID and returns its retailer', async () => {
    const response = await request(app).get(
      `/api/store-locations/${storeLocationId}`,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: row });
    expect(repository.findOne).toHaveBeenCalledExactlyOnceWith({
      where: { storeLocationId },
      relations: { retailer: true },
    });
  });

  it.each(['0', '9223372036854775808', 'abc'])(
    'rejects malformed location ID %s before querying storage',
    async (id) => {
      const response = await request(app).get(`/api/store-locations/${id}`);
      expect(response.status).toBe(400);
      expect(repository.findOne).not.toHaveBeenCalled();
    },
  );

  it('creates from validated form fields and returns the hydrated row', async () => {
    const response = await request(app)
      .post('/api/store-locations')
      .send(input);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ status: 'success', data: row });
    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      retailerId,
      storeNumber: null,
      addressLine1: input.streetName,
      addressLine2: null,
      city: input.city,
      stateCode: input.stateCode,
      postalCode: input.postalCode,
      countryCode: 'US',
      krogerLocationId: null,
    });
  });

  it('rejects identity injection and invalid addresses before writing', async () => {
    const response = await request(app)
      .post('/api/store-locations')
      .send({ ...input, userId: 'forged' });
    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();

    const badAddress = await request(app)
      .post('/api/store-locations')
      .send({ ...input, streetName: ' ' });
    expect(badAddress.status).toBe(400);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns the route-level not-found response for a missing location', async () => {
    repository.findOne.mockResolvedValue(null);
    const response = await request(app).get(
      `/api/store-locations/${storeLocationId}`,
    );
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Store location does not exist.',
    });
  });
});
