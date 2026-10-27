import type { Request, Response } from 'express';
import { requireUserId } from './utils/auth';
import {
  deleteIngredientDensityService,
  getIngredientDensityService,
  getIngredientDensitySuggestionsService,
  saveIngredientDensityService,
  searchIngredientDensityFoodsService,
} from '../services/ingredient_density.service';
import type {
  IngredientDensityParams,
  SaveIngredientDensityInput,
  SearchIngredientDensityFoodsInput,
} from '../schemas/ingredient_density.schema';

export const getIngredientDensity = async (
  req: Request<IngredientDensityParams>,
  res: Response,
) => {
  const density = await getIngredientDensityService(
    requireUserId(req),
    req.params.ingredientId,
  );
  res.status(200).json({ status: 'success', data: density });
};

export const searchIngredientDensityFoods = async (
  req: Request<
    IngredientDensityParams,
    unknown,
    SearchIngredientDensityFoodsInput
  >,
  res: Response,
) => {
  const foods = await searchIngredientDensityFoodsService(
    requireUserId(req),
    req.params.ingredientId,
    req.body,
  );
  res.status(200).json({ status: 'success', data: foods });
};

export const getIngredientDensitySuggestions = async (
  req: Request,
  res: Response,
) => {
  const suggestions = await getIngredientDensitySuggestionsService(
    requireUserId(req),
    String(req.params.ingredientId),
    Number(req.params.fdcId),
  );
  res.status(200).json({ status: 'success', data: suggestions });
};

export const saveIngredientDensity = async (
  req: Request<IngredientDensityParams, unknown, SaveIngredientDensityInput>,
  res: Response,
) => {
  const density = await saveIngredientDensityService(
    requireUserId(req),
    req.params.ingredientId,
    req.body,
  );
  res.status(200).json({ status: 'success', data: density });
};

export const deleteIngredientDensity = async (
  req: Request<IngredientDensityParams>,
  res: Response,
) => {
  await deleteIngredientDensityService(
    requireUserId(req),
    req.params.ingredientId,
  );
  res.status(204).send();
};
