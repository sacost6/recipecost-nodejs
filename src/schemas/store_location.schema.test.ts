import { describe, expect, it } from 'vitest';
import {
  createStoreLocationSchema,
  updateStoreLocationSchema,
} from './store_location.schema';

const body = {
  retailerId: '9007199254740993',
  addressLine1: '123 Main St',
  city: 'Chicago',
  stateCode: 'IL',
  postalCode: '60601',
  countryCode: 'US',
};

describe('store location input', () => {
  it('accepts an address without optional store number or second address line', () => {
    expect(createStoreLocationSchema.parse({ body })).toEqual({ body });
  });

  it('accepts explicit nulls for optional address fields', () => {
    const input = { ...body, storeNumber: null, addressLine2: null };
    expect(createStoreLocationSchema.parse({ body: input }).body).toEqual(
      input,
    );
  });

  it('trims address fields, normalizes country, and preserves postal-code leading zeros', () => {
    const result = createStoreLocationSchema.parse({
      body: {
        ...body,
        addressLine1: ' 123 Main St ',
        city: ' Chicago ',
        postalCode: ' 00501 ',
        countryCode: ' us ',
      },
    });
    expect(result.body).toEqual({ ...body, postalCode: '00501' });
  });

  it.each([undefined, null, '', '   ', 60601, '1'.repeat(21)])(
    'rejects an invalid or missing postal code: %j',
    (postalCode) => {
      expect(
        createStoreLocationSchema.safeParse({ body: { ...body, postalCode } })
          .success,
      ).toBe(false);
    },
  );

  it.each(['addressLine1', 'city'] as const)(
    'rejects whitespace-only %s',
    (field) => {
      expect(
        createStoreLocationSchema.safeParse({
          body: { ...body, [field]: '   ' },
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ['storeNumber', 50],
    ['addressLine1', 150],
    ['addressLine2', 150],
    ['city', 100],
    ['postalCode', 20],
  ] as const)('enforces the database length limit for %s', (field, max) => {
    expect(
      createStoreLocationSchema.safeParse({
        body: { ...body, [field]: 'a'.repeat(max) },
      }).success,
    ).toBe(true);
    expect(
      createStoreLocationSchema.safeParse({
        body: { ...body, [field]: 'a'.repeat(max + 1) },
      }).success,
    ).toBe(false);
  });

  it.each(['stateCode', 'countryCode'] as const)(
    'requires two characters for %s',
    (field) => {
      for (const value of ['', 'A', 'AAA']) {
        expect(
          createStoreLocationSchema.safeParse({
            body: { ...body, [field]: value },
          }).success,
        ).toBe(false);
      }
    },
  );

  it('accepts a postal-code-only update without requiring other address fields', () => {
    const input = {
      params: { storeLocationId: '42' },
      body: { postalCode: '60602-1234' },
    };
    expect(updateStoreLocationSchema.parse(input)).toEqual(input);
  });

  it('rejects empty updates and unknown create fields', () => {
    expect(
      updateStoreLocationSchema.safeParse({
        params: { storeLocationId: '42' },
        body: {},
      }).success,
    ).toBe(false);
    expect(
      createStoreLocationSchema.safeParse({
        body: { ...body, unexpected: true },
      }).success,
    ).toBe(false);
  });
});
