import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import type { LoginInput } from '../schemas/auth.schema';
import { getUser, login, logout, register } from './auth.controller';

const services = vi.hoisted(() => ({
  loginService: vi.fn(),
  registerService: vi.fn(),
  getUserService: vi.fn(),
}));
const environment = vi.hoisted(() => ({ NODE_ENV: 'test' }));

vi.mock('../services/auth.service', () => services);
vi.mock('../schemas/env.schema', () => ({ env: environment }));

type SessionCallback = (error?: Error) => void;
type AuthRequest = Request<Record<string, never>, unknown, LoginInput>;

const publicUser = { userId: '9007199254740993', email: 'alice@example.com' };
const credentials = {
  email: publicUser.email,
  password: 'A sufficiently long password',
};

const response = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return { res, expressResponse: res as unknown as Response };
};

const session = (userId?: string) => ({
  userId,
  regenerate: vi.fn<(callback: SessionCallback) => void>(),
  save: vi.fn<(callback: SessionCallback) => void>(),
  destroy: vi.fn<(callback: SessionCallback) => void>(),
});

const authRequest = () => {
  const previousSession = session('previous-user');
  const freshSession = session();
  const req = {
    body: credentials,
    session: previousSession,
  } as unknown as AuthRequest;

  return { req, previousSession, freshSession };
};

beforeEach(() => {
  vi.resetAllMocks();
  environment.NODE_ENV = 'test';
});

describe.each([
  {
    name: 'login',
    controller: login,
    service: services.loginService,
    status: 200,
  },
  {
    name: 'register',
    controller: register,
    service: services.registerService,
    status: 201,
  },
])('$name controller', ({ controller, service, status }) => {
  it('waits for authentication, replaces the session, then saves the trusted identity before responding', async () => {
    let resolveUser!: (user: typeof publicUser) => void;
    service.mockReturnValue(
      new Promise<typeof publicUser>((resolve) => {
        resolveUser = resolve;
      }),
    );
    const { req, previousSession, freshSession } = authRequest();
    const { res, expressResponse } = response();

    const pending = controller(req, expressResponse);

    expect(service).toHaveBeenCalledExactlyOnceWith(credentials);
    expect(previousSession.regenerate).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();

    resolveUser(publicUser);
    await vi.waitFor(() => {
      expect(previousSession.regenerate).toHaveBeenCalledTimes(1);
    });

    expect(req.session.userId).toBe('previous-user');
    expect(previousSession.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();

    // express-session replaces req.session before the regeneration callback.
    req.session = freshSession as unknown as Request['session'];
    previousSession.regenerate.mock.calls[0][0]();
    await vi.waitFor(() => {
      expect(freshSession.save).toHaveBeenCalledTimes(1);
    });

    expect(freshSession.userId).toBe(publicUser.userId);
    expect(previousSession.userId).toBe('previous-user');
    expect(previousSession.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    freshSession.save.mock.calls[0][0]();
    await pending;

    expect(res.status).toHaveBeenCalledExactlyOnceWith(status);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: publicUser,
    });
    expect(res.send).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('propagates service errors without changing the existing session or sending success', async () => {
    const failure = new HttpError(401, 'Authentication failed.');
    service.mockRejectedValue(failure);
    const { req, previousSession } = authRequest();
    const { res, expressResponse } = response();

    await expect(controller(req, expressResponse)).rejects.toBe(failure);

    expect(previousSession.userId).toBe('previous-user');
    expect(previousSession.regenerate).not.toHaveBeenCalled();
    expect(previousSession.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates regeneration errors without assigning the new identity or saving', async () => {
    const failure = new Error('session regeneration failed');
    service.mockResolvedValue(publicUser);
    const { req, previousSession } = authRequest();
    const { res, expressResponse } = response();
    previousSession.regenerate.mockImplementation((callback) => {
      callback(failure);
    });

    await expect(controller(req, expressResponse)).rejects.toBe(failure);

    expect(previousSession.userId).toBe('previous-user');
    expect(previousSession.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates persistence errors without reporting an authenticated session', async () => {
    const failure = new Error('session save failed');
    service.mockResolvedValue(publicUser);
    const { req, previousSession, freshSession } = authRequest();
    const { res, expressResponse } = response();
    previousSession.regenerate.mockImplementation((callback) => {
      req.session = freshSession as unknown as Request['session'];
      callback();
    });
    freshSession.save.mockImplementation((callback) => callback(failure));

    await expect(controller(req, expressResponse)).rejects.toBe(failure);

    expect(service).toHaveBeenCalledTimes(1);
    expect(freshSession.save).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('logout controller', () => {
  it('waits until the server session is destroyed before clearing the cookie and returning 204', async () => {
    const { req, previousSession } = authRequest();
    const { res, expressResponse } = response();

    const pending = logout(req, expressResponse);

    expect(previousSession.destroy).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();

    previousSession.destroy.mock.calls[0][0]();
    await pending;

    expect(res.clearCookie).toHaveBeenCalledExactlyOnceWith('recipe.sid', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    expect(res.status).toHaveBeenCalledExactlyOnceWith(204);
    expect(res.send).toHaveBeenCalledExactlyOnceWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('clears the secure cookie in production without reusing maxAge or expires', async () => {
    environment.NODE_ENV = 'production';
    const { req, previousSession } = authRequest();
    const { res, expressResponse } = response();
    previousSession.destroy.mockImplementation((callback) => callback());

    await logout(req, expressResponse);

    expect(res.clearCookie).toHaveBeenCalledExactlyOnceWith('recipe.sid', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('propagates destruction failures without clearing the cookie or claiming logout succeeded', async () => {
    const failure = new Error('session destruction failed');
    const { req, previousSession } = authRequest();
    const { res, expressResponse } = response();
    previousSession.destroy.mockImplementation((callback) => callback(failure));

    await expect(logout(req, expressResponse)).rejects.toBe(failure);

    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('allows logout when a session has no authenticated identity', async () => {
    const anonymousSession = session();
    const req = { session: anonymousSession } as unknown as Request;
    const { res, expressResponse } = response();
    anonymousSession.destroy.mockImplementation((callback) => callback());

    await logout(req, expressResponse);

    expect(anonymousSession.destroy).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(204);
    expect(services.getUserService).not.toHaveBeenCalled();
  });
});

describe('getUser controller', () => {
  it('retrieves the session identity regardless of IDs supplied by the caller', async () => {
    services.getUserService.mockResolvedValue(publicUser);
    const req = {
      session: { userId: publicUser.userId },
      body: { userId: 'forged-body-user', email: 'other@example.com' },
      params: { userId: 'forged-param-user' },
      query: { userId: 'forged-query-user' },
    } as unknown as Request;
    const { res, expressResponse } = response();

    await getUser(req, expressResponse);

    expect(services.getUserService).toHaveBeenCalledExactlyOnceWith(
      publicUser.userId,
    );
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: publicUser,
    });
  });

  it('rejects missing session identity before querying the user service', async () => {
    const req = {
      session: {},
      body: { userId: publicUser.userId },
    } as unknown as Request;
    const { res, expressResponse } = response();

    await expect(getUser(req, expressResponse)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Please log in.',
    });

    expect(services.getUserService).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('propagates a missing user or database failure without a successful response', async () => {
    const { req } = authRequest();
    const { res, expressResponse } = response();
    const failure = new HttpError(404, 'User not found.');
    services.getUserService.mockRejectedValue(failure);

    await expect(getUser(req, expressResponse)).rejects.toBe(failure);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
