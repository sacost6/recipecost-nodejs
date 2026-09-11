import type { AppError, ErrorResponse, PostgresError } from './ error';
import type { ErrorRequestHandler } from 'express';
import { logger } from '../logging.middleware';
import { QueryFailedError } from 'typeorm';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
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

        if (databaseError.constraint === 'uq_users_email') {
          message = 'Email has already been registered.';
        } else if (databaseError.constraint == 'uq_ingredients_name') {
          message = 'An ingredient with this name already exists.';
        } else {
          message = 'A record with these values already exists.';
        }

        break;
      case '23001':
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

  logger.error({ err: error }, 'Request Failed');

  res.status(statusCode).json(response);
};
