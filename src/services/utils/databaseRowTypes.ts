import type { DatabaseRow } from '../../types/database-row';
import { Ingredient } from '../../entities/Ingredient';
import { IngredientProduct } from '../../entities/IngredientProduct';
import { Recipe } from '../../entities/Recipe';

export type IngredientRow = DatabaseRow<
  Omit<Ingredient, 'user' | 'category' | 'products' | 'unitConversions'>
>;

export type IngredientProductRow = DatabaseRow<
  Omit<IngredientProduct, 'user' | 'ingredient' | 'packageUnit' | 'prices'>
>;

export type RecipeRow = DatabaseRow<Omit<Recipe, 'user' | 'ingredients'>>;
