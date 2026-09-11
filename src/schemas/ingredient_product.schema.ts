import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal12_4Schema,
  positiveSmallintSchema,
  stringSchema,
} from './schema_utils';

const createIngredientProductBodySchema = z.strictObject({
  ingredientId: positiveBigintIdSchema,
  packageUnitId: positiveSmallintSchema,
  brand: stringSchema.max(100).nullable().optional(),
  productName: stringSchema.min(1, 'Product Name is required').max(150),
  packageQuantity: positiveDecimal12_4Schema,
  upc: stringSchema.max(20).nullable().optional(),
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
