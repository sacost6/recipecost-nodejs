import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/ error';
import {
  createIngredientProductService,
  deleteIngredientProductService,
  getIngredientProductByIdService,
  getIngredientProductByUpc,
  getIngredientProductsService,
  updateIngredientProductService,
} from './ingredient_products.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
const query = vi.hoisted(() => ({
  where: vi.fn(),
  andWhere: vi.fn(),
  orderBy: vi.fn(),
  addOrderBy: vi.fn(),
  take: vi.fn(),
  skip: vi.fn(),
  getMany: vi.fn(),
}));

// Do not import the real data source or read application database credentials.
vi.mock('../repositories/ingredient_products.repo', () => ({
  ingredientProductRepository: repository,
}));

const userId = '9007199254740993';
const productId = '9007199254740995';
const input = {
  ingredientId: '9007199254740997',
  packageUnitId: 1,
  productName: 'Bread flour',
  packageQuantity: '500.0000',
};
const product = { ...input, userId, productId, brand: null, upc: null };

beforeEach(() => {
  vi.resetAllMocks();
  repository.create.mockImplementation((values) => values);
  repository.save.mockResolvedValue(product);
  repository.findOneBy.mockResolvedValue(product);
  repository.update.mockResolvedValue({ affected: 1 });
  repository.delete.mockResolvedValue({ affected: 1 });
  repository.createQueryBuilder.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.andWhere.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.addOrderBy.mockReturnValue(query);
  query.take.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.getMany.mockResolvedValue([]);
});

describe('getIngredientProductsService', () => {
  it('requires the owner condition and returns an empty list with default pagination', async () => {
    await expect(getIngredientProductsService(userId)).resolves.toEqual([]);

    expect(query.where).toHaveBeenCalledExactlyOnceWith(
      'product.userId = :userId',
      { userId },
    );
    expect(query.take).toHaveBeenCalledExactlyOnceWith(25);
    expect(query.skip).toHaveBeenCalledExactlyOnceWith(0);
  });

  it.each([1, 100])(
    'accepts the inclusive page-size boundary %i',
    async (limit) => {
      query.getMany.mockResolvedValue([product]);

      await expect(
        getIngredientProductsService(userId, { limit, offset: 30 }),
      ).resolves.toEqual([product]);

      expect(query.take).toHaveBeenCalledExactlyOnceWith(limit);
      expect(query.skip).toHaveBeenCalledExactlyOnceWith(30);
    },
  );

  it.each([0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid page size %s before querying storage',
    async (limit) => {
      await expect(
        getIngredientProductsService(userId, { limit }),
      ).rejects.toEqual(
        new HttpError(400, 'Limit must be an integer between 1 and 100.'),
      );
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    },
  );

  it.each([
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid offset %s before querying storage', async (offset) => {
    await expect(
      getIngredientProductsService(userId, { offset }),
    ).rejects.toEqual(
      new HttpError(400, 'Offset must be a nonnegative integer.'),
    );
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('product lookups', () => {
  it('looks up a product by both its exact bigint ID and the trusted owner', async () => {
    await expect(
      getIngredientProductByIdService(userId, productId),
    ).resolves.toBe(product);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      productId,
      userId,
    });
  });

  it('looks up a UPC within the trusted owner and preserves leading zeros', async () => {
    await expect(
      getIngredientProductByUpc(userId, ' 000123456789 '),
    ).resolves.toBe(product);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      upc: '000123456789',
      userId,
    });
  });

  it.each([
    {
      name: 'ID',
      lookup: () => getIngredientProductByIdService(userId, productId),
    },
    {
      name: 'UPC',
      lookup: () => getIngredientProductByUpc(userId, '000123456789'),
    },
  ])(
    'returns 404 for a scoped $name miss without falling back to a global lookup',
    async ({ lookup }) => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(lookup()).rejects.toEqual(
        new HttpError(404, 'Product not found.'),
      );
      expect(repository.findOneBy).toHaveBeenCalledTimes(1);
    },
  );
});

describe('createIngredientProductService', () => {
  it('uses the authenticated owner and whitelists product fields even with unchecked extra input', async () => {
    const uncheckedInput = {
      ...input,
      userId: 'forged-owner',
      user: { userId: 'forged-relation-owner' },
      productId: 'forged-product',
      createdAt: new Date('2000-01-01'),
      prices: [{ price: '0' }],
    };

    await expect(
      createIngredientProductService(userId, uncheckedInput),
    ).resolves.toBe(product);

    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      ...input,
      userId,
      brand: null,
      upc: null,
    });
    expect(repository.save).toHaveBeenCalledExactlyOnceWith(
      repository.create.mock.results[0].value,
    );
  });

  it('preserves supplied brand, UPC and decimal strings for storage', async () => {
    await createIngredientProductService(userId, {
      ...input,
      brand: 'Example Pantry',
      upc: '000123456789',
      packageQuantity: '0.0001',
    });

    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      ...input,
      userId,
      brand: 'Example Pantry',
      upc: '000123456789',
      packageQuantity: '0.0001',
    });
  });

  it('propagates duplicate-UPC errors for the HTTP error handler to translate', async () => {
    const duplicate = Object.assign(new Error('duplicate UPC'), {
      code: '23505',
      constraint: 'uq_product_user_upc',
    });
    repository.save.mockRejectedValue(duplicate);

    await expect(createIngredientProductService(userId, input)).rejects.toBe(
      duplicate,
    );
  });
});

describe('updateIngredientProductService', () => {
  it('scopes the write and refreshed read to the owner and excludes ownership or identity changes', async () => {
    const uncheckedInput = {
      productName: 'Strong flour',
      userId: 'forged-owner',
      user: { userId: 'forged-relation-owner' },
      productId: 'forged-product',
      createdAt: new Date('2000-01-01'),
    };

    await expect(
      updateIngredientProductService(userId, productId, uncheckedInput),
    ).resolves.toBe(product);

    const [criteria, changes] = repository.update.mock.calls[0];
    expect(criteria).toEqual({ userId, productId });
    expect(changes).toMatchObject({ productName: 'Strong flour' });
    for (const field of ['userId', 'user', 'productId', 'createdAt']) {
      expect(changes).not.toHaveProperty(field);
    }
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      userId,
      productId,
    });
  });

  it('sends explicit nulls for cleared optional fields while leaving omitted fields undefined', async () => {
    await updateIngredientProductService(userId, productId, {
      brand: null,
      upc: null,
    });

    const changes = repository.update.mock.calls[0][1];
    expect(changes.brand).toBeNull();
    expect(changes.upc).toBeNull();
    expect(changes.productName).toBeUndefined();
    expect(changes.packageQuantity).toBeUndefined();
    expect(changes.ingredientId).toBeUndefined();
    expect(changes.packageUnitId).toBeUndefined();
  });

  it('returns 404 for a scoped write miss without reading another owner’s product', async () => {
    repository.update.mockResolvedValue({ affected: 0 });

    await expect(
      updateIngredientProductService(userId, productId, { brand: null }),
    ).rejects.toEqual(new HttpError(404, 'Product not found.'));

    expect(repository.findOneBy).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('deleteIngredientProductService', () => {
  it('deletes using both the product ID and the authenticated owner', async () => {
    await expect(
      deleteIngredientProductService(userId, productId),
    ).resolves.toBeUndefined();

    expect(repository.delete).toHaveBeenCalledExactlyOnceWith({
      userId,
      productId,
    });
  });

  it('returns the same not-found error when the scoped delete affects no row', async () => {
    repository.delete.mockResolvedValue({ affected: 0 });

    await expect(
      deleteIngredientProductService(userId, productId),
    ).rejects.toEqual(new HttpError(404, 'Product not found.'));
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });
});

describe('product storage failures', () => {
  it.each([
    {
      name: 'list',
      operation: query.getMany,
      call: () => getIngredientProductsService(userId),
    },
    {
      name: 'ID lookup',
      operation: repository.findOneBy,
      call: () => getIngredientProductByIdService(userId, productId),
    },
    {
      name: 'UPC lookup',
      operation: repository.findOneBy,
      call: () => getIngredientProductByUpc(userId, '000123456789'),
    },
    {
      name: 'create',
      operation: repository.save,
      call: () => createIngredientProductService(userId, input),
    },
    {
      name: 'update',
      operation: repository.update,
      call: () =>
        updateIngredientProductService(userId, productId, { brand: null }),
    },
    {
      name: 'delete',
      operation: repository.delete,
      call: () => deleteIngredientProductService(userId, productId),
    },
  ])(
    'propagates a $name failure without converting it to not-found or success',
    async ({ operation, call }) => {
      const failure = new Error('database unavailable');
      operation.mockRejectedValue(failure);

      await expect(call()).rejects.toBe(failure);
    },
  );
});
