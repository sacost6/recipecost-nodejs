import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  login: vi.fn<(req: Request, res: Response) => void>(),
  register: vi.fn<(req: Request, res: Response) => void>(),
  loginService: vi.fn(),
  registerService: vi.fn(),
}));

vi.mock('../controllers/auth.controller', () => ({
  login: auth.login,
  register: auth.register,
  logout: (_req: Request, res: Response) => res.sendStatus(204),
  getUser: (_req: Request, res: Response) => res.sendStatus(200),
}));
vi.mock('./logging.middleware', async () => {
  const { default: pino } = await import('pino');
  return { logger: pino({ level: 'silent' }) };
});

const credentials = {
  email: 'alice@example.com',
  password: 'rate-limiter-test-password',
};
const policies = [
  {
    endpoint: 'login',
    limit: 10,
    windowMs: 15 * 60 * 1000,
    status: 200,
    message: 'Too many login attempts. Please try again later.',
  },
  {
    endpoint: 'register',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    status: 201,
    message: 'Too many registration attempts. Please try again later.',
  },
] as const;

async function createTestApp() {
  // Reload the real router so its factory creates fresh limiter instances.
  // Keeping the route wiring real also catches a missing/misplaced limiter.
  vi.resetModules();
  const { authRoutes } = await import('../routes/auth.routes.js');
  const { errorHandler } =
    await import('./errorHandling/errorHandler.middleware.js');
  const app = express();
  // Model one trusted local proxy only in this fixture, for client-IP tests.
  app.set('trust proxy', 'loopback');
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

let app: Awaited<ReturnType<typeof createTestApp>>;

beforeEach(async () => {
  // Leave socket/network timers real; advance only the store's clock/timers.
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.resetAllMocks();
  auth.login.mockImplementation((req, res) => {
    auth.loginService(req.body);
    res.status(200).json({ status: 'success' });
  });
  auth.register.mockImplementation((req, res) => {
    auth.registerService(req.body);
    res.status(201).json({ status: 'success' });
  });
  app = await createTestApp();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('authentication rate limits through the real router', () => {
  it.each([200, 401])(
    'allows ten login requests with status %i, then blocks before controller and service',
    async (status) => {
      auth.login.mockImplementation((req, res) => {
        auth.loginService(req.body);
        res.sendStatus(status);
      });

      for (let attempt = 0; attempt < 10; attempt++) {
        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(status);
      }

      const blocked = await request(app)
        .post('/api/auth/login')
        .send(credentials);
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({
        status: 'error',
        message: policies[0].message,
      });
      expect(blocked.headers['retry-after']).toBe('900');
      expect(blocked.headers.ratelimit).toBeDefined();
      expect(blocked.headers['ratelimit-policy']).toBeDefined();
      expect(blocked.headers['x-ratelimit-limit']).toBeUndefined();
      expect(auth.login).toHaveBeenCalledTimes(10);
      expect(auth.loginService).toHaveBeenCalledTimes(10);
    },
  );

  it('allows five registrations, then returns the registration-specific error', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app)
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);
    }

    const blocked = await request(app)
      .post('/api/auth/register')
      .send(credentials);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      status: 'error',
      message: policies[1].message,
    });
    expect(blocked.headers['retry-after']).toBe('3600');
    expect(auth.register).toHaveBeenCalledTimes(5);
    expect(auth.registerService).toHaveBeenCalledTimes(5);
  });

  it.each(policies)(
    'exhausting $endpoint leaves the other endpoint with its full quota',
    async (policy) => {
      const other = policies.find(
        (entry) => entry.endpoint !== policy.endpoint,
      )!;
      for (let attempt = 0; attempt < policy.limit; attempt++) {
        await request(app)
          .post(`/api/auth/${policy.endpoint}`)
          .send(credentials)
          .expect(policy.status);
      }
      await request(app)
        .post(`/api/auth/${policy.endpoint}`)
        .send(credentials)
        .expect(429);

      for (let attempt = 0; attempt < other.limit; attempt++) {
        await request(app)
          .post(`/api/auth/${other.endpoint}`)
          .send(credentials)
          .expect(other.status);
      }
      await request(app)
        .post(`/api/auth/${other.endpoint}`)
        .send(credentials)
        .expect(429);
      expect(auth.loginService).toHaveBeenCalledTimes(10);
      expect(auth.registerService).toHaveBeenCalledTimes(5);
    },
  );

  it.each(policies)(
    'restores the full $endpoint quota when its window expires',
    async (policy) => {
      const path = `/api/auth/${policy.endpoint}`;
      for (let attempt = 0; attempt < policy.limit; attempt++) {
        await request(app).post(path).send(credentials).expect(policy.status);
      }
      await request(app).post(path).send(credentials).expect(429);

      vi.advanceTimersByTime(policy.windowMs - 1);
      const stillBlocked = await request(app).post(path).send(credentials);
      expect(stillBlocked.status).toBe(429);
      expect(stillBlocked.headers['retry-after']).toBe('1');

      vi.advanceTimersByTime(1);
      for (let attempt = 0; attempt < policy.limit; attempt++) {
        await request(app).post(path).send(credentials).expect(policy.status);
      }
      await request(app).post(path).send(credentials).expect(429);
      expect(auth[policy.endpoint]).toHaveBeenCalledTimes(policy.limit * 2);
      const service =
        policy.endpoint === 'login' ? auth.loginService : auth.registerService;
      expect(service).toHaveBeenCalledTimes(policy.limit * 2);
    },
  );

  it.each(policies)(
    'counts invalid $endpoint bodies before validation',
    async (policy) => {
      const path = `/api/auth/${policy.endpoint}`;
      for (let attempt = 0; attempt < policy.limit; attempt++) {
        await request(app).post(path).send({}).expect(400);
      }
      await request(app).post(path).send(credentials).expect(429);
      expect(auth.login).not.toHaveBeenCalled();
      expect(auth.register).not.toHaveBeenCalled();
      expect(auth.loginService).not.toHaveBeenCalled();
      expect(auth.registerService).not.toHaveBeenCalled();
    },
  );

  it('keeps client IP quotas independent and changing email cannot bypass a limit', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.0.2.1')
        .send({ ...credentials, email: `user${attempt}@example.com` })
        .expect(200);
    }
    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '192.0.2.1')
      .send({ ...credentials, email: 'another@example.com' })
      .expect(429);
    await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '198.51.100.1')
      .send(credentials)
      .expect(200);
    expect(auth.loginService).toHaveBeenCalledTimes(11);
  });

  it('a fresh app gets fresh counters while the original app stays limited', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app).post('/api/auth/login').send(credentials).expect(200);
    }
    await request(app).post('/api/auth/login').send(credentials).expect(429);
    const freshApp = await createTestApp();
    await request(freshApp)
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);
    await request(app).post('/api/auth/login').send(credentials).expect(429);
    expect(auth.loginService).toHaveBeenCalledTimes(11);
  });
});
