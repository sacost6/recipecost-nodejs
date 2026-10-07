import { AppDataSource } from '../data-source';
import { RecipeIngredient } from '../entities/RecipeIngredient';

export const recipeIngredientRepository =
  AppDataSource.getRepository(RecipeIngredient);
