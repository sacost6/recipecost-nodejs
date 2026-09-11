export type IngredientRow = {
  ingredient_id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export type IngredientProductFilters = {
  ingredientId?: string;
  query?: string;
  brand?: string;
  limit?: number;
  offset?: number;
};
