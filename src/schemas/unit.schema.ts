import * as z from 'zod';
import { positiveSmallintSchema } from './common.schema';

export const unitParamsSchema = z.object({
  params: z.object({
    unitId: z
      .string()
      .refine(
        (value) => positiveSmallintSchema.safeParse(Number(value)).success,
        { message: 'Unit ID must be an integer between 1 and 32767' },
      ),
  }),
});

export type UnitParamsSchema = z.infer<typeof unitParamsSchema>['params'];
