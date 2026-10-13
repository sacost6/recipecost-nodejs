import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal12_4Schema,
  positiveSmallintSchema,
} from './common.schema';
import { recipeParamsSchema } from './recipe.schema';

const createRecipeIngredientBodySchema = z.strictObject({
  ingredientId: positiveBigintIdSchema,
  quantity: positiveDecimal12_4Schema,
  unitId: positiveSmallintSchema,
  sortOrder: z.number().int().nonnegative().optional(),
});

const updateRecipeIngredientBodySchema = createRecipeIngredientBodySchema
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    {
      message: 'At least one field is required to update a recipe ingredient',
    },
  );

export const recipeIngredientParamsSchema = z.object({
  params: z.object({
    recipeId: positiveBigintIdSchema,
    recipeIngredientId: positiveBigintIdSchema,
  }),
});

export const createRecipeIngredientSchema = recipeParamsSchema.extend({
  body: createRecipeIngredientBodySchema,
});

export const updateRecipeIngredientSchema = recipeIngredientParamsSchema.extend(
  {
    body: updateRecipeIngredientBodySchema,
  },
);

export const deleteRecipeIngredientSchema = recipeIngredientParamsSchema;

export type CreateRecipeIngredientInput = z.infer<
  typeof createRecipeIngredientBodySchema
>;

export type UpdateRecipeIngredientInput = z.infer<
  typeof updateRecipeIngredientBodySchema
>;

export type RecipeIngredientParams = z.infer<
  typeof recipeIngredientParamsSchema
>['params'];
