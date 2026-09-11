import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from './errorHandling/ error';

type ValidatedRequestParts = {
  body?: Request['body'];
  params?: Request['params'];
  query?: Record<string, unknown>;
};

export const validateRequest =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(', ');

      return next(new HttpError(400, message));
    }

    const validatedRequest = result.data as ValidatedRequestParts;

    if (validatedRequest.body !== undefined) {
      req.body = validatedRequest.body;
    }

    if (validatedRequest.params !== undefined) {
      req.params = validatedRequest.params;
    }

    if (validatedRequest.query !== undefined) {
      res.locals.query = validatedRequest.query;
    }

    next();
  };
