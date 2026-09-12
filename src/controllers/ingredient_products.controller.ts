import { type Request, type Response } from 'express';
import type {
  IngredientProductParams,
  ListIngredientProductsQuery,
  UpdateIngredientProductInput,
  IngredientProductUpcParams,
  CreateIngredientProductInput,
} from '../schemas/ingredient_product.schema';
import {
  getIngredientProductsService,
  getIngredientProductByIdService,
  getIngredientProductByUpcService,
  createIngredientProductService,
  updateIngredientProductService,
  deleteIngredientProductService,
} from '../services/ingredient_products.service';
import { requireUserId } from './utils/auth';

export const getIngredientProducts = async (
  req: Request,
  res: Response<unknown, { query: ListIngredientProductsQuery }>,
): Promise<void> => {
  const userId = requireUserId(req);

  const products = await getIngredientProductsService(userId, res.locals.query);

  res.status(200).json({
    status: 'success',
    data: products,
  });
};

export const getIngredientProductById = async (
  req: Request<IngredientProductParams>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);
  const { productId } = req.params;

  const product = await getIngredientProductByIdService(userId, productId);
  res.status(200).json({
    status: 'success',
    data: product,
  });
};

export const getIngredientProductByUpc = async (
  req: Request<IngredientProductUpcParams>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);

  const { upc } = req.params;
  const product = await getIngredientProductByUpcService(userId, upc);

  res.status(200).json({
    status: 'success',
    data: product,
  });
};

export const createIngredientProduct = async (
  req: Request<Record<string, never>, unknown, CreateIngredientProductInput>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);

  const product = await createIngredientProductService(userId, req.body);

  res.status(201).json({
    status: 'success',
    data: product,
  });
};

export const updateIngredientProduct = async (
  req: Request<IngredientProductParams, unknown, UpdateIngredientProductInput>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);

  const { productId } = req.params;
  const updateData = req.body;
  const updatedProduct = await updateIngredientProductService(
    userId,
    productId,
    updateData,
  );

  res.status(200).json({
    status: 'success',
    data: updatedProduct,
  });
};

export const deleteIngredientProduct = async (
  req: Request<IngredientProductParams>,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);

  const { productId } = req.params;

  await deleteIngredientProductService(userId, productId);

  res.status(204).send();
};
