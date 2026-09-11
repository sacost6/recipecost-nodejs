import type { Request, Response } from 'express';
import {
  loginService,
  registerService,
  getUserService,
} from '../services/auth.service';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema';
import { env } from '../schemas/env.schema';
import { generateSession, requireUserId } from './utils/auth';

export const login = async (
  req: Request<Record<string, never>, unknown, LoginInput>,
  res: Response,
): Promise<void> => {
  const user = await loginService(req.body);

  await generateSession(req, user);

  res.status(200).json({
    status: 'success',
    data: user,
  });
};

export const register = async (
  req: Request<Record<string, never>, unknown, RegisterInput>,
  res: Response,
): Promise<void> => {
  const user = await registerService(req.body);

  await generateSession(req, user);

  res.status(201).json({
    status: 'success',
    data: user,
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  res.clearCookie('recipe.sid', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(204).send();
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);

  const user = await getUserService(userId);

  res.status(200).json({
    status: 'success',
    data: user,
  });
};
