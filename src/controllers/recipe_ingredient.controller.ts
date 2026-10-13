import type { Request, Response } from 'express';
import { requireUserId } from './utils/auth';
import type { RecipeParams } from '../schemas/recipe.schema';
import type {
  CreateRecipeIngredientInput,
  RecipeIngredientParams,
  UpdateRecipeIngredientInput,
} from '../schemas/recipe_ingredient.schema';
import {
  getRecipeIngredientsService,
  createRecipeIngredientService,
  updateRecipeIngredientService,
  deleteRecipeIngredientService,
} from '../services/recipe_ingredient.service';

export const getRecipeIngredients = async (
  req: Request<RecipeParams>,
  res: Response,
) => {
  const ingredients = await getRecipeIngredientsService(
    requireUserId(req),
    req.params.recipeId,
  );

  res.status(200).json({ status: 'success', data: ingredients });
};

export const createRecipeIngredient = async (
  req: Request<RecipeParams, unknown, CreateRecipeIngredientInput>,
  res: Response,
) => {
  const ingredient = await createRecipeIngredientService(
    requireUserId(req),
    req.params.recipeId,
    req.body,
  );

  res.status(201).json({ status: 'success', data: ingredient });
};

export const updateRecipeIngredient = async (
  req: Request<RecipeIngredientParams, unknown, UpdateRecipeIngredientInput>,
  res: Response,
) => {
  const ingredient = await updateRecipeIngredientService(
    requireUserId(req),
    req.params.recipeId,
    req.params.recipeIngredientId,
    req.body,
  );

  res.status(200).json({ status: 'success', data: ingredient });
};

export const deleteRecipeIngredient = async (
  req: Request<RecipeIngredientParams>,
  res: Response,
) => {
  await deleteRecipeIngredientService(
    requireUserId(req),
    req.params.recipeId,
    req.params.recipeIngredientId,
  );

  res.status(204).send();
};
