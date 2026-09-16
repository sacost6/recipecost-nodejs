import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logging.middleware';

const output = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock('pino', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pino')>();
  return {
    ...actual,
    default: (options: import('pino').LoggerOptions) =>
      actual.pino(
        { ...options, level: 'info' },
        new Writable({
          write(chunk, _encoding, callback) {
            output.lines.push(chunk.toString());
            callback();
          },
        }),
      ),
  };
});
beforeEach(() => {
  output.lines.length = 0;
});

describe('shared logger redaction', () => {
  it.each([false, true])(
    'redacts credentials in serialized logs (child logger: %s)',
    (child) => {
      const fields = {
        req: {
          method: 'GET',
          headers: {
            cookie: 'recipe.sid=PRIVATE_SESSION',
            authorization: 'Bearer PRIVATE_TOKEN',
            accept: 'application/json',
          },
        },
        res: {
          statusCode: 200,
          headers: {
            'set-cookie': [
              'recipe.sid=PRIVATE_NEW_SESSION',
              'other=PRIVATE_OTHER_COOKIE',
            ],
            'content-type': 'application/json',
          },
        },
      };
      // pino-http uses child bindings for request fields.
      if (child)
        logger
          .child({ req: fields.req })
          .info({ res: fields.res }, 'Request completed');
      else logger.info(fields, 'Request completed');
      expect(output.lines).toHaveLength(1);
      expect(output.lines[0]).not.toContain('PRIVATE_');
      const record = JSON.parse(output.lines[0]);
      expect(record.req.headers).toEqual({
        cookie: '[REDACTED]',
        authorization: '[REDACTED]',
        accept: 'application/json',
      });
      expect(record.res.headers).toEqual({
        'set-cookie': '[REDACTED]',
        'content-type': 'application/json',
      });
      expect(record.res.statusCode).toBe(200);
      expect(fields.req.headers.cookie).toBe('recipe.sid=PRIVATE_SESSION');
      expect(fields.res.headers['set-cookie'][0]).toBe(
        'recipe.sid=PRIVATE_NEW_SESSION',
      );
    },
  );

  it('logs requests without sensitive headers', () => {
    logger.info(
      {
        req: { headers: { accept: 'application/json' } },
        res: { statusCode: 200 },
      },
      'Public request',
    );
    expect(JSON.parse(output.lines[0])).toMatchObject({
      req: { headers: { accept: 'application/json' } },
      res: { statusCode: 200 },
      msg: 'Public request',
    });
  });
});
