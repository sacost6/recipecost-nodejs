import * as z from 'zod';

export const ingredientUnitSchema = z.enum([
  'lbs',
  'oz',
  'kg',
  'g',
  'gal',
  'units',
]);

export const createIngredientSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required'),
    category: z.string().trim().optional(),
    unit: ingredientUnitSchema,
    packageSize: z.number().positive('Package size must be a positive number'),
    packageCost: z.number().positive('Package cost must be a positive number'),
  }),
});
export const ingredientParamsSchema = z.object({
  params: z.object({
    ingredientId: z.string().trim().min(1, 'Ingredient ID is required'),
  }),
});

export const updateIngredientSchema = ingredientParamsSchema.extend({
  body: createIngredientSchema.shape.body
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required to update an ingredient',
      path: ['body'],
    }),
});

export type IngredientUnit = z.infer<typeof ingredientUnitSchema>;

export type CreateIngredientInput = z.infer<
  typeof createIngredientSchema
>['body'];

export type UpdateIngredientInput = z.infer<
  typeof updateIngredientSchema
>['body'];

export type IngredientParamsSchema = z.infer<
  typeof ingredientParamsSchema
>['params'];

export type Ingredient = CreateIngredientInput & {
  id: string;
  costPerUnit: number;
};
