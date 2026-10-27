import { describe, expect, it } from 'vitest';
import {
  createIngredientUnitConversionSchema,
  ingredientUnitConversionByIdParamsSchema,
  ingredientUnitConversionByIngredientIdParamsSchema,
  updateIngredientUnitConversionSchema,
} from '../ingredient_unit_conversion.schema';

const ingredientId = '9007199254740993';
const body = {
  ingredientId,
  fromUnitId: 1,
  toUnitId: 2,
  conversionFactor: '1000.000000000',
};

describe('create ingredient unit conversion schema', () => {
  it('preserves bigint and decimal strings and accepts different units', () => {
    expect(createIngredientUnitConversionSchema.parse({ body })).toEqual({
      body,
    });
  });

  it.each(['0', '-1', '1000000000', '1.0000000001', '0.000000000'])(
    'rejects invalid conversion factors: %s',
    (conversionFactor) => {
      expect(
        createIngredientUnitConversionSchema.safeParse({
          body: { ...body, conversionFactor },
        }).success,
      ).toBe(false);
    },
  );

  it('rejects the same unit as both source and destination', () => {
    expect(
      createIngredientUnitConversionSchema.safeParse({
        body: { ...body, toUnitId: body.fromUnitId },
      }).success,
    ).toBe(false);
  });

  it.each(['userId', 'createdAt', 'updatedAt'])(
    'rejects client supplied field %s',
    (field) => {
      expect(
        createIngredientUnitConversionSchema.safeParse({
          body: { ...body, [field]: 'forged' },
        }).success,
      ).toBe(false);
    },
  );
});

describe('ingredient unit conversion path schemas', () => {
  it('validates the ingredient and both unit IDs', () => {
    expect(
      ingredientUnitConversionByIdParamsSchema.parse({
        params: { ingredientId, fromUnitId: 1, toUnitId: 2 },
      }).params,
    ).toEqual({ ingredientId, fromUnitId: 1, toUnitId: 2 });
    expect(
      ingredientUnitConversionByIngredientIdParamsSchema.parse({
        params: { ingredientId },
      }).params.ingredientId,
    ).toBe(ingredientId);
  });

  it('rejects out of range or missing path identifiers', () => {
    expect(
      ingredientUnitConversionByIdParamsSchema.safeParse({
        params: { ingredientId, fromUnitId: 32768, toUnitId: 2 },
      }).success,
    ).toBe(false);
    expect(
      ingredientUnitConversionByIngredientIdParamsSchema.safeParse({
        params: { ingredientId: '9223372036854775808' },
      }).success,
    ).toBe(false);
  });
});

describe('update ingredient unit conversion schema', () => {
  it('requires exactly one positive conversion factor', () => {
    expect(
      updateIngredientUnitConversionSchema.parse({
        params: { ingredientId, fromUnitId: 1, toUnitId: 2 },
        body: { conversionFactor: '0.000000001' },
      }).body.conversionFactor,
    ).toBe('0.000000001');
    expect(
      updateIngredientUnitConversionSchema.safeParse({
        params: { ingredientId, fromUnitId: 1, toUnitId: 2 },
        body: {},
      }).success,
    ).toBe(false);
  });
});
