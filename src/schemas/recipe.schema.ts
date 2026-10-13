import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveSmallintSchema,
  stringSchema,
} from './common.schema';

const recipeFields = {
  name: stringSchema.min(1, 'Recipe name is required').max(150),
  description: stringSchema.max(5000).nullable().optional(),
  instructions: stringSchema.max(50000),
  servings: positiveSmallintSchema,
};

const createRecipeBodySchema = z.strictObject({
  ...recipeFields,
  instructions: recipeFields.instructions.default(''),
});

const updateRecipeBodySchema = z
  .strictObject(recipeFields)
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    {
      message: 'At least one field is required to update a recipe',
    },
  );

export const recipeParamsSchema = z.object({
  params: z.object({
    recipeId: positiveBigintIdSchema,
  }),
});

export const createRecipeSchema = z.object({
  body: createRecipeBodySchema,
});

export const updateRecipeSchema = recipeParamsSchema.extend({
  body: updateRecipeBodySchema,
});

export type CreateRecipeInput = z.infer<typeof createRecipeBodySchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeBodySchema>;

export type RecipeParams = z.infer<typeof recipeParamsSchema>['params'];
