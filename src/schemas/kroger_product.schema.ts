import * as z from 'zod';

const krogerProductParams = z.strictObject({
  upc: z
    .string()
    .trim()
    .regex(/^\d{1,20}$/, 'Enter a valid product UPC.'),
});

const krogerProductQuery = z.strictObject({
  locationId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,30}$/, 'Enter a valid Kroger location ID.'),
});

export const krogerProductLookupSchema = z.object({
  params: krogerProductParams,
  query: krogerProductQuery,
});

export type KrogerProductLookupParams = z.infer<typeof krogerProductParams>;

export type KrogerProductLookupQuery = z.infer<typeof krogerProductQuery>;
