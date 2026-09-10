import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createIngredientSchema,
  ingredientParamsSchema,
  updateIngredientSchema,
} from '../schemas/ingredient.schema';
import { HttpError } from '../utils/httpError';
import { validateRequest } from './validateRequest.middleware';

const request = (parts: Partial<Request> = {}): Request =>
  ({ body: {}, params: {}, query: {}, ...parts }) as Request;

const validate = (schema: z.ZodType, req: Request) => {
  const next = vi.fn();
  const response = { status: vi.fn(), json: vi.fn() };
  validateRequest(schema)(req, response as unknown as Response, next);
  expect(response.status).not.toHaveBeenCalled();
  expect(response.json).not.toHaveBeenCalled();
  return next;
};

describe('validateRequest ingredient requests', () => {
  it('replaces a create body with its trimmed, validated values', () => {
    const original = {
      name: '  Bread flour  ',
      categoryId: 1,
      description: '  For baking  ',
    };
    const req = request({ body: original });
    const next = validate(createIngredientSchema, req);

    expect(req.body).toEqual({
      name: 'Bread flour',
      categoryId: 1,
      description: 'For baking',
    });
    expect(original.name).toBe('  Bread flour  ');
    expect(req.body).not.toBe(original);
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('preserves omitted optional fields instead of introducing null defaults', () => {
    const req = request({ body: { name: 'Flour' } });
    validate(createIngredientSchema, req);

    expect(req.body).toEqual({ name: 'Flour' });
    expect(req.body).not.toHaveProperty('categoryId');
    expect(req.body).not.toHaveProperty('description');
  });

  it('preserves explicit nulls so updates can clear nullable fields', () => {
    const req = request({
      params: { ingredientId: '1' },
      body: { categoryId: null, description: null, version: 2 },
    });
    const next = validate(updateIngredientSchema, req);

    expect(req.body).toEqual({
      categoryId: null,
      description: null,
      version: 2,
    });
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('trims bigint IDs and preserves their exact string precision', () => {
    const req = request({
      params: { ingredientId: '  9223372036854775807  ' },
    });
    const next = validate(ingredientParamsSchema, req);

    expect(req.params).toEqual({ ingredientId: '9223372036854775807' });
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('validates both the params and body of an update', () => {
    const req = request({
      params: { ingredientId: ' 17 ' },
      body: { name: '  Bread flour ', version: 4 },
    });
    const next = validate(updateIngredientSchema, req);

    expect(req.params).toEqual({ ingredientId: '17' });
    expect(req.body).toEqual({ name: 'Bread flour', version: 4 });
    expect(req.body).not.toHaveProperty('description');
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('preserves params and query when the schema validates only a body', () => {
    const params = { unrelatedId: 'keep me' };
    const query = { page: '2' };
    const req = request({ body: { name: 'Flour' }, params, query });
    validate(createIngredientSchema, req);

    expect(req.params).toBe(params);
    expect(req.query).toBe(query);
  });

  it('preserves body and query when the schema validates only params', () => {
    const body = { name: 'unchanged body' };
    const query = { page: '2' };
    const req = request({ body, query, params: { ingredientId: '1' } });
    validate(ingredientParamsSchema, req);

    expect(req.body).toBe(body);
    expect(req.query).toBe(query);
  });

  it.each(['abc', '0', '-1', '1.5', '9223372036854775808'])(
    'forwards a 400 for invalid ID %s',
    (ingredientId) => {
      const req = request({ params: { ingredientId } });
      const next = validate(ingredientParamsSchema, req);

      expect(next).toHaveBeenCalledTimes(1);
      const [error] = next.mock.calls[0];
      expect(error).toBeInstanceOf(HttpError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('ID must be a positive integer');
    },
  );

  it.each([
    ['empty body', {}],
    ['whitespace name', { name: '   ' }],
    ['unknown field', { name: 'Flour', oldUnit: 'kg' }],
    ['non-numeric category', { name: 'Flour', categoryId: '1' }],
    ['missing body', undefined],
    ['null body', null],
    ['array body', [{ name: 'Flour' }]],
  ])('rejects a create request with %s', (_label, body) => {
    const next = validate(createIngredientSchema, request({ body }));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it.each([
    ['missing version', { name: 'Flour' }],
    ['string version', { name: 'Flour', version: '1' }],
    ['stale-shape empty patch', { version: 1 }],
    ['zero version', { name: 'Flour', version: 0 }],
    ['fractional version', { name: 'Flour', version: 1.5 }],
  ])('rejects an update with %s', (_label, body) => {
    const req = request({ params: { ingredientId: '1' }, body });
    const next = validate(updateIngredientSchema, req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('aggregates issues across request parts into one error', () => {
    const req = request({
      params: { ingredientId: 'abc' },
      body: { name: '   ', version: 1 },
    });
    const next = validate(updateIngredientSchema, req);

    expect(next).toHaveBeenCalledTimes(1);
    const [error] = next.mock.calls[0];
    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('ID must be a positive integer');
    expect(error.message).toContain('Name is required');
    expect(error.message).toContain(', ');
  });

  it('does not partially apply successful transforms when another part is invalid', () => {
    const body = { name: '  Flour  ', version: 1 };
    const params = { ingredientId: 'invalid' };
    const query = { untouched: 'true' };
    const req = request({ body, params, query });
    const next = validate(updateIngredientSchema, req);

    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(req.body).toBe(body);
    expect(req.body.name).toBe('  Flour  ');
    expect(req.params).toBe(params);
    expect(req.query).toBe(query);
  });
});

describe('validateRequest reusable schemas', () => {
  it('uses parsed query values when a schema transforms the query', () => {
    const schema = z.object({
      query: z.object({
        term: z.string().trim().toLowerCase(),
        page: z.string().regex(/^\d+$/),
      }),
    });
    const originalQuery = { term: '  FLOUR  ', page: '2', ignored: 'value' };
    const req = request({ query: originalQuery });
    const next = validate(schema, req);

    expect(req.query).toEqual({ term: 'flour', page: '2' });
    expect(originalQuery.term).toBe('  FLOUR  ');
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('keeps all request parts intact when the parsed schema omits them', () => {
    const req = request({
      body: { untouched: true },
      params: { ingredientId: '1' },
      query: { page: '2' },
    });
    const original = { body: req.body, params: req.params, query: req.query };
    const next = validate(z.object({}), req);

    expect(req.body).toBe(original.body);
    expect(req.params).toBe(original.params);
    expect(req.query).toBe(original.query);
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it('preserves the ordered messages from every validation issue', () => {
    const schema = z.object({
      body: z.object({
        first: z.string().min(1, 'First is required'),
        second: z.string().min(1, 'Second is required'),
      }),
    });
    const next = validate(schema, request({ body: { first: '', second: '' } }));

    expect(next).toHaveBeenCalledExactlyOnceWith(expect.any(HttpError));
    expect(next.mock.calls[0][0].message).toBe(
      'First is required, Second is required',
    );
  });
});
