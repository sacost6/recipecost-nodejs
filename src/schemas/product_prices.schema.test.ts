import { describe, expect, it } from 'vitest';
import {
  createProductPriceSchema,
  productPriceParamsSchema,
  updateProductPriceSchema,
} from './product_prices.schema';

const body = {
  productId: '9007199254740993',
  storeLocationId: '9223372036854775807',
  price: '3.99',
  currencyCode: 'USD',
};
const replacement = {
  storeLocationId: body.storeLocationId,
  price: body.price,
  currencyCode: body.currencyCode,
};
const params = { priceId: '9007199254740995' };

describe('createProductPriceSchema', () => {
  it('normalizes currency and trims IDs and price without converting precision-sensitive strings', () => {
    expect(
      createProductPriceSchema.parse({
        body: {
          productId: ` ${body.productId} `,
          storeLocationId: ` ${body.storeLocationId} `,
          price: ' 3.99 ',
          currencyCode: ' usd ',
        },
      }),
    ).toEqual({ body });
  });

  it.each(['USD', 'EUR', 'gbp'])(
    'accepts a three-letter currency code %s',
    (currencyCode) => {
      expect(
        createProductPriceSchema.parse({ body: { ...body, currencyCode } }).body
          .currencyCode,
      ).toBe(currencyCode.toUpperCase());
    },
  );

  it.each(['US', 'USDD', 'U1D', '$$$', '', 'A{CURRENCY_LENGTH}', null])(
    'rejects malformed currency code %j',
    (currencyCode) => {
      expect(
        createProductPriceSchema.safeParse({ body: { ...body, currencyCode } })
          .success,
      ).toBe(false);
    },
  );

  it.each(['0', '0.00', '0.01', '9999999999.99'])(
    'accepts a nonnegative numeric(12,2) price %s',
    (price) => {
      expect(
        createProductPriceSchema.parse({ body: { ...body, price } }).body.price,
      ).toBe(price);
    },
  );

  it.each(['-0.01', '10000000000', '3.999', '1e2', '1,000.00', '', 3.99, null])(
    'rejects a price outside the decimal-string contract: %j',
    (price) => {
      expect(
        createProductPriceSchema.safeParse({ body: { ...body, price } })
          .success,
      ).toBe(false);
    },
  );

  it.each(['productId', 'storeLocationId'] as const)(
    'requires %s to be a positive PostgreSQL bigint string',
    (field) => {
      for (const value of [
        undefined,
        '0',
        '-1',
        '01',
        '1.5',
        '9223372036854775808',
        123,
        null,
      ]) {
        expect(
          createProductPriceSchema.safeParse({
            body: { ...body, [field]: value },
          }).success,
        ).toBe(false);
      }
    },
  );

  it.each(['userId', 'priceId', 'recordedAt', 'product'])(
    'rejects client-supplied %s',
    (field) => {
      expect(
        createProductPriceSchema.safeParse({
          body: { ...body, [field]: 'forged' },
        }).success,
      ).toBe(false);
    },
  );

  it.each([undefined, null, [], {}, '3.99'])(
    'rejects invalid request body %j',
    (invalidBody) => {
      expect(
        createProductPriceSchema.safeParse({ body: invalidBody }).success,
      ).toBe(false);
    },
  );
});

describe('productPriceParamsSchema', () => {
  it('uses priceId and preserves bigint precision after trimming', () => {
    expect(
      productPriceParamsSchema.parse({
        params: { priceId: ` ${params.priceId} ` },
      }),
    ).toEqual({ params });
  });

  it.each(['0', '01', '9223372036854775808', undefined, 123])(
    'rejects invalid price ID %j',
    (priceId) => {
      expect(
        productPriceParamsSchema.safeParse({ params: { priceId } }).success,
      ).toBe(false);
    },
  );

  it('does not accept productId as a substitute for the observation ID', () => {
    expect(
      productPriceParamsSchema.safeParse({
        params: { productId: body.productId },
      }).success,
    ).toBe(false);
  });
});

describe('updateProductPriceSchema', () => {
  it('validates an individual observation and normalizes its replacement fields', () => {
    expect(
      updateProductPriceSchema.parse({
        params,
        body: { ...replacement, currencyCode: ' eur ', price: ' 0.00 ' },
      }),
    ).toEqual({
      params,
      body: { ...replacement, currencyCode: 'EUR', price: '0.00' },
    });
  });

  it.each(['userId', 'productId', 'priceId', 'recordedAt'])(
    'rejects attempts to change %s',
    (field) => {
      expect(
        updateProductPriceSchema.safeParse({
          params,
          body: { ...replacement, [field]: 'forged' },
        }).success,
      ).toBe(false);
    },
  );

  it('requires all fields for the current full-update contract', () => {
    for (const field of ['storeLocationId', 'price', 'currencyCode'] as const) {
      expect(
        updateProductPriceSchema.safeParse({
          params,
          body: { ...replacement, [field]: undefined },
        }).success,
      ).toBe(false);
    }
  });

  it('preserves currency, decimal and ID validation on updates', () => {
    for (const invalid of [
      { currencyCode: 'US' },
      { price: '-1' },
      { price: '1.999' },
      { storeLocationId: '0' },
    ]) {
      expect(
        updateProductPriceSchema.safeParse({
          params,
          body: { ...replacement, ...invalid },
        }).success,
      ).toBe(false);
    }
    expect(
      updateProductPriceSchema.safeParse({
        params: { priceId: '0' },
        body: replacement,
      }).success,
    ).toBe(false);
  });
});
