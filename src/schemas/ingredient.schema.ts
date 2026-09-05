import * as z from 'zod';

const createIngredientBodySchema = z.strictObject({
  name: z.string().trim().min(1, 'Name is required').max(100),
  categoryId: z.number().int().positive().max(32767).nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

const updateIngredientBodySchema = createIngredientBodySchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'At least one field is required to update an ingredient',
  });

export const createIngredientSchema = z.object({
  body: createIngredientBodySchema,
});

export const ingredientParamsSchema = z.object({
  params: z.object({
    ingredientId: z.string().trim().min(1, 'Ingredient ID is required'),
  }),
});

export const updateIngredientSchema = ingredientParamsSchema.extend({
  body: updateIngredientBodySchema,
});

export type CreateIngredientInput = z.infer<typeof createIngredientBodySchema>;

export type UpdateIngredientInput = z.infer<typeof updateIngredientBodySchema>;
