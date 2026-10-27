import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteRecipe,
  getRecipeById,
  getRecipes,
  createRecipe,
  updateRecipe,
} from '../recipe.controller';

const services = vi.hoisted(() => ({
  createRecipeService: vi.fn(),
  deleteRecipeService: vi.fn(),
  getRecipeByIdService: vi.fn(),
  getRecipesService: vi.fn(),
  updateRecipeService: vi.fn(),
}));
vi.mock('../../services/recipe.service', () => services);

const userId = '9007199254740993';
const recipeId = '9007199254740995';
const recipe = { recipeId, userId, name: 'Pancakes', servings: 4 };
const input = { name: 'Pancakes', servings: 4, instructions: '' };

const requestFor = (overrides: Record<string, unknown> = {}) =>
  ({
    session: { userId },
    params: { recipeId },
    body: input,
    ...overrides,
  }) as unknown as Request;

const responseFor = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return { res, response: res as unknown as Response };
};

beforeEach(() => {
  vi.resetAllMocks();
  services.getRecipesService.mockResolvedValue([recipe]);
  services.getRecipeByIdService.mockResolvedValue(recipe);
  services.createRecipeService.mockResolvedValue(recipe);
  services.updateRecipeService.mockResolvedValue(recipe);
  services.deleteRecipeService.mockResolvedValue(undefined);
});

describe('recipe controller', () => {
  it('lists recipes for the authenticated user', async () => {
    const { res, response } = responseFor();
    await getRecipes(requestFor(), response);
    expect(services.getRecipesService).toHaveBeenCalledExactlyOnceWith(userId);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: [recipe],
    });
  });

  it('gets a recipe using the session owner and route ID', async () => {
    const { res, response } = responseFor();
    await getRecipeById(
      requestFor() as Request<{ recipeId: string }>,
      response,
    );
    expect(services.getRecipeByIdService).toHaveBeenCalledExactlyOnceWith(
      userId,
      recipeId,
    );
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: recipe,
    });
  });

  it('creates a recipe from the validated body and session owner', async () => {
    const { res, response } = responseFor();
    await createRecipe(
      requestFor() as Request<Record<string, never>, unknown, typeof input>,
      response,
    );
    expect(services.createRecipeService).toHaveBeenCalledExactlyOnceWith(
      userId,
      input,
    );
    expect(res.status).toHaveBeenCalledExactlyOnceWith(201);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: recipe,
    });
  });

  it('updates only through the owner and the selected recipe ID', async () => {
    const changes = { name: 'New recipe name', version: 1 };
    const { res, response } = responseFor();
    await updateRecipe(
      requestFor({ body: changes }) as Request<
        { recipeId: string },
        unknown,
        typeof changes
      >,
      response,
    );
    expect(services.updateRecipeService).toHaveBeenCalledExactlyOnceWith(
      userId,
      recipeId,
      changes,
    );
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
  });

  it('deletes the owner-scoped recipe and sends an empty 204 response', async () => {
    const { res, response } = responseFor();
    await deleteRecipe(requestFor() as Request<{ recipeId: string }>, response);
    expect(services.deleteRecipeService).toHaveBeenCalledExactlyOnceWith(
      userId,
      recipeId,
    );
    expect(res.status).toHaveBeenCalledExactlyOnceWith(204);
    expect(res.send).toHaveBeenCalledExactlyOnceWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects a missing session identity before calling a service', async () => {
    const { res, response } = responseFor();
    await expect(
      getRecipes(requestFor({ session: {} }), response),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(services.getRecipesService).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
