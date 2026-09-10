import * as z from 'zod';
import { positiveBigintIdSchema } from './utils';

const createStoreLocationBodySchema = z.strictObject({
  retailerId: positiveBigintIdSchema,
  storeNumber: z.string().trim().max(32767),
  addressLine1: z.string().trim().max(32767),
  addressLine2: z.string().trim().max(32767),
  city: z.string().trim().max(32767),
  stateCode: z.string().trim().max(32767),
  postalCode: z.string().trim().max(32767),
  countryCode: z.string().trim().max(32767),
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
