import * as z from 'zod';
const PG_BIGINT_MAX = 9223372036854775807n;
export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{CURRENCY_LENGTH}$/);
export const positiveBigintIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^[1-9]\d*$/.test(value) && BigInt(value) <= PG_BIGINT_MAX,
    {
      message:
        'ID must be a positive integer no greater than 9223372036854775807',
    },
  );

export const positiveDecimal12_4Schema = z
  .string()
  .trim()
  .regex(
    /^\d{1,8}(?:\.\d{1,4})?$/,
    'Use up to 8 digits before the decimal and 4 after',
  )
  .refine((value) => /[1-9]/.test(value), 'Value must be greater than zero');

export const positiveDecimal18_9Schema = z
  .string()
  .trim()
  .regex(
    /^\d{1,9}(?:\.\d{1,9})?$/,
    'Use up to 9 digits before the decimal and 9 after',
  )
  .refine((value) => /[1-9]/.test(value), 'Value must be greater than zero');

export const nonnegativeDecimal12_2Schema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(?:\.\d{1,2})?$/,
    'Price must have up to 10 integer digits and 2 decimal places',
  );
