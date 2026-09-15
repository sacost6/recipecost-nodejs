import { rateLimit } from 'express-rate-limit';

export const createAuthLimiters = () => ({
  loginLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many login attempts. Please try again later.',
    },
  }),

  registerLimiter: rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      status: 'error',
      message: 'Too many registration attempts. Please try again later.',
    },
  }),
});
