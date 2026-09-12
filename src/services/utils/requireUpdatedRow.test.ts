import { describe, expect, it, vi } from 'vitest';
import { requireUpdatedRow } from './requireUpdatedRow';

describe('requireUpdatedRow', () => {
  it('returns the written snapshot without an existence query', async () => {
    const row = { product_id: '9007199254740993', version: 4 };
    const exists = vi.fn();
    expect(await requireUpdatedRow([row], exists, 'Product')).toBe(row);
    expect(exists).not.toHaveBeenCalled();
  });

  it.each([
    { found: false, statusCode: 404, message: 'Product not found.' },
    {
      found: true,
      statusCode: 409,
      message: 'Product has changed. Reload it before saving again.',
    },
  ])(
    'returns $statusCode when the scoped existence check is $found',
    async ({ found, statusCode, message }) => {
      const exists = vi.fn().mockResolvedValue(found);
      await expect(
        requireUpdatedRow([], exists, 'Product'),
      ).rejects.toMatchObject({ statusCode, message });
      expect(exists).toHaveBeenCalledExactlyOnceWith();
    },
  );

  it('propagates an existence-query failure instead of misreporting a conflict', async () => {
    const failure = new Error('database unavailable');
    await expect(
      requireUpdatedRow([], vi.fn().mockRejectedValue(failure), 'Product'),
    ).rejects.toBe(failure);
  });
});
