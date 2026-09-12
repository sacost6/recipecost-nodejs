import type { Request } from 'express';
import { HttpError } from '../../middleware/errorHandling/error';

export const generateSession = async (
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

export const requireUserId = (req: Pick<Request, 'session'>): string => {
  const userId = req.session.userId;

  if (!userId) {
    throw new HttpError(401, 'Please log in.');
  }

  return userId;
};
