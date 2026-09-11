import type { RequestHandler } from 'express';
import { HttpError } from './errorHandling/ error';

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return next(new HttpError(401, 'Please log in.'));
  }

  next();
};
