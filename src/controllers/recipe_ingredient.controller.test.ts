import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRecipeIngredient,
  deleteRecipeIngredient,
  getRecipeIngredients,
  updateRecipeIngredient,
} from './recipe_ingredient.controller';

const services = vi.hoisted(() => ({
  getRecipeIngredientsService: vi.fn(),
  createRecipeIngredientService: vi.fn(),
  updateRecipeIngredientService: vi.fn(),
  deleteRecipeIngredientService: vi.fn(),
}));
vi.mock('../services/recipe_ingredient.service', () => services);

const userId = '9007199254740993';
const recipeId = '9007199254740995';
const lineId = '9007199254740997';
const line = { recipeIngredientId: lineId, recipeId, ingredientId: '12' };
const input = { ingredientId: '12', quantity: '2.0000', unitId: 1 };

const requestFor = (overrides: Record<string, unknown> = {}) =>
  ({
    session: { userId },
    params: { recipeId, recipeIngredientId: lineId },
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
  services.getRecipeIngredientsService.mockResolvedValue([line]);
  services.createRecipeIngredientService.mockResolvedValue(line);
  services.updateRecipeIngredientService.mockResolvedValue(line);
  services.deleteRecipeIngredientService.mockResolvedValue(undefined);
});

describe('recipe ingredient controller', () => {
  it('lists ingredients under an owner-scoped recipe', async () => {
    const { res, response } = responseFor();
    await getRecipeIngredients(
      requestFor() as Request<{ recipeId: string }>,
      response,
    );
    expect(
      services.getRecipeIngredientsService,
    ).toHaveBeenCalledExactlyOnceWith(userId, recipeId);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: [line],
    });
  });

  it('creates a line from the route recipe ID and validated body', async () => {
    const { res, response } = responseFor();
    await createRecipeIngredient(
      requestFor() as Request<{ recipeId: string }, unknown, typeof input>,
      response,
    );
    expect(
      services.createRecipeIngredientService,
    ).toHaveBeenCalledExactlyOnceWith(userId, recipeId, input);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(201);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      status: 'success',
      data: line,
    });
  });

  it('updates the requested line nested under the requested recipe', async () => {
    const changes = { quantity: '3.0000' };
    const { res, response } = responseFor();
    await updateRecipeIngredient(
      requestFor({ body: changes }) as Request<
        { recipeId: string; recipeIngredientId: string },
        unknown,
        typeof changes
      >,
      response,
    );
    expect(
      services.updateRecipeIngredientService,
    ).toHaveBeenCalledExactlyOnceWith(userId, recipeId, lineId, changes);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
  });

  it('deletes the nested line and returns an empty 204 response', async () => {
    const { res, response } = responseFor();
    await deleteRecipeIngredient(
      requestFor() as Request<{
        recipeId: string;
        recipeIngredientId: string;
      }>,
      response,
    );
    expect(
      services.deleteRecipeIngredientService,
    ).toHaveBeenCalledExactlyOnceWith(userId, recipeId, lineId);
    expect(res.status).toHaveBeenCalledExactlyOnceWith(204);
    expect(res.send).toHaveBeenCalledExactlyOnceWith();
  });

  it('does not invoke ingredient services without a session owner', async () => {
    const { res, response } = responseFor();
    await expect(
      getRecipeIngredients(
        requestFor({ session: {} }) as Request<{ recipeId: string }>,
        response,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(services.getRecipeIngredientsService).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
