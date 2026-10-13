import * as z from 'zod';
import {
  positiveBigintIdSchema,
  positiveDecimal18_9Schema,
  positiveSmallintSchema,
} from './common.schema';

const positiveSmallintPathSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(32767);

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

export const ingredientUnitConversionByIdParamsSchema = z.object({
  params: z.object({
    ingredientId: positiveBigintIdSchema,
    fromUnitId: positiveSmallintPathSchema,
    toUnitId: positiveSmallintPathSchema,
  }),
});

export const ingredientUnitConversionByIngredientIdParamsSchema = z.object({
  params: z.object({
    ingredientId: positiveBigintIdSchema,
  }),
});

export const updateIngredientUnitConversionSchema =
  ingredientUnitConversionByIdParamsSchema.extend({
    body: updateIngredientUnitConversionBodySchema,
  });

export type CreateIngredientUnitConversionInput = z.infer<
  typeof createIngredientUnitConversionBodySchema
>;

export type UpdateIngredientUnitConversionInput = z.infer<
  typeof updateIngredientUnitConversionBodySchema
>;

export type IngredientUnitConversionByIdParamsSchema = z.infer<
  typeof ingredientUnitConversionByIdParamsSchema
>['params'];

export type IngredientUnitConversionByIngredientIdParamsSchema = z.infer<
  typeof ingredientUnitConversionByIngredientIdParamsSchema
>['params'];
