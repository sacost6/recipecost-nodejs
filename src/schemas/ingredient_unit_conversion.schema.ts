import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal18_9Schema,
  positiveSmallintSchema,
} from './common.schema';

const createIngredientUnitConversionBodySchema = z
  .strictObject({
    ingredientId: positiveBigintIdSchema,
    fromUnitId: positiveSmallintSchema,
    toUnitId: positiveSmallintSchema,
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
    fromUnitId: positiveSmallintSchema,
    toUnitId: positiveSmallintSchema,
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
