import { type Request, type Response } from 'express';
import {
  createIngredientService,
  deleteIngredientService,
  getIngredientByIdService,
  getIngredientsService,
  updateIngredientService,
} from '../services/ingredients.service';

import { type IngredientParamsSchema } from '../schemas/ingredient.schema';

export const getIngredients = async (req: Request, res: Response) => {
  const ingredients = await getIngredientsService();

  res.status(200).json({
    status: 'success',
    data: ingredients,
  });
};

export const getIngredientsById = async (
  req: Request<IngredientParamsSchema>,
  res: Response,
) => {
  const { ingredientId } = req.params;
  const ingredient = await getIngredientByIdService(ingredientId);

  res.status(200).json({
    status: 'success',
    data: ingredient,
  });
};

export const createIngredient = async (req: Request, res: Response) => {
  const ingredientData = req.body;
  const newIngredient = await createIngredientService(ingredientData);

  res.status(201).json({
    status: 'success',
    data: newIngredient,
  });
};

export const updateIngredient = async (req: Request, res: Response) => {
  const { ingredientId } = req.params;
  const updateData = req.body;
  const updatedIngredient = await updateIngredientService(
    ingredientId,
    updateData,
  );

  res.status(200).json({
    status: 'success',
    data: updatedIngredient,
  });
};

export const deleteIngredient = async (
  req: Request<IngredientParamsSchema>,
  res: Response,
) => {
  const { ingredientId } = req.params;
  await deleteIngredientService(ingredientId);

  res.status(204).send();
};
