import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({
  NODE_ENV: 'test',
  SESSION_SECRET: 'session-middleware-tests-only-secret',
  DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
}));
const storeOptions = vi.hoisted(() => vi.fn());

vi.mock('../schemas/env.schema', () => ({ env: settings }));
vi.mock('connect-pg-simple', async () => {
  const { default: session } = await import('express-session');
  return {
    default: () =>
      class extends session.MemoryStore {
        constructor(options: unknown) {
          super();
          storeOptions(options);
        }
      },
  };
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  settings.NODE_ENV = 'test';
});

async function createApp() {
  const { sessionMiddleware } = await import('./session.middleware.js');
  const app = express();
  // This test fixture represents exactly one trusted TLS-terminating proxy.
  app.set('trust proxy', 1);
  app.use(sessionMiddleware);
  app.get('/anonymous', (_req, res) => res.sendStatus(200));
  app.post('/session', (req, res) => {
    req.session.userId = '9007199254740993';
    res.json({ maxAge: req.session.cookie.originalMaxAge });
  });
  return app;
}

describe('session middleware configuration and cookies', () => {
  it('does not set a cookie for an unmodified anonymous session', async () => {
    const app = await createApp();
    const response = await request(app).get('/anonymous');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('sets a signed HttpOnly cookie with a seven-day lifetime for local development', async () => {
    settings.NODE_ENV = 'development';
    const app = await createApp();
    const response = await request(app).post('/session');
    expect(response.body.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    const cookie = response.headers['set-cookie'][0];
    expect(cookie).toMatch(/^recipe\.sid=s%3A/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');
    expect(storeOptions).toHaveBeenCalledWith({
      conString: settings.DATABASE_URL,
      createTableIfMissing: true,
    });
  });

  it('requires HTTPS before issuing a production session cookie', async () => {
    settings.NODE_ENV = 'production';
    const app = await createApp();
    const insecure = await request(app).post('/session');
    expect(insecure.headers['set-cookie']).toBeUndefined();

    const secure = await request(app)
      .post('/session')
      .set('X-Forwarded-Proto', 'https');
    const cookie = secure.headers['set-cookie'][0];
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(storeOptions).toHaveBeenCalledWith({
      conString: settings.DATABASE_URL,
      createTableIfMissing: false,
    });
  });

  it('does not create database tables automatically in test mode', async () => {
    await createApp();
    expect(storeOptions).toHaveBeenCalledWith({
      conString: settings.DATABASE_URL,
      createTableIfMissing: false,
    });
  });
});
