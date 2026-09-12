import * as z from 'zod';
import {
  positiveSmallintSchema,
  positiveIntegerSchema,
  stringSchema,
  positiveBigintIdSchema,
} from './common.schema';

const createIngredientBodySchema = z.strictObject({
  name: stringSchema.min(1, 'Name is required').max(100),
  categoryId: positiveSmallintSchema.nullable().optional(),
  description: stringSchema.nullable().optional(),
});

const updateIngredientBodySchema = createIngredientBodySchema
  .partial()
  .extend({
    version: positiveIntegerSchema,
  })
  .refine(
    ({ version: _version, ...changes }) =>
      Object.values(changes).some((value) => value !== undefined),
    {
      message: 'At least one field is required to update an ingredient',
    },
  );

export const createIngredientSchema = z.object({
  body: createIngredientBodySchema,
});

export const ingredientParamsSchema = z.object({
  params: z.object({
    ingredientId: positiveBigintIdSchema,
  }),
});

export const updateIngredientSchema = ingredientParamsSchema.extend({
  body: updateIngredientBodySchema,
});

export type CreateIngredientInput = z.infer<typeof createIngredientBodySchema>;

export type UpdateIngredientInput = z.infer<typeof updateIngredientBodySchema>;

export type IngredientParamsSchema = z.infer<
  typeof ingredientParamsSchema
>['params'];
