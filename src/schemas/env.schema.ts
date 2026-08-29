import * as z from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_SECRET: z.string().min(1, 'API_SECRET is required'),
  LOG_LEVEL: z.string().optional().default('info'),
});

export const env = EnvSchema.parse(process.env);
