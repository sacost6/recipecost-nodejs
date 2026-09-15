import * as z from 'zod';
import { positiveSmallintSchema } from './common.schema';

export const retailerParamsSchema = z.object({
  params: z.object({
    retailerId: z
      .string()
      .refine(
        (value) => positiveSmallintSchema.safeParse(Number(value)).success,
        {
          message: 'Unit ID must be an integer between 1 and 23767',
        },
      ),
  }),
});

export type RetailerParamsSchema = z.infer<
  typeof retailerParamsSchema
>['params'];
