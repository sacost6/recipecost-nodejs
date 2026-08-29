import * as z from 'zod';

export const createIngredientSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    unit: z.string().min(1, 'Unit is required'),
    packageSize: z
      .number()
      .int()
      .positive('Package size must be a positive integer'),
    packageCost: z.number().positive('Package cost must be a positive number'),
  }),
});

export const updateIngredientSchema = z.object({
  params: z.object({
    ingredientId: z.string().min(1, 'Ingredient ID is required'),
  }),
  body: createIngredientSchema.shape.body.partial(),
});

export type CreateIngredientInput = z.infer<
  typeof createIngredientSchema
>['body'];

export type UpdateIngredientInput = z.infer<
  typeof updateIngredientSchema
>['body'];

export type Ingredient = CreateIngredientInput & {
  id: string;
  costPerUnit: number;
};

export type IngredientParamsSchema = z.infer<
  typeof updateIngredientSchema
>['params'];
