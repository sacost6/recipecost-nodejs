import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal12_4Schema,
  positiveIntegerSchema,
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
  .extend({
    version: positiveIntegerSchema,
  })
  .required({ ingredientId: true });

const queryIntegerSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Must be a nonnegative whole number')
  .transform(Number)
  .pipe(z.number().int().nonnegative());

const ingredientProductQuerySchema = z.strictObject({
  ingredientId: positiveBigintIdSchema.optional(),
  query: stringSchema.max(150).optional(),
  brand: stringSchema.max(100).optional(),

  limit: queryIntegerSchema.pipe(z.number().min(1).max(100)).default(25),

  offset: queryIntegerSchema.default(0),
});

export const listIngredientProductSchema = z.object({
  query: ingredientProductQuerySchema,
});

export const createIngredientProductSchema = z.object({
  body: createIngredientProductBodySchema,
});

export const ingredientProductParams = z.object({
  params: z.object({
    productId: positiveBigintIdSchema,
  }),
});

export const ingredientProductUpcParams = z.object({
  params: z.object({
    upc: stringSchema.max(20),
  }),
});

export const updateIngredientProductSchema = ingredientProductParams.extend({
  body: updateIngredientProductBodySchema,
});

export type IngredientProductUpcParams = z.infer<
  typeof ingredientProductUpcParams
>['params'];

export type ListIngredientProductsQuery = z.infer<
  typeof ingredientProductQuerySchema
>;

export type CreateIngredientProductInput = z.infer<
  typeof createIngredientProductBodySchema
>;

export type UpdateIngredientProductInput = z.infer<
  typeof updateIngredientProductBodySchema
>;

export type IngredientProductParams = z.infer<
  typeof ingredientProductParams
>['params'];
