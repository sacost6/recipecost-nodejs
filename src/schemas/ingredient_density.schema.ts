import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveIntegerSchema,
  stringSchema,
} from './common.schema';

export const ingredientDensityParamsSchema = z.object({
  params: z.object({ ingredientId: positiveBigintIdSchema }),
});

export const searchIngredientDensityFoodsSchema =
  ingredientDensityParamsSchema.extend({
    body: z.strictObject({
      query: stringSchema.min(2).max(200).optional(),
    }),
  });

export const ingredientDensitySuggestionsSchema = z.object({
  params: z.object({
    ingredientId: positiveBigintIdSchema,
    fdcId: z.coerce.number().int().positive().max(2147483647),
  }),
});

export const saveIngredientDensitySchema = ingredientDensityParamsSchema.extend(
  {
    body: z.strictObject({
      fdcId: positiveIntegerSchema,
      portionId: positiveIntegerSchema,
    }),
  },
);

export type IngredientDensityParams = z.infer<
  typeof ingredientDensityParamsSchema
>['params'];
export type SearchIngredientDensityFoodsInput = z.infer<
  typeof searchIngredientDensityFoodsSchema
>['body'];
export type IngredientDensitySuggestionsParams = z.infer<
  typeof ingredientDensitySuggestionsSchema
>['params'];
export type SaveIngredientDensityInput = z.infer<
  typeof saveIngredientDensitySchema
>['body'];
