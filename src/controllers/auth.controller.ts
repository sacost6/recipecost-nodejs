import type { Request, Response } from 'express';
import {
  loginService,
  registerService,
  getUserService,
} from '../services/auth.service';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema';
import { HttpError } from '../middleware/errorHandling/ error';
import { env } from '../schemas/env.schema';

const generateSession = async (
  req: Pick<Request, 'session'>,
  user: { userId: string; email: string },
) => {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  req.session.userId = user.userId;

  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

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
  const userId = req.session.userId;

  if (!userId) {
    throw new HttpError(401, 'Please log in.');
  }

  const user = await getUserService(userId);

  res.status(200).json({
    status: 'success',
    data: user,
  });
};
