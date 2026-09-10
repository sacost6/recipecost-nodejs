import * as z from 'zod';
import { positiveBigintIdSchema, positiveDecimal18_9Schema } from './utils';

const createIngredientUnitConversionBodySchema = z
  .strictObject({
    ingredientId: positiveBigintIdSchema,
    fromUnitId: z.number().int().positive().max(32767),
    toUnitId: z.number().int().positive().max(32767),
    conversionFactor: positiveDecimal18_9Schema,
  })
  .refine((body) => body.fromUnitId !== body.toUnitId, {
    message: 'Destination unit must differ from source unit',
    path: ['toUnitId'],
  });

const updateIngredientUnitConversionBodySchema = z.strictObject({
  conversionFactor: positiveDecimal18_9Schema,
});

export const createIngredientUnitConversionSchema = z.object({
  body: createIngredientUnitConversionBodySchema,
});

export const ingredientUnitConversionParamsSchema = z.object({
  params: z.object({
    ingredientId: positiveBigintIdSchema,
    fromUnitId: z.number().int().positive().max(32767),
    toUnitId: z.number().int().positive().max(32767),
  }),
});

export const updateIngredientUnitConversionSchema =
  ingredientUnitConversionParamsSchema.extend({
    body: updateIngredientUnitConversionBodySchema,
  });

export type CreateIngredientUnitConversionInput = z.infer<
  typeof createIngredientUnitConversionBodySchema
>;

export type UpdateIngredientUnitConversionInput = z.infer<
  typeof updateIngredientUnitConversionBodySchema
>;

export type IngredientUnitConversionParamsSchema = z.infer<
  typeof ingredientUnitConversionParamsSchema
>['params'];
