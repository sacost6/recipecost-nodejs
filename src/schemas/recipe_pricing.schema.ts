import * as z from 'zod';
import { positiveBigintIdSchema } from './common.schema';
import { recipeParamsSchema } from './recipe.schema';

export const recipePricingSchema = recipeParamsSchema.extend({
  query: z.strictObject({ storeLocationId: positiveBigintIdSchema }),
});

export type RecipePricingParams = z.infer<typeof recipePricingSchema>['params'];
export type RecipePricingQuery = z.infer<typeof recipePricingSchema>['query'];
