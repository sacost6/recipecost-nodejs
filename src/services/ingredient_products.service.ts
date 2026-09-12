import { ingredientProductRepository } from '../repositories/ingredient_products.repo';
import { IngredientProduct } from '../entities/IngredientProduct';
import {
  CreateIngredientProductInput,
  UpdateIngredientProductInput,
} from '../schemas/ingredient_product.schema';
import { HttpError } from '../middleware/errorHandling/error';
import { getIngredientByIdService } from './ingredients.service';

type IngredientProductFilters = {
  ingredientId?: string;
  query?: string;
  brand?: string;
  limit?: number;
  offset?: number;
};

export const getIngredientProductsService = async (
  userId: string,
  filters: IngredientProductFilters = {},
): Promise<IngredientProduct[]> => {
  const { ingredientId, query, brand, limit = 25, offset = 0 } = filters;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Limit must be an integer between 1 and 100.');
  }

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new HttpError(400, 'Offset must be a nonnegative integer.');
  }

  const products = ingredientProductRepository
    .createQueryBuilder('product')
    .where('product.userId = :userId', { userId });

  if (ingredientId !== undefined) {
    products.andWhere('product.ingredientId = :ingredientId', {
      ingredientId,
    });
  }

  const searchTerm = query?.trim();

  if (searchTerm) {
    // Treat %, _, / like literal search characters
    const escapedTerm = searchTerm.replace(/[\\%_]/g, '\\$&');

    products.andWhere(
      '(product.productName ILIKE :search OR product.brand ILIKE :search)',
      { search: `%${escapedTerm}%` },
    );
  }

  const brandFilter = brand?.trim();

  if (brandFilter) {
    products.andWhere('LOWER(product.brand) = LOWER(:brand)', {
      brand: brandFilter,
    });
  }

  return products
    .orderBy('product.productName', 'ASC')
    .addOrderBy('product.productId', 'ASC')
    .take(limit)
    .skip(offset)
    .getMany();
};

export const getIngredientProductByIdService = async (
  userId: string,
  productId: string,
): Promise<IngredientProduct> => {
  const product = await ingredientProductRepository.findOneBy({
    productId,
    userId,
  });

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  return product;
};

export const createIngredientProductService = async (
  userId: string,
  input: CreateIngredientProductInput,
): Promise<IngredientProduct> => {
  await getIngredientByIdService(userId, input.ingredientId);
  const ingredientProduct = ingredientProductRepository.create({
    userId: userId,
    ingredientId: input.ingredientId,
    packageUnitId: input.packageUnitId,
    brand: input.brand ?? null,
    productName: input.productName,
    packageQuantity: input.packageQuantity,
    upc: input.upc ?? null,
  });

  return ingredientProductRepository.save(ingredientProduct);
};

export const getIngredientProductByUpcService = async (
  userId: string,
  upc: string,
): Promise<IngredientProduct> => {
  const product = await ingredientProductRepository.findOneBy({
    upc: upc.trim(),
    userId,
  });

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  return product;
};

export const updateIngredientProductService = async (
  userId: string,
  productId: string,
  input: UpdateIngredientProductInput,
): Promise<IngredientProduct> => {
  await getIngredientByIdService(userId, input.ingredientId);
  const result = await ingredientProductRepository.update(
    { productId, userId },
    {
      ingredientId: input.ingredientId,
      packageUnitId: input.packageUnitId,
      brand: input.brand,
      productName: input.productName,
      packageQuantity: input.packageQuantity,
      upc: input.upc,
    },
  );

  if (result.affected === 0) {
    throw new HttpError(404, 'Product not found.');
  }

  return getIngredientProductByIdService(userId, productId);
};

export const deleteIngredientProductService = async (
  userId: string,
  productId: string,
): Promise<void> => {
  const result = await ingredientProductRepository.delete({
    productId,
    userId,
  });

  if (result.affected === 0) {
    throw new HttpError(404, 'Product not found.');
  }
};
