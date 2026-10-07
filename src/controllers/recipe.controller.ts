import type { Request, Response } from 'express';
import { requireUserId } from './utils/auth';
import {
  createRecipeService,
  deleteRecipeService,
  getRecipeByIdService,
  getRecipesService,
  updateRecipeService,
} from '../services/recipe.service';

import type {
  CreateRecipeInput,
  CreateRecipeIngredientInput,
  RecipeIngredientParams,
  RecipeParams,
  UpdateRecipeInput,
  UpdateRecipeIngredientInput,
} from '../schemas/recipe.schema';

export const getRecipes = async (req: Request, res: Response) => {
  const recipes = await getRecipesService(requireUserId(req));

  res.status(200).json({ status: 'success', data: recipes });
};

export const getRecipeById = async (
  req: Request<RecipeParams>,
  res: Response,
) => {
  const recipe = await getRecipeByIdService(
    requireUserId(req),
    req.params.recipeId,
  );

  res.status(200).json({ status: 'success', data: recipe });
};

export const createRecipe = async (
  req: Request<Record<string, never>, unknown, CreateRecipeInput>,
  res: Response,
) => {
  const recipe = await createRecipeService(requireUserId(req), req.body);

  res.status(201).json({ status: 'success', data: recipe });
};

export const updateRecipe = async (
  req: Request<RecipeParams, unknown, UpdateRecipeInput>,
  res: Response,
) => {
  const recipe = await updateRecipeService(
    requireUserId(req),
    req.params.recipeId,
    req.body,
  );

  res.status(200).json({ status: 'success', data: recipe });
};

export const deleteRecipe = async (
  req: Request<RecipeParams>,
  res: Response,
) => {
  await deleteRecipeService(requireUserId(req), req.params.recipeId);
  res.status(204).send();
};
