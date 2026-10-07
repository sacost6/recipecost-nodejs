import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal12_4Schema,
  positiveSmallintSchema,
  stringSchema,
} from './common.schema';

const createRecipeBodySchema = z.strictObject({
  name: stringSchema.min(1, 'Recipe name is required').max(150),
  description: stringSchema.max(5000).nullable().optional(),
  instructions: stringSchema.max(50000).default(''),
  servings: positiveSmallintSchema,
});

const updateRecipeBodySchema = createRecipeBodySchema
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    {
      message: 'At least one field is required to update a recipe',
    },
  );

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

export const recipeParamsSchema = z.object({
  params: z.object({
    recipeId: positiveBigintIdSchema,
  }),
});

export const recipeIngredientParamsSchema = z.object({
  params: z.object({
    recipeId: positiveBigintIdSchema,
    recipeIngredientId: positiveBigintIdSchema,
  }),
});

export const createRecipeSchema = z.object({
  body: createRecipeBodySchema,
});

export const updateRecipeSchema = recipeParamsSchema.extend({
  body: updateRecipeBodySchema,
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

export type CreateRecipeInput = z.infer<typeof createRecipeBodySchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeBodySchema>;
export type CreateRecipeIngredientInput = z.infer<
  typeof createRecipeIngredientBodySchema
>;
export type UpdateRecipeIngredientInput = z.infer<
  typeof updateRecipeIngredientBodySchema
>;
export type RecipeParams = z.infer<typeof recipeParamsSchema>['params'];
export type RecipeIngredientParams = z.infer<
  typeof recipeIngredientParamsSchema
>['params'];
