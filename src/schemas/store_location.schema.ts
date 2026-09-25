import * as z from 'zod';
import { positiveBigintIdSchema, stringSchema } from './common.schema';

const createStoreLocationBodySchema = z.strictObject({
  retailerId: positiveBigintIdSchema,
  storeNumber: stringSchema.max(50).nullable().optional(),
  addressLine1: stringSchema.min(1).max(150),
  addressLine2: stringSchema.max(150).nullable().optional(),
  stateCode: stringSchema.length(2),
  city: stringSchema.min(1).max(100),
  postalCode: stringSchema.min(1).max(20),
  countryCode: stringSchema.length(2).toUpperCase(),
});

const updateStoreLocationBodySchema = createStoreLocationBodySchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'At least one field is required to upgrade a store location.',
  });

export const createStoreLocationSchema = z.object({
  body: createStoreLocationBodySchema,
});

export const storeLocationParamsSchema = z.object({
  params: z.object({
    storeLocationId: positiveBigintIdSchema,
  }),
});

export const updateStoreLocationSchema = storeLocationParamsSchema.extend({
  body: updateStoreLocationBodySchema,
});

export type CreateStoreLocationInput = z.infer<
  typeof createStoreLocationBodySchema
>;
export type UpdateStoreLocationInput = z.infer<
  typeof updateStoreLocationBodySchema
>;

export type StoreLocationParamsSchema = z.infer<
  typeof storeLocationParamsSchema
>['params'];
