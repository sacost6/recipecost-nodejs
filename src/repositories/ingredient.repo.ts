import { AppDataSource } from '../data-source';
import { Ingredient } from '../entities/Ingredient';

export const ingredientRepository = AppDataSource.getRepository(Ingredient);

export type IngredientRow = {
  ingredient_id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};
