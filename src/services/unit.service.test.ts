import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import { getUnitByIdService, getUnitService } from './unit.service';

const repository = vi.hoisted(() => ({ find: vi.fn(), findOneBy: vi.fn() }));
vi.mock('../repositories/unit.repo', () => ({ unitRepository: repository }));

const unit = { unitId: 32767, name: 'Gram', abbreviation: 'g' };

beforeEach(() => {
  vi.resetAllMocks();
  repository.find.mockResolvedValue([unit]);
  repository.findOneBy.mockResolvedValue(unit);
});

describe('unit service', () => {
  it('lists units by ascending ID, including an empty list', async () => {
    await expect(getUnitService()).resolves.toEqual([unit]);
    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      order: { unitId: 'ASC' },
    });
    repository.find.mockResolvedValueOnce([]);
    await expect(getUnitService()).resolves.toEqual([]);
  });

  it('looks up a numeric smallint ID', async () => {
    await expect(getUnitByIdService(32767)).resolves.toBe(unit);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      unitId: 32767,
    });
  });

  it('returns 404 when the unit does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(getUnitByIdService(1)).rejects.toEqual(
      new HttpError(404, 'Unit does not exist.'),
    );
  });

  it('propagates repository errors', async () => {
    const error = new Error('database unavailable');
    repository.find.mockRejectedValue(error);
    await expect(getUnitService()).rejects.toBe(error);
  });
});
