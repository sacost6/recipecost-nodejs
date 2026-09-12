import type { DatabaseRow } from '../../types/database-row';
import { Ingredient } from '../../entities/Ingredient';
import { IngredientProduct } from '../../entities/IngredientProduct';

export type IngredientRow = DatabaseRow<
  Omit<Ingredient, 'user' | 'category' | 'products' | 'unitConversions'>
>;

export type IngredientProductRow = DatabaseRow<
  Omit<IngredientProduct, 'user' | 'ingredient' | 'packageUnit' | 'prices'>
>;
