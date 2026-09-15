import { ingredientCategoryRepository } from '../repositories/ingredient_category.repo';
import { IngredientCategory } from '../entities/IngredientCategory';
import { HttpError } from '../middleware/errorHandling/error';

export const getIngredientCategoriesService = async (): Promise<
  IngredientCategory[]
> => {
  return ingredientCategoryRepository.find({
    order: { name: 'ASC' },
  });
};

export const getIngredientCategoryByIdService = async (
  categoryId: number,
): Promise<IngredientCategory> => {
  const ingredientCategory = await ingredientCategoryRepository.findOneBy({
    categoryId,
  });

  if (!ingredientCategory) {
    throw new HttpError(404, 'Ingredient Category does not exist.');
  }

  return ingredientCategory;
};
