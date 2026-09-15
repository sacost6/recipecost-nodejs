import { Router } from 'express';
import {
  login,
  register,
  logout,
  getUser,
} from '../controllers/auth.controller';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { requireAuth } from '../middleware/requireAuth.middleware';
import { createAuthLimiters } from '../middleware/authRateLimit.middleware';

export const authRoutes = Router();

const { loginLimiter, registerLimiter } = createAuthLimiters();

authRoutes.post('/login', loginLimiter, validateRequest(loginSchema), login);

authRoutes.post(
  '/register',
  registerLimiter,
  validateRequest(registerSchema),
  register,
);

authRoutes.post('/logout', logout);

authRoutes.get('/me', requireAuth, getUser);
