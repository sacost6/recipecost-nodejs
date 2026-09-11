import * as z from 'zod';
import { positiveBigintIdSchema, stringSchema } from './common.schema';

const createStoreLocationBodySchema = z.strictObject({
  retailerId: positiveBigintIdSchema,
  storeNumber: stringSchema.max(32767),
  addressLine1: stringSchema.max(32767),
  addressLine2: stringSchema.max(32767),
  city: stringSchema.max(32767),
  stateCode: stringSchema.max(32767),
  postalCode: stringSchema.max(32767),
  countryCode: stringSchema.max(32767),
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
