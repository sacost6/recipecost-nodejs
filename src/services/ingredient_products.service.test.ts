import { IngredientProduct } from '../entities/IngredientProduct';
import { metadataSource } from '../test-utils/entityMetadata';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import {
  createIngredientProductService,
  deleteIngredientProductService,
  getIngredientProductByIdService,
  getIngredientProductByUpcService,
  getIngredientProductsService,
  updateIngredientProductService,
} from './ingredient_products.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  update: vi.fn(),
  existsBy: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
const ingredientLookup = vi.hoisted(() => vi.fn());
vi.mock('./ingredients.service', () => ({
  getIngredientByIdService: ingredientLookup,
}));
const source = metadataSource();
beforeAll(async () => {
  await source.prepareMetadata();
  const real = source.getRepository(IngredientProduct);
  Object.defineProperties(repository, {
    metadata: { get: () => real.metadata },
    manager: { get: () => real.manager },
  });
});
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
const product = {
  ...input,
  userId,
  productId,
  brand: null,
  upc: null,
  version: 4,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};
const patch = { ingredientId: input.ingredientId, version: 3 };
const row = {
  product_id: productId,
  ingredient_id: input.ingredientId,
  package_unit_id: 1,
  product_name: input.productName,
  package_quantity: input.packageQuantity,
  user_id: userId,
  brand: null,
  upc: null,
  version: 4,
  created_at: product.createdAt,
  updated_at: product.updatedAt,
};

beforeEach(() => {
  vi.resetAllMocks();
  repository.create.mockImplementation((values) =>
    source.getRepository(IngredientProduct).create(values ?? {}),
  );
  ingredientLookup.mockResolvedValue({ ingredientId: input.ingredientId });
  repository.save.mockResolvedValue(product);
  repository.findOneBy.mockResolvedValue(product);
  repository.update.mockResolvedValue({ affected: 1, raw: [row] });
  repository.existsBy.mockResolvedValue(false);
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
      getIngredientProductByUpcService(userId, ' 000123456789 '),
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
      lookup: () => getIngredientProductByUpcService(userId, '000123456789'),
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
  it('matches owner and expected version atomically and returns the written row without a reread', async () => {
    repository.findOneBy.mockResolvedValue({ ...product, version: 99 });
    const uncheckedInput = {
      ...patch,
      productName: 'Strong flour',
      userId: 'forged',
      user: { userId: 'forged' },
      productId: 'forged',
      createdAt: new Date(0),
    };
    const updated = await updateIngredientProductService(
      userId,
      productId,
      uncheckedInput,
    );
    expect(updated).toBeInstanceOf(IngredientProduct);
    expect(updated).toEqual(product);
    const [criteria, changes, options] = repository.update.mock.calls[0];
    expect(criteria).toEqual({ productId, userId, version: 3 });
    expect(options).toEqual({ returning: '*' });
    expect(changes).toMatchObject({
      productName: 'Strong flour',
      ingredientId: input.ingredientId,
    });
    for (const field of ['version', 'userId', 'user', 'productId', 'createdAt'])
      expect(changes).not.toHaveProperty(field);
    expect(repository.findOneBy).not.toHaveBeenCalled();
    expect(repository.existsBy).not.toHaveBeenCalled();
    expect(ingredientLookup).toHaveBeenCalledExactlyOnceWith(
      userId,
      input.ingredientId,
    );
  });

  it('preserves explicit nulls and leaves omitted optional fields undefined', async () => {
    await updateIngredientProductService(userId, productId, {
      ...patch,
      brand: null,
      upc: null,
    });
    const changes = repository.update.mock.calls[0][1];
    expect(changes).toMatchObject({
      ingredientId: input.ingredientId,
      brand: null,
      upc: null,
    });
    expect(changes.productName).toBeUndefined();
    expect(changes.packageQuantity).toBeUndefined();
    expect(changes.packageUnitId).toBeUndefined();
  });

  it.each([
    { found: false, status: 404 },
    { found: true, status: 409 },
  ])(
    'returns $status for an empty returned row using owner-scoped existence',
    async ({ found, status }) => {
      repository.update.mockResolvedValue({ affected: 0, raw: [] });
      repository.existsBy.mockResolvedValue(found);
      await expect(
        updateIngredientProductService(userId, productId, patch),
      ).rejects.toMatchObject({ statusCode: status });
      expect(repository.existsBy).toHaveBeenCalledExactlyOnceWith({
        productId,
        userId,
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.findOneBy).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('propagates failure of the post-update existence check', async () => {
    const error = new Error('database unavailable');
    repository.update.mockResolvedValue({ affected: 0, raw: [] });
    repository.existsBy.mockRejectedValue(error);
    await expect(
      updateIngredientProductService(userId, productId, patch),
    ).rejects.toBe(error);
  });
});

describe('ingredient visibility before product writes', () => {
  it.each(['create', 'update'] as const)(
    'prevents %s when the ingredient is inaccessible',
    async (operation) => {
      const error = new HttpError(404, 'Ingredient not found');
      ingredientLookup.mockRejectedValue(error);
      const pending =
        operation === 'create'
          ? createIngredientProductService(userId, input)
          : updateIngredientProductService(userId, productId, patch);
      await expect(pending).rejects.toBe(error);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    },
  );
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
      call: () => getIngredientProductByUpcService(userId, '000123456789'),
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
        updateIngredientProductService(userId, productId, {
          ...patch,
          brand: null,
        }),
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
