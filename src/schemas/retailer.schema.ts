import * as z from 'zod';
import { positiveBigintIdSchema } from './common.schema';

export const retailerParamsSchema = z.object({
  params: z.object({
    retailerId: positiveBigintIdSchema,
  }),
});
export type RetailerParamsSchema = z.infer<
  typeof retailerParamsSchema
>['params'];
