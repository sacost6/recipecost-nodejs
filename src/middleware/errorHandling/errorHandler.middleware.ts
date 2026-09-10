import type { AppError, ErrorResponse, PostgresError } from './utils';
import type { ErrorRequestHandler } from 'express';
import { logger } from '../logging.middleware';
import { QueryFailedError } from 'typeorm';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    _next(err);
    return;
  }

  const error: AppError =
    err instanceof Error ? err : new Error('Unknown error');

  let statusCode = error.statusCode ?? error.status ?? 500;
  let message = error.message || 'Internal Server Error';

  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  if (error instanceof QueryFailedError) {
    const databaseError = error.driverError as PostgresError;

    statusCode = 500;

    switch (databaseError.code) {
      case '23505':
        statusCode = 409;
        message =
          databaseError.constraint === 'uq_ingredients_name'
            ? 'An ingredient with this name already exists.'
            : 'A record with these values already exists.;';
        break;
      case '23503':
        statusCode = 409;
        message = 'A related record is missing or this record is still in use.';
        break;
    }
  }

  const response: ErrorResponse = {
    status: 'error',
    message: statusCode >= 500 ? 'Internal Server Error' : message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  logger.error({ error }, 'Request Failed');

  res.status(statusCode).json(response);
};
