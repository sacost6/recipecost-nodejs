import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import {
  createProductPriceService,
  deleteProductPriceService,
  getProductPriceByIdService,
  getProductPricesByProductIdService,
  getProductPricesService,
  updateProductPriceService,
} from './product_price.service';

const priceRepository = vi.hoisted(() => ({
  find: vi.fn(),
  findOneBy: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
const productRepository = vi.hoisted(() => ({ createQueryBuilder: vi.fn() }));
const productLookup = vi.hoisted(() => vi.fn());
const storeLookup = vi.hoisted(() => vi.fn());

vi.mock('../repositories/product_price.repo', () => ({
  productPriceRepository: priceRepository,
}));
vi.mock('../repositories/ingredient_product.repo', () => ({
  ingredientProductRepository: productRepository,
}));
vi.mock('./ingredient_product.service', () => ({
  getIngredientProductByIdService: productLookup,
}));
vi.mock('./store_location.service', () => ({
  getStoreLocationByIdService: storeLookup,
}));

const userId = '9007199254740993';
const productId = '9007199254740995';
const storeLocationId = '9007199254740997';
const priceId = '9007199254740999';
const price = {
  priceId,
  productId,
  storeLocationId,
  price: '3.49',
  currencyCode: 'USD',
  recordedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const input = {
  productId,
  storeLocationId,
  price: '3.49',
  currencyCode: 'USD',
};
const patch = { storeLocationId, price: '4.00', currencyCode: 'USD' };

const priceQuery = vi.hoisted(() => ({
  update: vi.fn(),
  delete: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  andWhere: vi.fn(),
  execute: vi.fn(),
}));
const ownedProductQuery = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  getQuery: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  priceRepository.find.mockResolvedValue([price]);
  priceRepository.findOneBy.mockResolvedValue(price);
  priceRepository.create.mockImplementation((value) => ({ ...value }));
  priceRepository.save.mockImplementation(async (value) => value);
  priceRepository.createQueryBuilder.mockReturnValue(priceQuery);
  priceQuery.update.mockReturnValue(priceQuery);
  priceQuery.delete.mockReturnValue(priceQuery);
  priceQuery.set.mockReturnValue(priceQuery);
  priceQuery.where.mockReturnValue(priceQuery);
  priceQuery.andWhere.mockReturnValue(priceQuery);
  priceQuery.execute.mockResolvedValue({ affected: 1 });
  productRepository.createQueryBuilder.mockReturnValue(ownedProductQuery);
  ownedProductQuery.select.mockReturnValue(ownedProductQuery);
  ownedProductQuery.where.mockReturnValue(ownedProductQuery);
  ownedProductQuery.getQuery.mockReturnValue(
    'SELECT product_id FROM ingredient_products WHERE owner_id = :userId',
  );
  productLookup.mockResolvedValue({ productId, userId });
  storeLookup.mockResolvedValue({ storeLocationId });
});

describe('product price reads', () => {
  it('lists prices only for products owned by the caller, newest first', async () => {
    await expect(getProductPricesService(userId)).resolves.toEqual([price]);
    expect(priceRepository.find).toHaveBeenCalledExactlyOnceWith({
      where: { product: { userId } },
      order: { recordedAt: 'DESC', priceId: 'DESC' },
    });
  });

  it('scopes a price lookup to its owner', async () => {
    await expect(getProductPriceByIdService(userId, priceId)).resolves.toBe(
      price,
    );
    expect(priceRepository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      priceId,
      product: { userId },
    });
  });

  it('returns 404 for a price that is missing or belongs to another user', async () => {
    priceRepository.findOneBy.mockResolvedValue(null);
    await expect(getProductPriceByIdService(userId, priceId)).rejects.toEqual(
      new HttpError(404, 'Price not found.'),
    );
    expect(priceRepository.findOneBy).toHaveBeenCalledWith({
      priceId,
      product: { userId },
    });
  });

  it('checks product ownership before listing price history', async () => {
    await expect(
      getProductPricesByProductIdService(userId, productId),
    ).resolves.toEqual([price]);
    expect(productLookup).toHaveBeenCalledExactlyOnceWith(userId, productId);
    expect(priceRepository.find).toHaveBeenCalledExactlyOnceWith({
      where: { productId, product: { userId } },
      order: { recordedAt: 'DESC', priceId: 'DESC' },
    });
  });

  it('does not query price history for an inaccessible product', async () => {
    const error = new HttpError(404, 'Product not found.');
    productLookup.mockRejectedValue(error);
    await expect(
      getProductPricesByProductIdService(userId, productId),
    ).rejects.toBe(error);
    expect(priceRepository.find).not.toHaveBeenCalled();
  });
});

describe('product price creation', () => {
  it('validates product ownership and store location before persisting a price', async () => {
    await expect(createProductPriceService(userId, input)).resolves.toEqual({
      ...input,
    });
    expect(productLookup).toHaveBeenCalledExactlyOnceWith(userId, productId);
    expect(storeLookup).toHaveBeenCalledExactlyOnceWith(storeLocationId);
    expect(priceRepository.create).toHaveBeenCalledExactlyOnceWith(input);
    expect(priceRepository.save).toHaveBeenCalledOnce();
  });

  it('does not look up a store or save when the product is inaccessible', async () => {
    const error = new HttpError(404, 'Product not found.');
    productLookup.mockRejectedValue(error);
    await expect(createProductPriceService(userId, input)).rejects.toBe(error);
    expect(storeLookup).not.toHaveBeenCalled();
    expect(priceRepository.create).not.toHaveBeenCalled();
    expect(priceRepository.save).not.toHaveBeenCalled();
  });

  it('does not save when the store location does not exist', async () => {
    const error = new HttpError(404, 'Store location does not exist.');
    storeLookup.mockRejectedValue(error);
    await expect(createProductPriceService(userId, input)).rejects.toBe(error);
    expect(priceRepository.create).not.toHaveBeenCalled();
    expect(priceRepository.save).not.toHaveBeenCalled();
  });
});

describe('product price mutation ownership', () => {
  it('updates only a price linked to one of the caller-owned products, then returns the row', async () => {
    const result = await updateProductPriceService(userId, priceId, patch);

    expect(
      productRepository.createQueryBuilder,
    ).toHaveBeenCalledExactlyOnceWith('ownedProduct');
    expect(ownedProductQuery.select).toHaveBeenCalledExactlyOnceWith(
      'ownedProduct.productId',
    );
    expect(ownedProductQuery.where).toHaveBeenCalledExactlyOnceWith(
      'ownedProduct.userId = :userId',
    );
    expect(priceQuery.update).toHaveBeenCalledOnce();
    expect(priceQuery.set).toHaveBeenCalledExactlyOnceWith(patch);
    expect(priceQuery.where).toHaveBeenCalledExactlyOnceWith(
      '"price_id" = :priceId',
      { priceId },
    );
    expect(priceQuery.andWhere).toHaveBeenCalledExactlyOnceWith(
      '"product_id" IN (SELECT product_id FROM ingredient_products WHERE owner_id = :userId)',
      { userId },
    );
    expect(result).toBe(price);
    expect(priceRepository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      priceId,
      product: { userId },
    });
  });

  it('returns 404 when no caller-owned price row is updated', async () => {
    priceQuery.execute.mockResolvedValue({ affected: 0 });
    await expect(
      updateProductPriceService(userId, priceId, patch),
    ).rejects.toEqual(new HttpError(404, 'Price not found.'));
    expect(priceRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('deletes only a price linked to a caller-owned product', async () => {
    await expect(
      deleteProductPriceService(userId, priceId),
    ).resolves.toBeUndefined();
    expect(priceQuery.delete).toHaveBeenCalledOnce();
    expect(priceQuery.where).toHaveBeenCalledExactlyOnceWith(
      '"price_id" = :priceId',
      { priceId },
    );
    expect(priceQuery.andWhere).toHaveBeenCalledExactlyOnceWith(
      '"product_id" IN (SELECT product_id FROM ingredient_products WHERE owner_id = :userId)',
      { userId },
    );
    expect(priceQuery.execute).toHaveBeenCalledOnce();
  });

  it('returns 404 instead of succeeding when an owner-scoped delete misses', async () => {
    priceQuery.execute.mockResolvedValue({ affected: 0 });
    await expect(deleteProductPriceService(userId, priceId)).rejects.toEqual(
      new HttpError(404, 'Price not found.'),
    );
  });
});
