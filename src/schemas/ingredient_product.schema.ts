import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal12_4Schema,
  positiveSmallintSchema,
  stringSchema,
} from './common.schema';

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

const queryIntegerSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Must be a nonnegative whole number')
  .transform(Number)
  .pipe(z.number().int().nonnegative());

const ingredientProductQuerySchema = z.strictObject({
  ingredientId: positiveBigintIdSchema.optional(),
  query: stringSchema.max(150).optional(),
  brand: stringSchema.max(100).optional,

  limit: queryIntegerSchema.pipe(z.number().min(1).max(100)).default(25),

  offset: queryIntegerSchema.default(0),
});

export const listIngredientProductSchema = z.object({
  query: ingredientProductQuerySchema,
});

export type ListIngredientProductsQuery = z.infer<
  typeof ingredientProductQuerySchema
>;

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
