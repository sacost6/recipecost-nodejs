import { ingredientProductRepository } from '../repositories/ingredient_products.repo';
import { IngredientProduct } from '../entities/IngredientProduct';
import {
  CreateIngredientProductInput,
  UpdateIngredientProductInput,
} from '../schemas/ingredient_product.schema';
import { HttpError } from '../middleware/errorHandling/utils';
import { IngredientProductFilters } from './service_utils';

export const getIngredientProductsService = async (
  filters: IngredientProductFilters = {},
): Promise<IngredientProduct[]> => {
  const { ingredientId, query, brand, limit = 25, offset = 0 } = filters;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Limit must be an integer between 1 and 100.');
  }

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new HttpError(400, 'Offset must be a nonnegative integer.');
  }

  const products = ingredientProductRepository.createQueryBuilder('product');

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
      { search: '%&{escapedTerm}%' },
    );
  }

  return products
    .orderBy('product.productName', 'ASC')
    .addOrderBy('product.productId', 'ASC')
    .take(limit)
    .skip(offset)
    .getMany();
};

export const getIngredientProductByIdService = async (
  productId: string,
): Promise<IngredientProduct> => {
  const product = await ingredientProductRepository.findOneBy({
    productId,
  });

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  return product;
};

export const createIngredientProductService = async (
  input: CreateIngredientProductInput,
): Promise<IngredientProduct> => {
  const ingredientProduct = ingredientProductRepository.create({
    ingredientId: input.ingredientId,
    packageUnitId: input.packageUnitId,
    brand: input.brand ?? null,
    productName: input.productName,
    packageQuantity: input.packageQuantity,
    upc: input.upc ?? null,
  });

  return ingredientProductRepository.save(ingredientProduct);
};

export const getIngredientProductByUpc = async (
  upc: string,
): Promise<IngredientProduct> => {
  const product = await ingredientProductRepository.findOneBy({
    upc: upc.trim(),
  });

  if (!product) {
    throw new HttpError(404, 'Product not found.');
  }

  return product;
};

export const updateIngredientProductService = async (
  productId: string,
  input: UpdateIngredientProductInput,
): Promise<IngredientProduct> => {
  const ingredientProduct = await getIngredientProductByIdService(productId);

  ingredientProductRepository.merge(ingredientProduct, input);

  return ingredientProductRepository.save(ingredientProduct);
};

export const deleteIngredientProductService = async (
  productId: string,
): Promise<void> => {
  const result = await ingredientProductRepository.delete({ productId });

  if (result.affected === 0) {
    throw new HttpError(404, 'Product not found.');
  }
};
