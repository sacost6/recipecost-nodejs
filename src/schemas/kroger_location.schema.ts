import * as z from 'zod';

const krogerLocationSearchQuery = z.strictObject({
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(?:-\d{4})?$/, 'Enter a valid US ZIP code.'),
  radiusInMiles: z.coerce.number().int().min(1).max(100).default(10),
});

export const krogerLocationSearchSchema = z.object({
  query: krogerLocationSearchQuery,
});

export type KrogerLocationSearchQuery = z.infer<
  typeof krogerLocationSearchQuery
>;
