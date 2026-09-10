import type { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../utils/httpError';
import { errorHandler } from './errorHandler.middleware';

const { logError, serializedLogs } = vi.hoisted(() => ({
  logError: vi.fn(),
  serializedLogs: [] as Array<Record<string, unknown>>,
}));

vi.mock('../logging.middleware', async () => {
  const { default: pino } = await import('pino');
  const { Writable } = await import('node:stream');
  const output = new Writable({
    write(chunk, _encoding, callback) {
      serializedLogs.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const logger = pino({ level: 'error' }, output);
  logError.mockImplementation((fields, message) =>
    logger.error(fields, message),
  );
  return { logger: { error: logError } };
});

const invoke = (error: unknown, headersSent = false) => {
  const status = vi.fn();
  const json = vi.fn();
  const response = { headersSent, status, json };
  status.mockReturnValue(response);
  const next = vi.fn();

  errorHandler(
    error,
    {} as Request,
    response as unknown as Response,
    next as NextFunction,
  );

  return { status, json, next };
};

const databaseFailure = (code: string, constraint?: string) =>
  new QueryFailedError(
    'UPDATE ingredients SET name = $1 WHERE ingredient_id = $2',
    ['private ingredient name', '17'],
    Object.assign(new Error('private PostgreSQL diagnostic'), {
      code,
      constraint,
      detail: 'Key (name)=(private ingredient name) already exists.',
      table: 'ingredients',
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  serializedLogs.length = 0;
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('errorHandler HTTP errors', () => {
  it.each([400, 401, 403, 404, 409, 422, 429, 499])(
    'preserves an intentional %i status and public message',
    (statusCode) => {
      const { status, json, next } = invoke(
        new HttpError(statusCode, 'Public request error'),
      );

      expect(status).toHaveBeenCalledExactlyOnceWith(statusCode);
      expect(json).toHaveBeenCalledExactlyOnceWith({
        status: 'error',
        message: 'Public request error',
      });
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('preserves the optimistic concurrency conflict message', () => {
    const message =
      'This ingredient has changed. Reload it before saving again.';
    const { status, json } = invoke(new HttpError(409, message));

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ status: 'error', message });
  });

  it('supports errors that specify status instead of statusCode', () => {
    const error = Object.assign(new Error('Invalid JSON'), { status: 400 });
    const { status, json } = invoke(error);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Invalid JSON',
    });
  });

  it('prefers statusCode when both status properties exist', () => {
    const error = Object.assign(new Error('Ingredient not found'), {
      statusCode: 404,
      status: 400,
    });

    expect(invoke(error).status).toHaveBeenCalledWith(404);
  });

  it.each([undefined, null])(
    'falls back to status when statusCode is %s',
    (statusCode) => {
      const error = Object.assign(new Error('Invalid JSON'), {
        statusCode,
        status: 400,
      });

      expect(invoke(error).status).toHaveBeenCalledWith(400);
    },
  );

  it.each([0, -1, 200, 399, 600, 404.5, NaN, Infinity, '404', true, {}])(
    'normalizes an invalid statusCode (%s) to a safe 500',
    (statusCode) => {
      const error = Object.assign(new Error('Private error detail'), {
        statusCode,
      });
      const { status, json } = invoke(error);

      expect(status).toHaveBeenCalledExactlyOnceWith(500);
      expect(json).toHaveBeenCalledExactlyOnceWith({
        status: 'error',
        message: 'Internal Server Error',
      });
    },
  );

  it.each([500, 501, 503, 599])(
    'preserves %i but hides the internal message',
    (statusCode) => {
      const { status, json } = invoke(
        new HttpError(statusCode, 'Database password or internal path'),
      );

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal Server Error',
      });
    },
  );

  it('defaults an ordinary Error to a sanitized 500', () => {
    const { status, json } = invoke(new Error('Private database address'));

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal Server Error',
    });
  });

  it('uses the fallback message when an intentional error has no message', () => {
    const { json } = invoke(new HttpError(400, ''));

    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal Server Error',
    });
  });
});

describe('errorHandler PostgreSQL constraint errors', () => {
  it('translates the ingredient-name unique constraint into a specific 409', () => {
    const { status, json } = invoke(
      databaseFailure('23505', 'uq_ingredients_name'),
    );

    expect(status).toHaveBeenCalledExactlyOnceWith(409);
    expect(json).toHaveBeenCalledExactlyOnceWith({
      status: 'error',
      message: 'An ingredient with this name already exists.',
    });
  });

  it.each(['uq_some_other_record', undefined])(
    'returns a clean generic conflict for unique constraint %s',
    (constraint) => {
      const { status, json } = invoke(databaseFailure('23505', constraint));

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        status: 'error',
        message: 'A record with these values already exists.',
      });
    },
  );

  it.each(['fk_ingredients_category', 'fk_ingredient_products_ingredient'])(
    'returns a related-record conflict for %s',
    (constraint) => {
      const { status, json } = invoke(databaseFailure('23503', constraint));

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        status: 'error',
        message: 'A related record is missing or this record is still in use.',
      });
    },
  );

  it('returns a related-record conflict when ON DELETE RESTRICT raises 23001', () => {
    const { status, json } = invoke(
      databaseFailure('23001', 'fk_ingredient_products_ingredient'),
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'A related record is missing or this record is still in use.',
    });
  });

  it.each(['23502', '23514', '22003', '40001', '40P01', '08006', 'UNKNOWN'])(
    'sanitizes unmapped PostgreSQL error %s',
    (code) => {
      const { status, json } = invoke(databaseFailure(code));

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal Server Error',
      });
    },
  );

  it('does not trust an HTTP status copied onto an unmapped database error', () => {
    const error = Object.assign(databaseFailure('08006'), {
      statusCode: 400,
      status: 404,
    });
    const { status, json } = invoke(error);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal Server Error',
    });
  });

  it('handles a database error with no PostgreSQL code', () => {
    const error = new QueryFailedError(
      'SELECT private_data',
      [],
      new Error('x'),
    );

    expect(invoke(error).status).toHaveBeenCalledWith(500);
  });

  it('does not translate arbitrary errors merely because they carry a DB code', () => {
    const error = Object.assign(new Error('Unexpected application failure'), {
      code: '23505',
      constraint: 'uq_ingredients_name',
    });

    expect(invoke(error).status).toHaveBeenCalledWith(500);
  });

  it.each(['23505', '23503', '08006'])(
    'keeps query text, parameters, driver details and stack out of a %s response',
    (code) => {
      const { json } = invoke(databaseFailure(code, 'uq_ingredients_name'));
      const body = json.mock.calls[0][0];

      expect(Object.keys(body).sort()).toEqual(['message', 'status']);
      expect(JSON.stringify(body)).not.toContain('private');
      expect(JSON.stringify(body)).not.toContain('UPDATE');
    },
  );
});

describe('errorHandler stack traces and logging', () => {
  it('includes the original stack in development even when the message is hidden', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = new Error('Private diagnostic');
    error.stack = 'Error: Private diagnostic\n    at /private/server.ts:12:3';
    const { json } = invoke(error);

    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal Server Error',
      stack: error.stack,
    });
  });

  it.each(['production', 'test', 'staging', '', undefined])(
    'does not expose a stack with NODE_ENV=%s',
    (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      const { json } = invoke(new Error('Private diagnostic'));

      expect(json.mock.calls[0][0]).not.toHaveProperty('stack');
    },
  );

  it('handles an Error with no stack in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = new Error('Missing stack');
    delete error.stack;

    expect(invoke(error).status).toHaveBeenCalledWith(500);
  });

  it('preserves the original stack, message and database diagnostics in serialized production logs', () => {
    const error = databaseFailure('23505', 'uq_ingredients_name');
    invoke(error);

    // Check the actual serialized output: spying on the Error object alone
    // would miss Pino dropping non-enumerable message and stack properties.
    expect(logError).toHaveBeenCalledTimes(1);
    expect(serializedLogs).toHaveLength(1);
    const record = serializedLogs[0];
    const loggedError = record.err ?? record.error;
    expect(loggedError).toMatchObject({
      message: error.message,
      stack: error.stack,
      query: error.query,
      parameters: error.parameters,
      code: '23505',
      constraint: 'uq_ingredients_name',
      detail: 'Key (name)=(private ingredient name) already exists.',
    });
  });

  it.each([
    null,
    undefined,
    'failure',
    7,
    { message: 'private', statusCode: 400 },
  ])('safely handles a thrown non-Error value (%s)', (thrown) => {
    const { status, json, next } = invoke(thrown);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Internal Server Error',
    });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not mutate the original error while translating a database conflict', () => {
    const error = databaseFailure('23505', 'uq_ingredients_name');
    const originalMessage = error.message;
    const originalStack = error.stack;
    const originalDriverError = error.driverError;
    invoke(error);

    expect(error.message).toBe(originalMessage);
    expect(error.stack).toBe(originalStack);
    expect(error.driverError).toBe(originalDriverError);
  });
});

describe('errorHandler after headers are sent', () => {
  it.each([new Error('stream failed'), 'non-Error stream failure', null])(
    'forwards the exact original value without writing another response',
    (error) => {
      const { status, json, next } = invoke(error, true);

      expect(next).toHaveBeenCalledExactlyOnceWith(error);
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
    },
  );
});
