/**
 * Opt in with AUTH_TEST_DATABASE_URL pointing at a disposable PostgreSQL DB.
 * Never reads DATABASE_URL or .env files. Only the randomly named test schema
 * is created/cleared/dropped. App migrations and existing tables are untouched.
 */
import 'reflect-metadata';
import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';
import type { PGStore } from 'connect-pg-simple';
import type { SessionData } from 'express-session';
import request, { type Response } from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { app } from '../app';
import { userRepository } from '../repositories/users.repo';

const state = vi.hoisted(() => ({
  schema: `auth_tests_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  source: undefined as DataSource | undefined,
  stores: [] as PGStore[],
}));

vi.mock('../schemas/env.schema', () => ({
  env: {
    NODE_ENV: 'test',
    SESSION_SECRET: 'postgres-auth-tests-only-session-secret',
    DATABASE_URL:
      process.env.AUTH_TEST_DATABASE_URL ??
      'postgresql://unused:unused@127.0.0.1:1/unused',
  },
}));
vi.mock('../middleware/logging.middleware', async () => {
  const { default: pino } = await import('pino');
  return { logger: pino({ level: 'silent' }) };
});
vi.mock('../repositories/ingredient.repo', () => ({
  ingredientRepository: {},
}));
vi.mock('../data-source', async () => {
  const { DataSource } = await import('typeorm');
  const { User } = await import('../entities/User.js');
  state.source = new DataSource({
    type: 'postgres',
    url:
      process.env.AUTH_TEST_DATABASE_URL ??
      'postgresql://unused:unused@127.0.0.1:1/unused',
    schema: state.schema,
    entities: [User],
    synchronize: false,
    logging: false,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 10000 },
  });
  return { AppDataSource: state.source };
});
vi.mock('connect-pg-simple', async (importOriginal) => {
  const actual = await importOriginal<{
    default: typeof import('connect-pg-simple');
  }>();
  return {
    default: (session: Parameters<typeof actual.default>[0]) => {
      const Store = actual.default(session);
      return class extends Store {
        constructor(options: ConstructorParameters<typeof Store>[0]) {
          super({
            ...options,
            conObject: {
              connectionString:
                process.env.AUTH_TEST_DATABASE_URL ??
                'postgresql://unused:unused@127.0.0.1:1/unused',
              connectionTimeoutMillis: 5000,
              statement_timeout: 10000,
            },
            schemaName: state.schema,
            createTableIfMissing: true,
            pruneSessionInterval: false,
          });
          state.stores.push(this);
        }
      };
    },
  };
});

const cookieFrom = (response: Response): string => {
  const headers = response.headers['set-cookie'];
  expect(headers).toBeDefined();
  return (Array.isArray(headers) ? headers[0] : headers).split(';')[0];
};
const sessionIdFrom = (cookie: string) =>
  decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))
    .slice(2)
    .split('.')[0];

const credentials = {
  email: 'alice@example.com',
  password: '  actual postgres test password  ',
};

describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)(
  'authentication with real PostgreSQL',
  () => {
    beforeAll(async () => {
      await state.source!.initialize();
      await state.source!.query(`CREATE SCHEMA "${state.schema}"`);
      await state.source!.synchronize();
      // Let the actual store provision its own table before test cleanup uses it.
      await new Promise<void>((resolve, reject) => {
        state.stores[0].get('table-creation-probe', (error) =>
          error ? reject(error) : resolve(),
        );
      });
    }, 20000);

    beforeEach(async () => {
      vi.stubEnv('NODE_ENV', 'test');
      await state.source!.query(
        `TRUNCATE "${state.schema}"."session", "${state.schema}"."users" RESTART IDENTITY`,
      );
    });

    afterEach(() => vi.unstubAllEnvs());

    afterAll(async () => {
      await Promise.all(state.stores.map((store) => store.close()));
      if (state.source?.isInitialized) {
        try {
          await state.source.query(
            `DROP SCHEMA IF EXISTS "${state.schema}" CASCADE`,
          );
        } finally {
          await state.source.destroy();
        }
      }
    });

    it('persists a hashed user and a session, and excludes hashes from ordinary user queries', async () => {
      const browser = request.agent(app);
      const response = await browser
        .post('/api/auth/register')
        .send({ ...credentials, email: ' ALICE@Example.com ' });
      expect(response.status).toBe(201);
      const { userId } = response.body.data;
      expect(typeof userId).toBe('string');
      const ordinary = await userRepository.findOneByOrFail({ userId });
      expect(ordinary.email).toBe(credentials.email);
      expect(ordinary.passwordHash).toBeUndefined();
      const stored = await userRepository
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.userId = :userId', { userId })
        .getOneOrFail();
      expect(
        await argon2.verify(stored.passwordHash, credentials.password),
      ).toBe(true);
      expect(
        await argon2.verify(stored.passwordHash, credentials.password.trim()),
      ).toBe(false);
      expect(response.body.data).toEqual({ userId, email: credentials.email });

      const rows: Array<{ sess: SessionData }> = await state.source!.query(
        `SELECT sess FROM "${state.schema}"."session"`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].sess.userId).toBe(userId);
      expect(JSON.stringify(rows[0].sess)).not.toContain('password');
      // A separate HTTP client can resolve the session using only its cookie.
      const me = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookieFrom(response));
      expect(me.status).toBe(200);
      expect(me.body).toEqual(response.body);
    });

    it('enforces normalized email uniqueness in PostgreSQL', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);
      const duplicate = await request(app)
        .post('/api/auth/register')
        .send({ ...credentials, email: ' ALICE@EXAMPLE.COM ' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body).toEqual({
        status: 'error',
        message: 'Email has already been registered.',
      });
      expect(await userRepository.count()).toBe(1);
    });

    it('allows only one of two concurrent registrations for the same email', async () => {
      const responses = await Promise.all([
        request(app).post('/api/auth/register').send(credentials),
        request(app).post('/api/auth/register').send(credentials),
      ]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      expect(await userRepository.count()).toBe(1);
    });

    it('rotates persisted sessions on login and invalidates the previous cookie', async () => {
      const browser = request.agent(app);
      const registration = await browser
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);
      const oldCookie = cookieFrom(registration);
      const login = await browser
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);
      expect(cookieFrom(login)).not.toBe(oldCookie);
      await request(app)
        .get('/api/auth/me')
        .set('Cookie', oldCookie)
        .expect(401);
      await browser.get('/api/auth/me').expect(200);
      const rows = await state.source!.query(
        `SELECT sid FROM "${state.schema}"."session" WHERE sid = $1`,
        [sessionIdFrom(oldCookie)],
      );
      expect(rows).toHaveLength(0);
    });

    it('rejects invalid credentials without creating a new persisted session', async () => {
      const browser = request.agent(app);
      await browser.post('/api/auth/register').send(credentials).expect(201);
      await browser.post('/api/auth/logout').expect(204);
      for (const input of [
        { ...credentials, password: 'wrong password' },
        { ...credentials, email: 'missing@example.com' },
      ]) {
        const response = await request(app).post('/api/auth/login').send(input);
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid email or password.');
      }
      const rows = await state.source!.query(
        `SELECT sid FROM "${state.schema}"."session"`,
      );
      expect(rows).toHaveLength(0);
    });

    it('deletes the database session on logout and supports a later fresh login', async () => {
      const browser = request.agent(app);
      const registration = await browser
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);
      const cookie = cookieFrom(registration);
      await browser.post('/api/auth/logout').expect(204);
      const rows = await state.source!.query(
        `SELECT sid FROM "${state.schema}"."session"`,
      );
      expect(rows).toHaveLength(0);
      await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
      await browser.post('/api/auth/login').send(credentials).expect(200);
      await browser.get('/api/auth/me').expect(200);
    });

    it('honors session expiration stored in PostgreSQL', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);
      const cookie = cookieFrom(response);
      await state.source!.query(
        `UPDATE "${state.schema}"."session" SET expire = NOW() - INTERVAL '1 minute' WHERE sid = $1`,
        [sessionIdFrom(cookie)],
      );
      await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    });

    it('does not return a user that was removed after its session was created', async () => {
      const browser = request.agent(app);
      const response = await browser
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);
      await userRepository.delete({ userId: response.body.data.userId });
      const me = await browser.get('/api/auth/me');
      expect(me.status).toBe(404);
      expect(me.body).toEqual({ status: 'error', message: 'User not found.' });
    });
  },
);
