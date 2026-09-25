import { metadataSource } from '../test-utils/entityMetadata';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ingredient } from '../entities/Ingredient';
import { IngredientCategory } from '../entities/IngredientCategory';
import type { IngredientRow } from './utils/databaseRowTypes';
import {
  createIngredientService,
  updateIngredientService,
} from './ingredient.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  existsBy: vi.fn(),
}));
const categoryRepository = vi.hoisted(() => ({ findOneBy: vi.fn() }));

vi.mock('../repositories/ingredient.repo', () => ({
  ingredientRepository: repository,
}));
vi.mock('../repositories/ingredient_category.repo', () => ({
  ingredientCategoryRepository: categoryRepository,
}));

const source = metadataSource();
const userId = '9007199254740994';
const ingredientId = '9007199254740993';
const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T04:05:06.000Z');
const category = Object.assign(new IngredientCategory(), {
  categoryId: 4,
  name: 'Baking',
  createdAt,
});

beforeAll(async () => {
  await source.prepareMetadata();
  const real = source.getRepository(Ingredient);
  Object.defineProperties(repository, {
    metadata: { get: () => real.metadata },
    manager: { get: () => real.manager },
  });
});

beforeEach(() => {
  vi.resetAllMocks();
  repository.create.mockImplementation((values: Partial<Ingredient> = {}) =>
    source.getRepository(Ingredient).create(values),
  );
  repository.save.mockImplementation(async (value: Ingredient) =>
    Object.assign(value, {
      ingredientId,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    }),
  );
  categoryRepository.findOneBy.mockResolvedValue(category);
});

describe('ingredient mutation responses', () => {
  it('includes the saved category together with persisted create fields', async () => {
    const result = await createIngredientService(userId, {
      name: 'Flour',
      categoryId: category.categoryId,
    });

    expect(result).toMatchObject({
      ingredientId,
      userId,
      name: 'Flour',
      categoryId: category.categoryId,
      category,
      description: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
    expect(categoryRepository.findOneBy).toHaveBeenCalledExactlyOnceWith({
      categoryId: category.categoryId,
    });
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it.each([undefined, null])(
    'returns a null category without querying categories when create categoryId is %s',
    async (categoryId) => {
      const result = await createIngredientService(userId, {
        name: 'Flour',
        categoryId,
      });

      expect(result).toMatchObject({ categoryId: null, category: null });
      expect(categoryRepository.findOneBy).not.toHaveBeenCalled();
    },
  );

  it.each([4, null])(
    'hydrates categoryId %s from the written row and preserves its version and fields',
    async (categoryId) => {
      // A reread would return another writer's values, not this mutation.
      repository.findOne.mockResolvedValue(
        Object.assign(new Ingredient(), {
          ingredientId,
          userId,
          name: 'Later edit',
          categoryId: 3,
          category: { categoryId: 3, name: 'Pantry' },
          version: 99,
        }),
      );
      const row: IngredientRow = {
        ingredient_id: ingredientId,
        user_id: userId,
        name: 'Bread flour',
        category_id: categoryId,
        description: 'Unbleached flour',
        created_at: createdAt,
        updated_at: updatedAt,
        version: 8,
      };
      repository.update.mockResolvedValue({ affected: 1, raw: [row] });

      const result = await updateIngredientService(userId, ingredientId, {
        name: 'Bread flour',
        categoryId,
        version: 7,
      });

      expect(repository.update).toHaveBeenCalledExactlyOnceWith(
        { ingredientId, userId, version: 7 },
        { name: 'Bread flour', categoryId },
        { returning: '*' },
      );
      expect(result).toBeInstanceOf(Ingredient);
      expect(result).toMatchObject({
        ingredientId,
        userId,
        name: 'Bread flour',
        categoryId,
        category: categoryId === null ? null : category,
        description: 'Unbleached flour',
        createdAt,
        updatedAt,
        version: 8,
      });
      expect(repository.findOne).toHaveBeenCalledTimes(1);
      expect(repository.existsBy).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      if (categoryId === null) {
        expect(categoryRepository.findOneBy).not.toHaveBeenCalled();
      } else {
        expect(categoryRepository.findOneBy).toHaveBeenCalledExactlyOnceWith({
          categoryId,
        });
      }
    },
  );
});
