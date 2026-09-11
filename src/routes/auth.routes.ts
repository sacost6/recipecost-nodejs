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

export const authRoutes = Router();

authRoutes.post('/login', validateRequest(loginSchema), login);

authRoutes.post('/register', validateRequest(registerSchema), register);

authRoutes.post('/logout', logout);

authRoutes.get('/me', requireAuth, getUser);
