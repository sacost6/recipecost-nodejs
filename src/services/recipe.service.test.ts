import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import {
  createRecipeService,
  deleteRecipeService,
  getRecipeByIdService,
  getRecipesService,
  updateRecipeService,
} from './recipe.service';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../repositories/recipe.repo', () => ({
  recipeRepository: repository,
}));

const userId = '9007199254740993';
const recipeId = '9007199254740995';
const recipe = {
  recipeId,
  userId,
  name: 'Pancakes',
  description: null as string | null,
  instructions: 'Mix and cook.',
  servings: 4,
};

beforeEach(() => {
  vi.resetAllMocks();
  repository.create.mockImplementation((input) => ({ ...input }));
  repository.save.mockImplementation(async (value) => value);
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

    await expect(createRecipeService(userId, input)).resolves.toEqual({
      ...input,
      userId,
    });
    expect(repository.create).toHaveBeenCalledExactlyOnceWith({
      ...input,
      userId,
    });
  });

  it('updates only supplied fields on an owner-scoped recipe', async () => {
    const existing = { ...recipe };
    repository.findOne.mockResolvedValue(existing);
    repository.save.mockImplementation(async (value) => value);

    await expect(
      updateRecipeService(userId, recipeId, { description: 'Fluffy' }),
    ).resolves.toMatchObject({
      ...recipe,
      description: 'Fluffy',
    });
    expect(existing.name).toBe('Pancakes');
    expect(existing.instructions).toBe('Mix and cook.');
    expect(repository.save).toHaveBeenCalledExactlyOnceWith(existing);
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
