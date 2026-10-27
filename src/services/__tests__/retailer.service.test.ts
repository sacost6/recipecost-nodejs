import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../middleware/errorHandling/error';
import {
  getRetailerByIdService,
  getRetailerService,
} from '../retailer.service';

const repository = vi.hoisted(() => ({ find: vi.fn(), findOneBy: vi.fn() }));
vi.mock('../../repositories/retailer.repo', () => ({
  retailerRepository: repository,
}));

const retailerId = '9007199254740993';
const retailer = { retailerId, name: 'Market' };

beforeEach(() => {
  vi.resetAllMocks();
  repository.find.mockResolvedValue([retailer]);
  repository.findOneBy.mockResolvedValue(retailer);
});

describe('retailer service', () => {
  it('lists retailers alphabetically, including an empty list', async () => {
    await expect(getRetailerService()).resolves.toEqual([retailer]);
    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      order: { name: 'ASC' },
    });
    repository.find.mockResolvedValueOnce([]);
    await expect(getRetailerService()).resolves.toEqual([]);
  });

  it('preserves bigint IDs as strings during lookup', async () => {
    await expect(getRetailerByIdService(retailerId)).resolves.toBe(retailer);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      retailerId,
    });
  });

  it('returns a specific 404 for an unknown retailer', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(getRetailerByIdService(retailerId)).rejects.toEqual(
      new HttpError(404, 'Retailer does not exist.'),
    );
  });

  it('does not turn storage failures into not-found responses', async () => {
    const error = new Error('database unavailable');
    repository.findOneBy.mockRejectedValue(error);
    await expect(getRetailerByIdService(retailerId)).rejects.toBe(error);
  });
});
