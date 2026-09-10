import { describe, expect, it } from 'vitest';
import {
  positiveBigintIdSchema,
  positiveIntegerSchema,
  positiveSmallintSchema,
  stringSchema,
} from './utils';

describe('positiveBigintIdSchema', () => {
  it.each([
    '1',
    '32768',
    '2147483648',
    '9007199254740991',
    '9007199254740992',
    '9007199254740993',
    '9223372036854775806',
    '9223372036854775807',
  ])('preserves the exact digits in valid ID %s', (value) => {
    expect(positiveBigintIdSchema.parse(value)).toBe(value);
  });

  it('trims whitespace without losing bigint precision', () => {
    expect(positiveBigintIdSchema.parse(' \t9223372036854775807\n ')).toBe(
      '9223372036854775807',
    );
  });

  it.each([
    { label: 'empty string', value: '' },
    { label: 'whitespace', value: ' \t\n ' },
    { label: 'zero', value: '0' },
    { label: 'negative integer', value: '-1' },
    { label: 'plus sign', value: '+1' },
    { label: 'leading zero', value: '01' },
    { label: 'multiple zeroes', value: '000' },
    { label: 'decimal notation', value: '1.0' },
    { label: 'fraction', value: '1.5' },
    { label: 'scientific notation', value: '1e3' },
    { label: 'hexadecimal notation', value: '0x10' },
    { label: 'thousands separator', value: '1,000' },
    { label: 'underscore separator', value: '1_000' },
    { label: 'embedded whitespace', value: '1 2' },
    { label: 'embedded newline', value: '1\n2' },
    { label: 'alphabetic string', value: 'abc' },
    { label: 'SQL fragment', value: '1 OR 1=1' },
    { label: 'non-ASCII digits', value: '１２' },
    { label: 'just above bigint maximum', value: '9223372036854775808' },
    {
      label: 'much larger than bigint maximum',
      value: '9999999999999999999999999999999999999999',
    },
    { label: 'number', value: 1 },
    { label: 'bigint primitive', value: 1n },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'boolean', value: true },
    { label: 'array', value: ['1'] },
    { label: 'object', value: { id: '1' } },
  ])('rejects $label without throwing during safeParse', ({ value }) => {
    expect(positiveBigintIdSchema.safeParse(value).success).toBe(false);
  });
});

describe.each([
  {
    name: 'positiveSmallintSchema',
    schema: positiveSmallintSchema,
    max: 32767,
  },
  {
    name: 'positiveIntegerSchema',
    schema: positiveIntegerSchema,
    max: 2147483647,
  },
])('$name', ({ schema, max }) => {
  it('accepts both bounds and preserves numeric output', () => {
    expect(schema.parse(1)).toBe(1);
    expect(schema.parse(max)).toBe(max);
  });

  it('rejects the first integer above the maximum', () => {
    expect(schema.safeParse(max + 1).success).toBe(false);
  });

  it.each([
    { label: 'zero', value: 0 },
    { label: 'negative zero', value: -0 },
    { label: 'negative integer', value: -1 },
    { label: 'positive fraction', value: 0.5 },
    { label: 'non-integer greater than one', value: 1.5 },
    { label: 'NaN', value: Number.NaN },
    { label: 'positive infinity', value: Number.POSITIVE_INFINITY },
    { label: 'negative infinity', value: Number.NEGATIVE_INFINITY },
    { label: 'unsafe integer', value: Number.MAX_SAFE_INTEGER + 1 },
    { label: 'numeric string', value: '1' },
    { label: 'padded numeric string', value: ' 1 ' },
    { label: 'empty string', value: '' },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'boolean', value: true },
    { label: 'array', value: [1] },
    { label: 'object', value: { value: 1 } },
  ])('rejects $label instead of coercing it', ({ value }) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe('stringSchema', () => {
  it('trims surrounding whitespace while preserving interior whitespace', () => {
    expect(stringSchema.parse(' \tBread  flour\n ')).toBe('Bread  flour');
  });

  it('allows empty strings so required fields can set their own minimum length', () => {
    expect(stringSchema.parse('')).toBe('');
    expect(stringSchema.parse(' \t\n ')).toBe('');
  });

  it('preserves Unicode ingredient names', () => {
    expect(stringSchema.parse('  Crème fraîche  ')).toBe('Crème fraîche');
  });

  it.each([123, true, null, undefined, [], {}])(
    'rejects non-string %j',
    (value) => {
      expect(stringSchema.safeParse(value).success).toBe(false);
    },
  );
});
