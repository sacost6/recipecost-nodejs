import * as argon2 from 'argon2';
import request, { type Response } from 'supertest';
import type { MemoryStore } from 'express-session';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app';

// Real app/router, validation, services, Argon2, cookies and session middleware.
// Only database boundaries are replaced. PostgreSQL behavior is tested separately.
const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOneBy: vi.fn(),
  createQueryBuilder: vi.fn(),
}));
const state = vi.hoisted(() => ({
  store: undefined as MemoryStore | undefined,
}));

vi.mock('../repositories/users.repo', () => ({ userRepository: repository }));
vi.mock('../repositories/ingredient.repo', () => ({
  ingredientRepository: {},
}));
vi.mock('../schemas/env.schema', () => ({
  env: {
    NODE_ENV: 'test',
    SESSION_SECRET: 'auth-route-tests-only-not-a-real-secret',
    DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
  },
}));
vi.mock('../middleware/logging.middleware', async () => {
  const { default: pino } = await import('pino');
  return { logger: pino({ level: 'silent' }) };
});
vi.mock('connect-pg-simple', async () => {
  const { default: session } = await import('express-session');
  return {
    default: () =>
      class extends session.MemoryStore {
        constructor() {
          super();
          state.store = this;
        }
      },
  };
});

type StoredUser = {
  userId: string;
  email: string;
  passwordHash: string;
};
const users = new Map<string, StoredUser>();
const password = '  correct horse battery staple  ';
const credentials = { email: 'alice@example.com', password };
const aliceId = '9007199254740993';

const cookieFrom = (response: Response): string => {
  const cookies = response.headers['set-cookie'];
  expect(cookies).toBeDefined();
  const cookie = (Array.isArray(cookies) ? cookies[0] : cookies) as string;
  return cookie.split(';')[0];
};

const sessionIdFrom = (cookie: string) =>
  decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))
    .slice(2)
    .split('.')[0];

beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
  users.clear();
  await new Promise<void>((resolve, reject) => {
    state.store!.clear((error) => (error ? reject(error) : resolve()));
  });
  repository.create.mockImplementation((values) => ({ ...values }));
  repository.save.mockImplementation(async (values) => {
    const user = {
      ...values,
      userId: (BigInt(aliceId) + BigInt(users.size)).toString(),
    } as StoredUser;
    users.set(user.userId, user);
    return user;
  });
  repository.findOneBy.mockImplementation(async ({ userId }) => {
    const user = users.get(userId);
    // Deliberately include the hash: response tests must catch accidental leaks.
    return user ? { ...user } : null;
  });
  repository.createQueryBuilder.mockImplementation(() => {
    let email: string;
    const builder = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn((_sql: string, values: { email: string }) => {
        email = values.email;
        return builder;
      }),
      getOne: vi.fn(async () => {
        const user = [...users.values()].find((entry) => entry.email === email);
        return user ? { ...user } : null;
      }),
    };
    return builder;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('authentication HTTP flow', () => {
  it('registers, normalizes email, hashes the exact password and signs in', async () => {
    const browser = request.agent(app);
    const response = await browser.post('/api/auth/register').send({
      email: '  ALICE@Example.com  ',
      password,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      status: 'success',
      data: { userId: aliceId, email: credentials.email },
    });
    const saved = users.get(aliceId)!;
    expect(saved.passwordHash).not.toBe(password);
    expect(await argon2.verify(saved.passwordHash, password)).toBe(true);
    expect(await argon2.verify(saved.passwordHash, password.trim())).toBe(
      false,
    );
    expect(JSON.stringify(response.body)).not.toContain(saved.passwordHash);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie'][0]).toContain('Path=/');
    expect(response.headers['set-cookie'][0]).not.toContain('Secure');

    const me = await browser.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual(response.body);
    expect(me.headers['set-cookie']).toBeUndefined();
  });

  it('logs in again with the stored hash after logout', async () => {
    const browser = request.agent(app);
    await browser.post('/api/auth/register').send(credentials).expect(201);
    await browser.post('/api/auth/logout').expect(204);
    await browser.get('/api/auth/me').expect(401);

    const login = await browser.post('/api/auth/login').send(credentials);
    expect(login.status).toBe(200);
    expect(login.body).toEqual({
      status: 'success',
      data: { userId: aliceId, email: credentials.email },
    });
    await browser.get('/api/auth/me').expect(200);
    expect(
      repository.createQueryBuilder.mock.results[0].value.addSelect,
    ).toHaveBeenCalledWith('user.passwordHash');
  });

  it.each(['/login', '/register'])(
    'rotates an existing session on %s',
    async (path) => {
      const browser = request.agent(app);
      const first = await browser.post('/api/auth/register').send(credentials);
      const oldCookie = cookieFrom(first);
      const nextCredentials =
        path === '/register'
          ? { ...credentials, email: 'bob@example.com' }
          : credentials;
      const response = await browser
        .post(`/api/auth${path}`)
        .send(nextCredentials);
      expect(response.status).toBe(path === '/register' ? 201 : 200);
      expect(cookieFrom(response)).not.toBe(oldCookie);
      await request(app)
        .get('/api/auth/me')
        .set('Cookie', oldCookie)
        .expect(401);
      const me = await browser.get('/api/auth/me').expect(200);
      expect(me.body.data).toEqual({
        userId: path === '/register' ? '9007199254740994' : aliceId,
        email: nextCredentials.email,
      });
    },
  );

  it('logout revokes the server session, even if the old cookie is replayed', async () => {
    const browser = request.agent(app);
    const login = await browser.post('/api/auth/register').send(credentials);
    const oldCookie = cookieFrom(login);
    const logout = await browser.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.text).toBe('');
    expect(logout.headers['set-cookie'][0]).toContain('recipe.sid=;');
    expect(logout.headers['set-cookie'][0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    await browser.get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', oldCookie).expect(401);
  });

  it('allows logout with no session or request body', async () => {
    await request(app).post('/api/auth/logout').expect(204);
    await request(app).post('/api/auth/logout').expect(204);
  });

  it('does not create a session for an anonymous request', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Please log in.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });

  it('keeps different browsers and their identities isolated', async () => {
    const alice = request.agent(app);
    const bob = request.agent(app);
    await alice.post('/api/auth/register').send(credentials).expect(201);
    const bobId = '9007199254740994';
    repository.save.mockImplementationOnce(async (values) => {
      const user = { ...values, userId: bobId } as StoredUser;
      users.set(user.userId, user);
      return user;
    });
    await bob
      .post('/api/auth/register')
      .send({ ...credentials, email: 'bob@example.com' })
      .expect(201);

    const aliceResponse = await alice
      .get('/api/auth/me')
      .query({ userId: bobId, email: 'bob@example.com' });
    expect(aliceResponse.body.data).toEqual({
      userId: aliceId,
      email: credentials.email,
    });
    expect((await bob.get('/api/auth/me')).body.data.userId).toBe(bobId);
    await alice.post('/api/auth/logout').expect(204);
    await bob.get('/api/auth/me').expect(200);
  });

  it('rejects a cookie with a modified signature', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(credentials);
    const cookie = cookieFrom(response);
    const separator = cookie.lastIndexOf('.');
    const forgedCookie = `${cookie.slice(0, separator + 1)}invalid-signature`;
    await request(app)
      .get('/api/auth/me')
      .set('Cookie', forgedCookie)
      .expect(401);
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });

  it('rejects an expired session even if the signed cookie is replayed', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(credentials);
    const cookie = cookieFrom(response);
    const id = sessionIdFrom(cookie);
    const stored = await new Promise<import('express-session').SessionData>(
      (resolve, reject) => {
        state.store!.get(id, (error, data) =>
          error ? reject(error) : resolve(data!),
        );
      },
    );
    stored.cookie.expires = new Date(Date.now() - 1000);
    await new Promise<void>((resolve, reject) => {
      state.store!.set(id, stored, (error) =>
        error ? reject(error) : resolve(),
      );
    });
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('does not return a user that has been deleted since login', async () => {
    const browser = request.agent(app);
    await browser.post('/api/auth/register').send(credentials).expect(201);
    users.clear();
    const response = await browser.get('/api/auth/me');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'error',
      message: 'User not found.',
    });
  });

  it('returns a sanitized server error when the session store cannot read a cookie', async () => {
    const browser = request.agent(app);
    await browser.post('/api/auth/register').send(credentials).expect(201);
    vi.spyOn(state.store!, 'get').mockImplementationOnce((_id, callback) => {
      callback(new Error('private session database failure'));
    });
    const response = await browser.get('/api/auth/me');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Internal Server Error',
    });
    expect(repository.findOneBy).not.toHaveBeenCalled();
  });
});

describe('authentication failures and validation', () => {
  it('uses the same public error for an unknown email and an incorrect password', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'wrong' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, email: 'nobody@example.com' });
    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Invalid email or password.',
      });
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it.each([
    { path: 'register', body: { email: 'not-an-email', password } },
    { path: 'register', body: { ...credentials, password: 'too short' } },
    { path: 'login', body: { email: credentials.email } },
    { path: 'login', body: { ...credentials, password: '' } },
    { path: 'register', body: { ...credentials, userId: 'someone-else' } },
    { path: 'login', body: { ...credentials, userId: 'someone-else' } },
  ])(
    'rejects invalid $path input before accessing storage: $body',
    async ({ path, body }) => {
      const response = await request(app).post(`/api/auth/${path}`).send(body);
      expect(response.status).toBe(400);
      expect(response.headers['set-cookie']).toBeUndefined();
      for (const operation of Object.values(repository)) {
        expect(operation).not.toHaveBeenCalled();
      }
    },
  );

  it('rejects malformed JSON before running authentication', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('translates a duplicate email database error into a specific 409', async () => {
    repository.save.mockRejectedValueOnce(
      new QueryFailedError(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
        [credentials.email, 'private-password-hash'],
        Object.assign(new Error('private database detail'), {
          code: '23505',
          constraint: 'uq_users_email',
        }),
      ),
    );
    const response = await request(app)
      .post('/api/auth/register')
      .send(credentials);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Email has already been registered.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('sanitizes database failures instead of treating them as invalid credentials', async () => {
    repository.createQueryBuilder.mockImplementationOnce(() => {
      throw new Error('private database hostname');
    });
    const response = await request(app)
      .post('/api/auth/login')
      .send(credentials);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: 'error',
      message: 'Internal Server Error',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
