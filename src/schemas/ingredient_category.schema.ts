import * as z from 'zod';
import { positiveSmallintSchema } from './common.schema';
import { unitParamsSchema } from './unit.schema';

export const ingredientCategoryParamsSchema = z.object({
  params: z.object({
    categoryId: z
      .string()
      .refine(
        (value) => positiveSmallintSchema.safeParse(Number(value)).success,
        {
          message:
            'Ingredient Category ID must be an integer between 1 and 32767',
        },
      ),
  }),
});

export type IngredientCategoryParamsSchema = z.infer<
  typeof ingredientCategoryParamsSchema
>['params'];
