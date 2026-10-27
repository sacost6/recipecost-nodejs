import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Recipe } from '../../entities/Recipe';
import { HttpError } from '../../middleware/errorHandling/error';
import { metadataSource } from '../../test-utils/entityMetadata';
import type { RecipeRow } from '../utils/databaseRowTypes';
import {
  createRecipeService,
  deleteRecipeService,
  getRecipeByIdService,
  getRecipesService,
  updateRecipeService,
} from '../recipe.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  existsBy: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../repositories/recipe.repo', () => ({
  recipeRepository: repository,
}));

const source = metadataSource();
const userId = '9007199254740993';
const recipeId = '9007199254740995';
const createdAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T04:05:06.000Z');
const recipe = {
  recipeId,
  userId,
  name: 'Pancakes',
  description: null as string | null,
  instructions: 'Mix and cook.',
  servings: 4,
  version: 1,
};

beforeAll(async () => {
  await source.prepareMetadata();
  const real = source.getRepository(Recipe);
  Object.defineProperties(repository, {
    metadata: { get: () => real.metadata },
    manager: { get: () => real.manager },
  });
});

beforeEach(() => {
  vi.resetAllMocks();
  repository.create.mockImplementation((input: Partial<Recipe> = {}) =>
    source.getRepository(Recipe).create(input),
  );
  repository.save.mockImplementation(async (value: Recipe) => ({
    ...value,
    recipeId,
    version: 1,
    createdAt,
    updatedAt: createdAt,
  }));
  repository.find.mockResolvedValue([recipe]);
  repository.findOne.mockResolvedValue({ ...recipe });
  repository.remove.mockResolvedValue(undefined);
});

describe('recipe reads', () => {
  it('lists recipes only for the authenticated owner, with ingredients loaded', async () => {
    await expect(getRecipesService(userId)).resolves.toEqual([recipe]);

    expect(repository.find).toHaveBeenCalledExactlyOnceWith({
      where: { userId },
      relations: { ingredients: true },
      order: { name: 'ASC' },
    });
  });

  it('looks up a recipe using both its ID and authenticated owner', async () => {
    await expect(getRecipeByIdService(userId, recipeId)).resolves.toEqual(
      recipe,
    );
    expect(repository.findOne).toHaveBeenCalledExactlyOnceWith({
      where: { recipeId, userId },
      relations: { ingredients: true },
    });
  });

  it('returns 404 when the owner-scoped recipe lookup misses', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(getRecipeByIdService(userId, recipeId)).rejects.toEqual(
      new HttpError(404, 'Recipe not found'),
    );
  });
});

describe('recipe writes', () => {
  it('creates a recipe with the authenticated owner and allowed fields only', async () => {
    const input = {
      name: 'Pancakes',
      description: 'Weekend breakfast',
      instructions: 'Mix and cook.',
      servings: 4,
    };

    await expect(createRecipeService(userId, input)).resolves.toMatchObject({
      ...input,
      userId,
      version: 1,
    });
    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      ...input,
      userId,
    });
  });

  it('updates only supplied fields when the owner and version match', async () => {
    const row: RecipeRow = {
      recipe_id: recipeId,
      user_id: userId,
      name: 'Pancakes',
      description: 'Fluffy',
      instructions: 'Mix and cook.',
      servings: 4,
      version: 2,
      created_at: createdAt,
      updated_at: updatedAt,
    };
    repository.update.mockResolvedValue({ affected: 1, raw: [row] });

    const result = await updateRecipeService(userId, recipeId, {
      description: 'Fluffy',
      version: 1,
    });

    expect(repository.update).toHaveBeenCalledExactlyOnceWith(
      { recipeId, userId, version: 1 },
      { description: 'Fluffy' },
      { returning: '*' },
    );
    expect(result).toBeInstanceOf(Recipe);
    expect(result).toMatchObject({
      ...recipe,
      description: 'Fluffy',
      version: 2,
      updatedAt,
    });
    expect(repository.existsBy).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns a conflict when the recipe version is stale', async () => {
    repository.update.mockResolvedValue({ affected: 0, raw: [] });
    repository.existsBy.mockResolvedValue(true);

    await expect(
      updateRecipeService(userId, recipeId, {
        name: 'A stale edit',
        version: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.existsBy).toHaveBeenCalledExactlyOnceWith({
      recipeId,
      userId,
    });
  });

  it('returns 404 when the target recipe does not belong to the caller', async () => {
    repository.update.mockResolvedValue({ affected: 0, raw: [] });
    repository.existsBy.mockResolvedValue(false);

    await expect(
      updateRecipeService(userId, recipeId, {
        name: 'Changed',
        version: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not delete a recipe that is not owned by the caller', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(deleteRecipeService(userId, recipeId)).rejects.toEqual(
      new HttpError(404, 'Recipe not found'),
    );
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('deletes the recipe after an owner-scoped lookup', async () => {
    const existing = { ...recipe };
    repository.findOne.mockResolvedValue(existing);

    await expect(
      deleteRecipeService(userId, recipeId),
    ).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledExactlyOnceWith(existing);
  });
});
