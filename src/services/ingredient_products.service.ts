import { ingredientProductRepository } from '../repositories/ingredient_products.repo';
import { IngredientProduct } from '../entities/IngredientProduct';
import {
  CreateIngredientProductInput,
  UpdateIngredientProductInput,
} from '../schemas/ingredient_product.schema';
import { HttpError } from '../utils/httpError';


export const getIngredientProductsService = async (): Promise<
  IngredientProduct[]
> => {
  return ingredientProductRepository.find({
    order: { productName: 'ASC' },
  });
};

export const getIngredientProductByIdService = async (
  productId: string,
): Promise<IngredientProduct> => {
  const ingredientProduct = await ingredientProductRepository.findOneBy({
    productId,
  });

  if (!ingredientProduct) {
    throw new HttpError(404, 'Product not found.');
  }

  return ingredientProduct;
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
