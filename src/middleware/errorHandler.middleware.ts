import { type ErrorRequestHandler } from 'express';
import { logger } from './logging.middleware';

type ErrorResponse = {
  status: 'error';
  message: string;
  stack?: string;
};

type AppError = Error & {
  statusCode?: number;
  status?: number;
};

export const errorHandler: ErrorRequestHandler = (err, req, res) => {
  const error = err as AppError;

  const statusCode = error.statusCode ?? 500;

  const response: ErrorResponse = {
    status: 'error',
    message: error.message || 'Internal Server Error',
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  logger.error({ error }, 'An error occurred');

  res.status(statusCode).json(response);
};
