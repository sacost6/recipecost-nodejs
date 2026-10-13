import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let schema: {
  parse: (value: unknown) => unknown;
  safeParse: (value: unknown) => { success: boolean };
};

beforeAll(async () => {
  vi.stubEnv('API_SECRET', 'schema-test-api-secret');
  vi.stubEnv('DATABASE_URL', 'postgres://localhost/recipe_cost');
  vi.stubEnv('SESSION_SECRET', 's'.repeat(32));
  schema = (await import('./env.schema.js')).EnvSchema;
});
afterAll(() => vi.unstubAllEnvs());

const valid = {
  API_SECRET: 'api-secret',
  DATABASE_URL: 'postgres://localhost/recipe_cost',
  SESSION_SECRET: 's'.repeat(32),
};

describe('environment schema', () => {
  it('applies safe defaults and validates required secrets', () => {
    expect(schema.parse(valid)).toEqual({
      ...valid,
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('coerces a valid port and retains configured environment values', () => {
    expect(
      schema.parse({
        ...valid,
        NODE_ENV: 'production',
        PORT: '8080',
        LOG_LEVEL: 'warn',
      }),
    ).toMatchObject({ NODE_ENV: 'production', PORT: 8080, LOG_LEVEL: 'warn' });
  });

  it.each([
    { ...valid, NODE_ENV: 'staging' },
    { ...valid, PORT: '0' },
    { ...valid, PORT: '1.5' },
    { ...valid, API_SECRET: '' },
    { ...valid, DATABASE_URL: '' },
    { ...valid, SESSION_SECRET: 'short' },
    { API_SECRET: valid.API_SECRET },
  ])('rejects missing or malformed configuration', (environment) => {
    expect(schema.safeParse(environment).success).toBe(false);
  });
});
