import { describe, expect, it } from 'vitest';
import {
  createIngredientSchema,
  ingredientParamsSchema,
  updateIngredientSchema,
} from './ingredient.schema';

const validParams = { ingredientId: '42' };

describe('createIngredientSchema', () => {
  it('accepts a name without adding defaults for omitted fields', () => {
    expect(createIngredientSchema.parse({ body: { name: 'Flour' } })).toEqual({
      body: { name: 'Flour' },
    });
  });

  it('trims names and descriptions while preserving the category number', () => {
    expect(
      createIngredientSchema.parse({
        body: {
          name: '  Bread flour\t',
          categoryId: 12,
          description: '\n High protein flour  ',
        },
      }),
    ).toEqual({
      body: {
        name: 'Bread flour',
        categoryId: 12,
        description: 'High protein flour',
      },
    });
  });

  it('accepts explicit null for both optional fields', () => {
    expect(
      createIngredientSchema.parse({
        body: { name: 'Flour', categoryId: null, description: null },
      }).body,
    ).toEqual({ name: 'Flour', categoryId: null, description: null });
  });

  it.each([1, 100])('accepts a trimmed name of %i characters', (length) => {
    const name = 'a'.repeat(length);
    expect(
      createIngredientSchema.parse({ body: { name: `  ${name}  ` } }).body.name,
    ).toBe(name);
  });

  it.each([
    { label: 'missing', value: undefined },
    { label: 'empty', value: '' },
    { label: 'whitespace only', value: ' \t\n ' },
    { label: 'longer than 100 characters', value: 'a'.repeat(101) },
    { label: 'null', value: null },
    { label: 'a number', value: 5 },
    { label: 'an array', value: ['Flour'] },
    { label: 'an object', value: { name: 'Flour' } },
  ])('rejects a name that is $label', ({ value }) => {
    const result = createIngredientSchema.safeParse({ body: { name: value } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['body', 'name'] }),
        ]),
      );
    }
  });

  it.each([1, 32767])('accepts category ID %i as a number', (categoryId) => {
    expect(
      createIngredientSchema.parse({ body: { name: 'Flour', categoryId } }).body
        .categoryId,
    ).toBe(categoryId);
  });

  it.each([
    { label: 'zero', value: 0 },
    { label: 'negative', value: -1 },
    { label: 'fractional', value: 1.5 },
    { label: 'above the smallint range', value: 32768 },
    { label: 'numeric string', value: '1' },
    { label: 'boolean', value: true },
  ])('rejects a $label category ID', ({ value }) => {
    expect(
      createIngredientSchema.safeParse({
        body: { name: 'Flour', categoryId: value },
      }).success,
    ).toBe(false);
  });

  it.each(['', ' \t\n '])(
    'accepts an empty description after trimming %j',
    (description) => {
      expect(
        createIngredientSchema.parse({ body: { name: 'Flour', description } })
          .body.description,
      ).toBe('');
    },
  );

  it.each([123, false, [], {}])(
    'rejects non-string description %j',
    (description) => {
      expect(
        createIngredientSchema.safeParse({
          body: { name: 'Flour', description },
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ['ingredientId', '42'],
    ['version', 1],
    ['createdAt', '2026-01-01T00:00:00Z'],
    ['updatedAt', '2026-01-01T00:00:00Z'],
    ['unit', 'g'],
    ['packageSize', 5000],
    ['packageCost', 8.99],
    ['unexpected', true],
  ])('rejects the unsupported body field %s', (field, value) => {
    expect(
      createIngredientSchema.safeParse({
        body: { name: 'Flour', [field]: value },
      }).success,
    ).toBe(false);
  });

  it.each([undefined, null, [], 'Flour', 123, {}])(
    'rejects invalid body %j',
    (body) => {
      expect(createIngredientSchema.safeParse({ body }).success).toBe(false);
    },
  );
});

describe('ingredientParamsSchema', () => {
  it.each(['1', '9007199254740993', '9223372036854775807'])(
    'accepts bigint ID %s without losing precision or converting to a number',
    (ingredientId) => {
      expect(
        ingredientParamsSchema.parse({ params: { ingredientId } }),
      ).toEqual({
        params: { ingredientId },
      });
    },
  );

  it('trims surrounding whitespace from the ID', () => {
    expect(
      ingredientParamsSchema.parse({ params: { ingredientId: ' \t42\n ' } }),
    ).toEqual({ params: validParams });
  });

  it.each([
    { label: 'missing', value: undefined },
    { label: 'empty', value: '' },
    { label: 'alphabetic', value: 'abc' },
    { label: 'zero', value: '0' },
    { label: 'negative', value: '-1' },
    { label: 'fractional', value: '1.5' },
    { label: 'leading zero', value: '01' },
    { label: 'scientific notation', value: '1e3' },
    { label: 'above bigint maximum', value: '9223372036854775808' },
    { label: 'a JSON number', value: 42 },
    { label: 'null', value: null },
  ])('rejects an ID that is $label', ({ value }) => {
    const result = ingredientParamsSchema.safeParse({
      params: { ingredientId: value },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['params', 'ingredientId'] }),
        ]),
      );
    }
  });

  it('requires the params object', () => {
    expect(ingredientParamsSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateIngredientSchema', () => {
  it('accepts a name-only edit with an expected version and preserves omitted fields', () => {
    expect(
      updateIngredientSchema.parse({
        params: validParams,
        body: { name: '  Bread flour  ', version: 7 },
      }),
    ).toEqual({
      params: validParams,
      body: { name: 'Bread flour', version: 7 },
    });
  });

  it.each([
    { label: 'category assignment', changes: { categoryId: 12 } },
    { label: 'category removal', changes: { categoryId: null } },
    {
      label: 'description assignment',
      changes: { description: 'High protein' },
    },
    { label: 'description removal', changes: { description: null } },
    { label: 'empty description', changes: { description: '' } },
  ])('accepts a $label as the only edited field', ({ changes }) => {
    expect(
      updateIngredientSchema.parse({
        params: validParams,
        body: { ...changes, version: 7 },
      }).body,
    ).toEqual({ ...changes, version: 7 });
  });

  it('accepts all editable fields and trims their string values', () => {
    expect(
      updateIngredientSchema.parse({
        params: { ingredientId: ' 42 ' },
        body: {
          name: ' Flour ',
          categoryId: 32767,
          description: ' Bread flour ',
          version: 2147483647,
        },
      }),
    ).toEqual({
      params: validParams,
      body: {
        name: 'Flour',
        categoryId: 32767,
        description: 'Bread flour',
        version: 2147483647,
      },
    });
  });

  it.each([1, 2147483647])('accepts integer version %i', (version) => {
    expect(
      updateIngredientSchema.parse({
        params: validParams,
        body: { name: 'Flour', version },
      }).body.version,
    ).toBe(version);
  });

  it.each([
    { label: 'missing', value: undefined },
    { label: 'numeric string', value: '7' },
    { label: 'zero', value: 0 },
    { label: 'negative', value: -1 },
    { label: 'fractional', value: 1.5 },
    { label: 'above int32 maximum', value: 2147483648 },
    { label: 'null', value: null },
    { label: 'boolean', value: true },
  ])('rejects a $label version', ({ value }) => {
    const result = updateIngredientSchema.safeParse({
      params: validParams,
      body: { name: 'Flour', version: value },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['body', 'version'] }),
        ]),
      );
    }
  });

  it.each([
    { label: 'version only', body: { version: 1 } },
    {
      label: 'all edit fields explicitly undefined',
      body: {
        version: 1,
        name: undefined,
        categoryId: undefined,
        description: undefined,
      },
    },
  ])('rejects $label as an empty patch', ({ body }) => {
    const result = updateIngredientSchema.safeParse({
      params: validParams,
      body,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['body'],
            message: 'At least one field is required to update an ingredient',
          }),
        ]),
      );
    }
  });

  it.each([undefined, null, [], 'Flour', 123, {}])(
    'rejects invalid patch body %j',
    (body) => {
      expect(
        updateIngredientSchema.safeParse({ params: validParams, body }).success,
      ).toBe(false);
    },
  );

  it.each([
    { label: 'empty name', changes: { name: '' } },
    { label: 'blank name', changes: { name: ' \t ' } },
    { label: 'null name', changes: { name: null } },
    { label: 'overlong name', changes: { name: 'a'.repeat(101) } },
    { label: 'zero category ID', changes: { categoryId: 0 } },
    {
      label: 'category ID outside smallint range',
      changes: { categoryId: 32768 },
    },
    { label: 'string category ID', changes: { categoryId: '12' } },
    { label: 'numeric description', changes: { description: 123 } },
  ])('preserves create-time validation for $label', ({ changes }) => {
    expect(
      updateIngredientSchema.safeParse({
        params: validParams,
        body: { ...changes, version: 1 },
      }).success,
    ).toBe(false);
  });

  it.each([
    'ingredientId',
    'createdAt',
    'updatedAt',
    'packageCost',
    'unexpected',
  ])('rejects unknown patch field %s even with a valid edit', (field) => {
    expect(
      updateIngredientSchema.safeParse({
        params: validParams,
        body: { name: 'Flour', version: 1, [field]: 'unexpected' },
      }).success,
    ).toBe(false);
  });

  it.each(['abc', '0', '9223372036854775808'])(
    'validates ingredient ID %s on a patch as well as on a lookup',
    (ingredientId) => {
      expect(
        updateIngredientSchema.safeParse({
          params: { ingredientId },
          body: { name: 'Flour', version: 1 },
        }).success,
      ).toBe(false);
    },
  );
});
