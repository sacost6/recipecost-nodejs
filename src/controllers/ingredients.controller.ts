import { type Request, type Response } from 'express';
import {
  createIngredientService,
  deleteIngredientService,
  getIngredientByIdService,
  getIngredientsService,
  updateIngredientService,
} from '../services/ingredients.service';
import { requireUserId } from '../controllers/utils/auth';
import { type IngredientParamsSchema } from '../schemas/ingredient.schema';

export const getIngredients = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const ingredients = await getIngredientsService(userId);

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
  const userId = requireUserId(req);

  const ingredient = await getIngredientByIdService(userId, ingredientId);

  res.status(200).json({
    status: 'success',
    data: ingredient,
  });
};

export const createIngredient = async (req: Request, res: Response) => {
  const ingredientData = req.body;
  const userId = requireUserId(req);
  const newIngredient = await createIngredientService(userId, ingredientData);

  res.status(201).json({
    status: 'success',
    data: newIngredient,
  });
};

export const updateIngredient = async (
  req: Request<IngredientParamsSchema>,
  res: Response,
) => {
  const { ingredientId } = req.params;
  const updateData = req.body;
  const userId = requireUserId(req);
  const updatedIngredient = await updateIngredientService(
    userId,
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
  const userId = requireUserId(req);
  await deleteIngredientService(userId, ingredientId);

  res.status(204).send();
};
