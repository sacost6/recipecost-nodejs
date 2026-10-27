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

const krogerProductSearchQuery = z.strictObject({
  term: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .refine((term) => term.split(/\s+/).length <= 8, 'Enter a shorter search.'),
  locationId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,30}$/, 'Enter a valid Kroger location ID.'),
});

export const krogerProductSuggestionSchema = z.strictObject({
  upc: z
    .string()
    .regex(/^\d{1,20}$/)
    .nullable(),
  productName: z.string().trim().min(1).max(300),
  brand: z.string().trim().min(1).max(100).nullable(),
  packageSize: z.string().trim().min(1).max(100).nullable(),
  regularPrice: z
    .string()
    .regex(/^\d{1,10}\.\d{2}$/)
    .nullable(),
  promoPrice: z
    .string()
    .regex(/^\d{1,10}\.\d{2}$/)
    .nullable(),
  currentPrice: z
    .string()
    .regex(/^\d{1,10}\.\d{2}$/)
    .nullable(),
});

export const krogerProductLookupSchema = z.object({
  params: krogerProductParams,
  query: krogerProductQuery,
});

export const krogerProductSearchSchema = z.object({
  query: krogerProductSearchQuery,
});

export type KrogerProductLookupParams = z.infer<typeof krogerProductParams>;

export type KrogerProductLookupQuery = z.infer<typeof krogerProductQuery>;

export type KrogerProductSearchQuery = z.infer<typeof krogerProductSearchQuery>;

export type KrogerProductSuggestion = z.infer<
  typeof krogerProductSuggestionSchema
>;
