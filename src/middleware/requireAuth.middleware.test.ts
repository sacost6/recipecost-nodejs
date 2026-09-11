import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from './errorHandling/ error';
import { requireAuth } from './requireAuth.middleware';

describe('requireAuth', () => {
  it('allows a request carrying the authenticated session identity', () => {
    const req = { session: { userId: '9007199254740993' } } as Request;
    const next = vi.fn();

    requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledExactlyOnceWith();
    expect(req.session.userId).toBe('9007199254740993');
  });

  it.each([undefined, ''])(
    'rejects an unauthenticated session even when the client supplies an identity',
    (userId) => {
      const req = {
        session: { userId },
        body: { userId: '123' },
        query: { userId: '123' },
        params: { userId: '123' },
      } as unknown as Request;
      const res = { status: vi.fn(), json: vi.fn() };
      const next = vi.fn();

      requireAuth(req, res as unknown as Response, next);

      expect(next).toHaveBeenCalledExactlyOnceWith(expect.any(HttpError));
      expect(next.mock.calls[0][0]).toMatchObject({
        statusCode: 401,
        message: 'Please log in.',
      });
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    },
  );
});
