import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import {
  getIngredientCategoriesService,
  getIngredientCategoryByIdService,
} from './ingredient_category.service';

const repository = vi.hoisted(() => ({ find: vi.fn(), findOneBy: vi.fn() }));
vi.mock('../repositories/ingredient_category.repo', () => ({
  ingredientCategoryRepository: repository,
}));

const category = { categoryId: 5, name: 'Baking' };

beforeEach(() => {
  vi.resetAllMocks();
  repository.find.mockResolvedValue([category]);
  repository.findOneBy.mockResolvedValue(category);
});

describe('ingredient category service', () => {
  it('lists categories in alphabetical order and preserves empty results', async () => {
    await expect(getIngredientCategoriesService()).resolves.toEqual([category]);
    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      order: { name: 'ASC' },
    });
    repository.find.mockResolvedValueOnce([]);
    await expect(getIngredientCategoriesService()).resolves.toEqual([]);
  });

  it('looks up by numeric ID and returns the found category', async () => {
    await expect(getIngredientCategoryByIdService(5)).resolves.toBe(category);
    expect(repository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      categoryId: 5,
    });
  });

  it('returns 404 for a missing category', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(getIngredientCategoryByIdService(5)).rejects.toEqual(
      new HttpError(404, 'Ingredient Category does not exist.'),
    );
  });

  it('propagates repository failures', async () => {
    const error = new Error('database unavailable');
    repository.find.mockRejectedValue(error);
    await expect(getIngredientCategoriesService()).rejects.toBe(error);
  });
});
