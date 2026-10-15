import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/errorHandling/errorHandler.middleware';
import { recipeRoutes } from './recipe.routes';

const handlers = vi.hoisted(() => ({
  getRecipes: vi.fn(),
  getRecipeById: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  getRecipeIngredients: vi.fn(),
  createRecipeIngredient: vi.fn(),
  updateRecipeIngredient: vi.fn(),
  deleteRecipeIngredient: vi.fn(),
}));

vi.mock('../controllers/recipe.controller', () => ({
  getRecipes: handlers.getRecipes,
  getRecipeById: handlers.getRecipeById,
  createRecipe: handlers.createRecipe,
  updateRecipe: handlers.updateRecipe,
  deleteRecipe: handlers.deleteRecipe,
}));
vi.mock('../controllers/recipe_ingredient.controller', () => ({
  getRecipeIngredients: handlers.getRecipeIngredients,
  createRecipeIngredient: handlers.createRecipeIngredient,
  updateRecipeIngredient: handlers.updateRecipeIngredient,
  deleteRecipeIngredient: handlers.deleteRecipeIngredient,
}));

let currentUserId: string | undefined;
const app = express();
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.session = { userId: currentUserId } as Request['session'];
  next();
});
app.use('/api/recipes', recipeRoutes);
app.use(errorHandler);

const recipeId = '9007199254740993';
const lineId = '9007199254740995';
const recipeInput = {
  name: 'Pancakes',
  servings: 4,
  instructions: 'Mix and cook.',
};
const lineInput = {
  ingredientId: '9007199254740997',
  quantity: '2.5000',
  unitId: 1,
};
const operations = [
  { name: 'list recipes', method: 'get', path: '', handler: 'getRecipes' },
  {
    name: 'create recipe',
    method: 'post',
    path: '',
    handler: 'createRecipe',
    body: recipeInput,
  },
  {
    name: 'get recipe',
    method: 'get',
    path: `/${recipeId}`,
    handler: 'getRecipeById',
  },
  {
    name: 'update recipe',
    method: 'patch',
    path: `/${recipeId}`,
    handler: 'updateRecipe',
    body: { name: 'New name', version: 1 },
  },
  {
    name: 'delete recipe',
    method: 'delete',
    path: `/${recipeId}`,
    handler: 'deleteRecipe',
  },
  {
    name: 'list recipe ingredients',
    method: 'get',
    path: `/${recipeId}/ingredients`,
    handler: 'getRecipeIngredients',
  },
  {
    name: 'add recipe ingredient',
    method: 'post',
    path: `/${recipeId}/ingredients`,
    handler: 'createRecipeIngredient',
    body: lineInput,
  },
  {
    name: 'update recipe ingredient',
    method: 'patch',
    path: `/${recipeId}/ingredients/${lineId}`,
    handler: 'updateRecipeIngredient',
    body: { quantity: '3.0000' },
  },
  {
    name: 'remove recipe ingredient',
    method: 'delete',
    path: `/${recipeId}/ingredients/${lineId}`,
    handler: 'deleteRecipeIngredient',
  },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  currentUserId = '9007199254740999';
  for (const [name, handler] of Object.entries(handlers)) {
    handler.mockImplementation((_req: Request, res: Response) => {
      if (name.startsWith('delete')) return res.status(204).send();
      return res.status(name.startsWith('create') ? 201 : 200).json({
        status: 'success',
        data: name,
      });
    });
  }
});
afterEach(() => vi.unstubAllEnvs());

describe('recipe routes', () => {
  it('registers the router at the recipe API base path', async () => {
    vi.stubEnv('API_SECRET', 'recipe-route-test-secret');
    vi.stubEnv('DATABASE_URL', 'postgresql://unused:unused@127.0.0.1:1/unused');
    vi.stubEnv('SESSION_SECRET', 'recipe-route-test-session-secret-32-chars');
    const { RouteMap } = await import('./index.js');
    expect(RouteMap.find(([path]) => path === '/api/recipes')?.[1]).toBe(
      recipeRoutes,
    );
  });

  it.each(operations)('routes $name to its controller', async (operation) => {
    const response = await request(app)
      [operation.method](`/api/recipes${operation.path}`)
      .send('body' in operation ? operation.body : undefined);

    expect(response.status).toBe(
      operation.method === 'post'
        ? 201
        : operation.method === 'delete'
          ? 204
          : 200,
    );
    expect(handlers[operation.handler]).toHaveBeenCalledOnce();
  });

  it.each(operations)(
    'requires an authenticated session for $name',
    async (operation) => {
      currentUserId = undefined;
      const response = await request(app)
        [operation.method](`/api/recipes${operation.path}`)
        .send('body' in operation ? operation.body : undefined);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Please log in.',
      });
      expect(handlers[operation.handler]).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      method: 'post',
      path: '',
      body: { ...recipeInput, userId: 'forged' },
      handler: 'createRecipe',
    },
    {
      method: 'patch',
      path: `/${recipeId}`,
      body: {},
      handler: 'updateRecipe',
    },
    {
      method: 'post',
      path: `/${recipeId}/ingredients`,
      body: { ...lineInput, quantity: '-1' },
      handler: 'createRecipeIngredient',
    },
    {
      method: 'patch',
      path: `/${recipeId}/ingredients/${lineId}`,
      body: {},
      handler: 'updateRecipeIngredient',
    },
  ] as const)(
    'rejects invalid $method request before the controller runs',
    async ({ method, path, body, handler }) => {
      const response = await request(app)
        [method](`/api/recipes${path}`)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(handlers[handler]).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed nested IDs before invoking any controller', async () => {
    const response = await request(app)
      .patch('/api/recipes/0/ingredients/invalid')
      .send({ quantity: '1' });
    expect(response.status).toBe(400);
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
