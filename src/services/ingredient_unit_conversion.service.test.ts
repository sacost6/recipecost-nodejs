import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import {
  createIngredientUnitConversionService,
  deleteIngredientUnitConversionService,
  getIngredientUnitConversionByIdService,
  getIngredientUnitConversionByIngredientIdService,
  getIngredientUnitConversionsService,
  updateIngredientUnitConversionService,
} from './ingredient_unit_conversion.service';

const mocks = vi.hoisted(() => ({
  repository: {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    merge: vi.fn(),
    delete: vi.fn(),
  },
  getIngredientByIdService: vi.fn(),
}));
vi.mock('../repositories/ingredient_unit_conversion.repo', () => ({
  ingredientUnitConversionRepository: mocks.repository,
}));
vi.mock('./ingredient.service', () => ({
  getIngredientByIdService: mocks.getIngredientByIdService,
}));

const userId = '9007199254740994';
const ingredientId = '9007199254740993';
const conversion = {
  ingredientId,
  fromUnitId: 1,
  toUnitId: 2,
  conversionFactor: '1000.000000000',
};
const input = { ...conversion };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.repository.find.mockResolvedValue([conversion]);
  mocks.repository.findOneBy.mockResolvedValue(conversion);
  mocks.repository.create.mockImplementation((value) => ({ ...value }));
  mocks.repository.save.mockImplementation(async (value) => value);
  mocks.repository.merge.mockImplementation((target, patch) =>
    Object.assign(target, patch),
  );
  mocks.repository.delete.mockResolvedValue({ affected: 1 });
  mocks.getIngredientByIdService.mockResolvedValue({ ingredientId, userId });
});

describe('ingredient unit conversion reads', () => {
  it('lists shared and caller-owned conversions in stable composite-key order', async () => {
    await expect(getIngredientUnitConversionsService(userId)).resolves.toEqual([
      conversion,
    ]);

    const [options] = mocks.repository.find.mock.calls[0];
    expect(options.where).toHaveLength(2);
    expect(options.where[0].ingredient.userId).toEqual(expect.any(Object));
    expect(options.where[1]).toEqual({ ingredient: { userId } });
    expect(options.order).toEqual({
      ingredientId: 'ASC',
      fromUnitId: 'ASC',
      toUnitId: 'ASC',
    });
  });

  it('lists all conversions for an accessible ingredient, including an empty list', async () => {
    mocks.repository.find.mockResolvedValue([]);
    await expect(
      getIngredientUnitConversionByIngredientIdService(userId, ingredientId),
    ).resolves.toEqual([]);

    expect(mocks.getIngredientByIdService).toHaveBeenCalledExactlyOnceWith(
      userId,
      ingredientId,
    );
    expect(mocks.repository.find).toHaveBeenCalledExactlyOnceWith({
      where: { ingredientId },
      order: { fromUnitId: 'ASC', toUnitId: 'ASC' },
    });
  });

  it('looks up an exact conversion after checking ingredient visibility', async () => {
    await expect(
      getIngredientUnitConversionByIdService(userId, ingredientId, 1, 2),
    ).resolves.toBe(conversion);

    expect(mocks.getIngredientByIdService).toHaveBeenCalledExactlyOnceWith(
      userId,
      ingredientId,
    );
    expect(mocks.repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      ingredientId,
      fromUnitId: 1,
      toUnitId: 2,
    });
  });

  it('does not query conversions for an inaccessible ingredient', async () => {
    mocks.getIngredientByIdService.mockRejectedValue(
      new HttpError(404, 'Ingredient not found'),
    );

    await expect(
      getIngredientUnitConversionByIngredientIdService(userId, ingredientId),
    ).rejects.toEqual(new HttpError(404, 'Ingredient not found'));
    expect(mocks.repository.find).not.toHaveBeenCalled();
  });

  it('returns 404 when the exact conversion is missing', async () => {
    mocks.repository.findOneBy.mockResolvedValue(null);
    await expect(
      getIngredientUnitConversionByIdService(userId, ingredientId, 1, 2),
    ).rejects.toEqual(
      new HttpError(
        404,
        'No matching unit conversion exists for this ingredient.',
      ),
    );
  });
});

describe('ingredient unit conversion writes', () => {
  it('creates a conversion for an ingredient owned by the caller', async () => {
    const result = await createIngredientUnitConversionService(userId, input);
    expect(mocks.getIngredientByIdService).toHaveBeenCalledExactlyOnceWith(
      userId,
      ingredientId,
    );
    expect(mocks.repository.create).toHaveBeenCalledExactlyOnceWith(input);
    expect(mocks.repository.save).toHaveBeenCalledExactlyOnceWith(result);
    expect(result).toEqual(conversion);
  });

  it('does not allow changing conversions on a shared ingredient', async () => {
    mocks.getIngredientByIdService.mockResolvedValue({
      ingredientId,
      userId: null,
    });

    await expect(
      createIngredientUnitConversionService(userId, input),
    ).rejects.toEqual(
      new HttpError(
        403,
        'Conversions for shared ingredients cannot be changed.',
      ),
    );
    expect(mocks.repository.create).not.toHaveBeenCalled();
    expect(mocks.repository.save).not.toHaveBeenCalled();
  });

  it('updates only the conversion selected by its full composite key', async () => {
    const existing = { ...conversion };
    mocks.repository.findOneBy.mockResolvedValue(existing);
    const result = await updateIngredientUnitConversionService(
      userId,
      ingredientId,
      1,
      2,
      { conversionFactor: '500.000000000' },
    );

    expect(mocks.repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      ingredientId,
      fromUnitId: 1,
      toUnitId: 2,
    });
    expect(mocks.repository.merge).toHaveBeenCalledExactlyOnceWith(existing, {
      conversionFactor: '500.000000000',
    });
    expect(mocks.repository.save).toHaveBeenCalledExactlyOnceWith(existing);
    expect(result.conversionFactor).toBe('500.000000000');
  });

  it('does not save an update when the composite-key row is missing', async () => {
    mocks.repository.findOneBy.mockResolvedValue(null);
    await expect(
      updateIngredientUnitConversionService(userId, ingredientId, 1, 2, {
        conversionFactor: '500.000000000',
      }),
    ).rejects.toEqual(
      new HttpError(
        404,
        'No matching unit conversion exists for this ingredient.',
      ),
    );
    expect(mocks.repository.merge).not.toHaveBeenCalled();
    expect(mocks.repository.save).not.toHaveBeenCalled();
  });

  it('deletes only the conversion selected by its full composite key', async () => {
    await expect(
      deleteIngredientUnitConversionService(userId, ingredientId, 1, 2),
    ).resolves.toBeUndefined();
    expect(mocks.repository.delete).toHaveBeenCalledExactlyOnceWith({
      ingredientId,
      fromUnitId: 1,
      toUnitId: 2,
    });

    mocks.repository.delete.mockResolvedValue({ affected: 0 });
    await expect(
      deleteIngredientUnitConversionService(userId, ingredientId, 1, 2),
    ).rejects.toEqual(
      new HttpError(
        404,
        'No matching unit conversion exists for this ingredient.',
      ),
    );
  });

  it('propagates storage failures without returning successful results', async () => {
    const error = new Error('database unavailable');
    mocks.repository.save.mockRejectedValue(error);
    await expect(
      createIngredientUnitConversionService(userId, input),
    ).rejects.toBe(error);
  });
});
