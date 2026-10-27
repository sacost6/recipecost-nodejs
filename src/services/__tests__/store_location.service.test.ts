import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../middleware/errorHandling/error';
import {
  createStoreLocationService,
  getStoreLocationByIdService,
  getStoreLocationsService,
} from '../store_location.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
}));
vi.mock('../../repositories/store_location.repo', () => ({
  storeLocationRepository: repository,
}));

const storeLocationId = '9007199254740993';
const retailerId = '9007199254740995';
const retailer = { retailerId, name: 'Market' };
const location = {
  storeLocationId,
  retailerId,
  storeNumber: null,
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Madison',
  stateCode: 'WI',
  postalCode: '53703',
  countryCode: 'US',
  retailer,
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
  repository.create.mockImplementation((value) => ({ ...value }));
  repository.save.mockResolvedValue({ storeLocationId });
  repository.find.mockResolvedValue([location]);
  repository.findOne.mockResolvedValue(location);
});

describe('store location reads', () => {
  it('lists locations with retailer names and stable retailer ordering', async () => {
    await expect(getStoreLocationsService()).resolves.toEqual([location]);
    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      relations: { retailer: true },
      order: { retailerId: 'ASC' },
    });
  });

  it('loads a location and retailer by exact bigint ID', async () => {
    await expect(getStoreLocationByIdService(storeLocationId)).resolves.toBe(
      location,
    );
    expect(repository.findOne).toHaveBeenCalledExactlyOnceWith({
      where: { storeLocationId },
      relations: { retailer: true },
    });
  });

  it('returns 404 when a location does not exist', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(getStoreLocationByIdService(storeLocationId)).rejects.toEqual(
      new HttpError(404, 'Store location does not exist.'),
    );
  });
});

describe('store location creation', () => {
  it('maps form fields, defaults optional values, then returns the hydrated retailer', async () => {
    await expect(createStoreLocationService(input)).resolves.toBe(location);

    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      retailerId,
      storeNumber: null,
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Madison',
      stateCode: 'WI',
      postalCode: '53703',
      countryCode: 'US',
      krogerLocationId: null,
    });
    expect(repository.save).toHaveBeenCalledOnce();
    expect(repository.findOne).toHaveBeenCalledExactlyOnceWith({
      where: { storeLocationId },
      relations: { retailer: true },
    });
  });

  it('preserves explicitly supplied nullable fields', async () => {
    const completeInput = {
      ...input,
      storeNumber: ' 004 ',
      addressLine2: ' Suite 3 ',
      stateCode: null,
      postalCode: null,
    };
    await createStoreLocationService(completeInput);
    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      retailerId,
      storeNumber: ' 004 ',
      addressLine1: '123 Main St',
      addressLine2: ' Suite 3 ',
      city: 'Madison',
      stateCode: null,
      postalCode: null,
      countryCode: 'US',
      krogerLocationId: null,
    });
  });

  it('reports a server error if the saved location cannot be reloaded', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(createStoreLocationService(input)).rejects.toEqual(
      new HttpError(500, 'Unable to load the created store location.'),
    );
  });

  it('propagates database errors from the insert', async () => {
    const error = new Error('database unavailable');
    repository.save.mockRejectedValue(error);
    await expect(createStoreLocationService(input)).rejects.toBe(error);
    expect(repository.findOne).not.toHaveBeenCalled();
  });
});
