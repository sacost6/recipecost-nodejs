import { describe, expect, it } from 'vitest';
import { loginSchema, logoutSchema, registerSchema } from './auth.schema';

const email = 'alice@example.com';
const password = '  My Unchanged Password  ';

describe.each([
  { name: 'registerSchema', schema: registerSchema },
  { name: 'loginSchema', schema: loginSchema },
])('$name', ({ schema }) => {
  it('normalizes email before validation and preserves the exact password', () => {
    expect(
      schema.parse({ body: { email: ' \tAlice@Example.COM\n', password } }),
    ).toEqual({ body: { email, password } });
  });

  it.each(['not-an-email', 'alice@', '@example.com', 'alice @example.com', ''])(
    'rejects invalid email %j',
    (invalidEmail) => {
      expect(
        schema.safeParse({ body: { email: invalidEmail, password } }).success,
      ).toBe(false);
    },
  );

  it('accepts a 254-character email and rejects a longer address', () => {
    const longestEmail = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
    expect(longestEmail).toHaveLength(254);
    expect(
      schema.safeParse({ body: { email: longestEmail, password } }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ body: { email: `${longestEmail}a`, password } })
        .success,
    ).toBe(false);
  });

  it.each(['email', 'password'] as const)(
    'requires %s to be a string',
    (field) => {
      for (const value of [undefined, null, 42, true, [], {}]) {
        expect(
          schema.safeParse({ body: { email, password, [field]: value } })
            .success,
        ).toBe(false);
      }
    },
  );

  it.each(['userId', 'passwordHash', 'role'])(
    'rejects client-supplied %s',
    (field) => {
      expect(
        schema.safeParse({ body: { email, password, [field]: 'forged' } })
          .success,
      ).toBe(false);
    },
  );

  it.each([undefined, null, [], 'credentials', {}])(
    'rejects invalid body %j',
    (body) => {
      expect(schema.safeParse({ body }).success).toBe(false);
    },
  );

  it('accepts the maximum password length and rejects one character more', () => {
    expect(
      schema.safeParse({ body: { email, password: 'a'.repeat(128) } }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ body: { email, password: 'a'.repeat(129) } }).success,
    ).toBe(false);
  });
});

describe('registration password policy', () => {
  it('requires at least 15 characters', () => {
    expect(
      registerSchema.safeParse({ body: { email, password: 'a'.repeat(15) } })
        .success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({ body: { email, password: 'a'.repeat(14) } })
        .success,
    ).toBe(false);
  });
});

describe('login password policy', () => {
  it('accepts short passwords for verification without applying the registration minimum', () => {
    expect(
      loginSchema.parse({ body: { email, password: 'a' } }).body.password,
    ).toBe('a');
    expect(
      loginSchema.safeParse({ body: { email, password: '' } }).success,
    ).toBe(false);
  });
});

describe('logoutSchema', () => {
  it('normalizes an email when this optional request schema is used', () => {
    expect(
      logoutSchema.parse({ body: { email: ' Alice@Example.COM ' } }),
    ).toEqual({ body: { email } });
  });

  it('rejects invalid email and additional body fields', () => {
    expect(logoutSchema.safeParse({ body: { email: 'invalid' } }).success).toBe(
      false,
    );
    expect(
      logoutSchema.safeParse({ body: { email, userId: '123' } }).success,
    ).toBe(false);
  });
});
