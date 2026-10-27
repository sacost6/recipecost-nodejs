import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandling/errorHandler.middleware';
import { storeLocationRoutes } from '../store_location.routes';

const search = vi.hoisted(() => vi.fn());
const storeRepository = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  merge: vi.fn(),
}));
vi.mock('../../services/kroger_location.service', () => ({
  searchKrogerLocations: search,
}));
vi.mock('../../repositories/store_location.repo', () => ({
  storeLocationRepository: storeRepository,
}));

let sessionUserId: string | undefined;
const app = express();
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.session = { userId: sessionUserId } as Request['session'];
  next();
});
app.use('/api/store-locations', storeLocationRoutes);
app.use(errorHandler);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  sessionUserId = '7';
  search.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('Kroger location search route', () => {
  it('requires authentication', async () => {
    sessionUserId = undefined;

    const response = await request(app).get(
      '/api/store-locations/kroger/search?zipCode=45044',
    );

    expect(response.status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });

  it('validates ZIP and radius before searching', async () => {
    const response = await request(app).get(
      '/api/store-locations/kroger/search?zipCode=not-a-zip&radiusInMiles=101',
    );

    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it('passes the validated search query to the service', async () => {
    const response = await request(app).get(
      '/api/store-locations/kroger/search?zipCode=%2045044%20&radiusInMiles=25',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: [] });
    expect(search).toHaveBeenCalledExactlyOnceWith({
      zipCode: '45044',
      radiusInMiles: 25,
    });
  });
});
