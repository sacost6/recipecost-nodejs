import * as z from 'zod';
import { emailSchema } from './schema_utils';

export const registerSchema = z.object({
  body: z.strictObject({
    email: emailSchema,
    password: z.string().min(15).max(128),
  }),
});

export const loginSchema = z.object({
  body: z.strictObject({
    email: emailSchema,
    password: z.string().min(1).max(128),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
