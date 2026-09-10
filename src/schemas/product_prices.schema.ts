import * as z from 'zod';
import {
  currencyCodeSchema,
  positiveBigintIdSchema,
  nonnegativeDecimal12_2Schema,
} from './utils';

const createProductPriceBodySchema = z.strictObject({
  productId: positiveBigintIdSchema,
  storeLocationId: positiveBigintIdSchema,
  price: nonnegativeDecimal12_2Schema,
  currencyCode: currencyCodeSchema,
});

const updateProductPriceBodySchema = z.strictObject({
  storeLocationId: positiveBigintIdSchema,
  price: nonnegativeDecimal12_2Schema,
  currencyCode: currencyCodeSchema,
});

export const createProductPriceSchema = z.object({
  body: createProductPriceBodySchema,
});

export const productPriceParamsSchema = z.object({
  params: z.object({
    priceId: positiveBigintIdSchema,
  }),
});

export const updateProductPriceSchema = productPriceParamsSchema.extend({
  body: updateProductPriceBodySchema,
});

export type CreateProductPriceInput = z.infer<
  typeof createProductPriceBodySchema
>;
export type UpdateProductPriceInput = z.infer<
  typeof updateProductPriceBodySchema
>;
export type ProductPriceParamsSchema = z.infer<
  typeof productPriceParamsSchema
>['params'];
