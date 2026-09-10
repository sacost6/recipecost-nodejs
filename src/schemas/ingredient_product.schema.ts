import * as z from 'zod';
import { positiveBigintIdSchema, positiveDecimal12_4Schema } from './utils';

const createIngredientProductBodySchema = z.strictObject({
  ingredientId: positiveBigintIdSchema,
  packageUnitId: z.number().int().positive().max(32767),
  brand: z.string().trim().max(100).nullable().optional(),
  productName: z.string().trim().min(1, 'Product Name is required').max(150),
  packageQuantity: positiveDecimal12_4Schema,
  upc: z.string().trim().max(20).nullable().optional(),
});

const updateIngredientProductBodySchema = createIngredientProductBodySchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'At least one field is required to update an ingredient product.',
  });

export const createIngredientProductSchema = z.object({
  body: createIngredientProductBodySchema,
});

export const ingredientProductParamsSchema = z.object({
  params: z.object({
    productId: positiveBigintIdSchema,
  }),
});

export const updateIngredientProductSchema =
  ingredientProductParamsSchema.extend({
    body: updateIngredientProductBodySchema,
  });

export type CreateIngredientProductInput = z.infer<
  typeof createIngredientProductBodySchema
>;

export type UpdateIngredientProductInput = z.infer<
  typeof updateIngredientProductBodySchema
>;

export type IngredientProductParamsSchema = z.infer<
  typeof ingredientProductParamsSchema
>['params'];
