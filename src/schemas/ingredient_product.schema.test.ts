import { describe, expect, it } from 'vitest';
import {
  createIngredientProductSchema,
  ingredientProductParams,
  updateIngredientProductSchema,
} from './ingredient_product.schema';

const body = {
  ingredientId: '9007199254740993',
  packageUnitId: 1,
  productName: 'Bread flour',
  packageQuantity: '500.0000',
};
const params = { productId: '9223372036854775807' };

describe('createIngredientProductSchema', () => {
  it('accepts required fields without inventing defaults for optional fields', () => {
    expect(createIngredientProductSchema.parse({ body })).toEqual({ body });
  });

  it('trims strings while preserving bigint, decimal and leading-zero UPC precision', () => {
    expect(
      createIngredientProductSchema.parse({
        body: {
          ...body,
          ingredientId: ` ${body.ingredientId} `,
          productName: ' Bread flour ',
          packageQuantity: ' 500.0000 ',
          brand: ' Example Pantry ',
          upc: ' 000123456789 ',
        },
      }),
    ).toEqual({
      body: { ...body, brand: 'Example Pantry', upc: '000123456789' },
    });
  });

  it('allows explicit null for brand and UPC', () => {
    expect(
      createIngredientProductSchema.parse({
        body: { ...body, brand: null, upc: null },
      }).body,
    ).toEqual({ ...body, brand: null, upc: null });
  });

  it.each([
    { field: 'productName', limit: 150 },
    { field: 'brand', limit: 100 },
    { field: 'upc', limit: 20 },
  ])(
    'enforces the $field length limit of $limit after trimming',
    ({ field, limit }) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, [field]: ` ${'a'.repeat(limit)} ` },
        }).success,
      ).toBe(true);
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, [field]: 'a'.repeat(limit + 1) },
        }).success,
      ).toBe(false);
    },
  );

  it.each(['', ' \t ', null, 123])(
    'rejects invalid product name %j',
    (productName) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, productName },
        }).success,
      ).toBe(false);
    },
  );

  it.each(['0.0001', '1', '99999999.9999'])(
    'accepts positive numeric(12,4) package quantity %s',
    (packageQuantity) => {
      expect(
        createIngredientProductSchema.parse({
          body: { ...body, packageQuantity },
        }).body.packageQuantity,
      ).toBe(packageQuantity);
    },
  );

  it.each(['0', '0.0000', '-1', '100000000', '1.00001', '1e3', '', 500, null])(
    'rejects invalid package quantity %j',
    (packageQuantity) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, packageQuantity },
        }).success,
      ).toBe(false);
    },
  );

  it.each([1, 32767])(
    'accepts numeric smallint package unit %i',
    (packageUnitId) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, packageUnitId },
        }).success,
      ).toBe(true);
    },
  );

  it.each([0, -1, 32768, 1.5, '1', null])(
    'rejects invalid package unit %j',
    (packageUnitId) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, packageUnitId },
        }).success,
      ).toBe(false);
    },
  );

  it('accepts the maximum PostgreSQL bigint ingredient ID without number conversion', () => {
    expect(
      createIngredientProductSchema.parse({
        body: { ...body, ingredientId: '9223372036854775807' },
      }).body.ingredientId,
    ).toBe('9223372036854775807');
  });

  it.each(['0', '-1', '01', '9223372036854775808', 123, undefined])(
    'rejects invalid ingredient ID %j',
    (ingredientId) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, ingredientId },
        }).success,
      ).toBe(false);
    },
  );

  it.each(['userId', 'user', 'productId', 'createdAt', 'prices'])(
    'rejects client-supplied %s',
    (field) => {
      expect(
        createIngredientProductSchema.safeParse({
          body: { ...body, [field]: 'forged' },
        }).success,
      ).toBe(false);
    },
  );

  it.each([undefined, null, [], {}, 'product'])(
    'rejects invalid request body %j',
    (invalidBody) => {
      expect(
        createIngredientProductSchema.safeParse({ body: invalidBody }).success,
      ).toBe(false);
    },
  );
});

describe('ingredientProductParams', () => {
  it('trims and preserves a bigint product ID', () => {
    expect(
      ingredientProductParams.parse({
        params: { productId: ` ${params.productId} ` },
      }),
    ).toEqual({ params });
  });

  it.each(['0', '01', '9223372036854775808', 123, undefined])(
    'rejects invalid product ID %j',
    (productId) => {
      expect(
        ingredientProductParams.safeParse({ params: { productId } }).success,
      ).toBe(false);
    },
  );
});

describe('updateIngredientProductSchema', () => {
  const required = { ingredientId: body.ingredientId, version: 3 };
  it('allows changing just the ingredient association with an expected version', () => {
    expect(
      updateIngredientProductSchema.parse({ params, body: required }),
    ).toEqual({ params, body: required });
  });
  it('trims an edited name without supplying other optional fields', () => {
    expect(
      updateIngredientProductSchema.parse({
        params,
        body: { ...required, productName: ' Flour ' },
      }),
    ).toEqual({ params, body: { ...required, productName: 'Flour' } });
  });
  it.each(['brand', 'upc'])(
    'allows clearing %s alongside required fields',
    (field) => {
      expect(
        updateIngredientProductSchema.parse({
          params,
          body: { ...required, [field]: null },
        }).body,
      ).toEqual({ ...required, [field]: null });
    },
  );
  it.each([
    {},
    { ingredientId: body.ingredientId },
    { version: 3 },
    { ...required, version: 0 },
    { ...required, version: '3' },
    { ...required, version: 1.5 },
    { ...required, version: 2147483648 },
    { ...required, ingredientId: '0' },
    { ...required, productName: ' ' },
    { ...required, packageQuantity: '0' },
    { ...required, packageUnitId: 0 },
  ])('rejects invalid patch %j', (patch) => {
    expect(
      updateIngredientProductSchema.safeParse({ params, body: patch }).success,
    ).toBe(false);
  });
  it('validates the product ID', () => {
    expect(
      updateIngredientProductSchema.safeParse({
        params: { productId: '0' },
        body: required,
      }).success,
    ).toBe(false);
  });
  it.each(['userId', 'user', 'productId', 'prices'])(
    'rejects forged %s with otherwise valid input',
    (field) => {
      expect(
        updateIngredientProductSchema.safeParse({
          params,
          body: { ...required, [field]: 'forged' },
        }).success,
      ).toBe(false);
    },
  );
});
