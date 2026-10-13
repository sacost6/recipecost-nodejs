import type { Request, Response } from 'express';
import { requireUserId } from './utils/auth';
import {
  createIngredientUnitConversionService,
  deleteIngredientUnitConversionService,
  getIngredientUnitConversionByIngredientIdService,
  getIngredientUnitConversionByIdService,
  getIngredientUnitConversionsService,
  updateIngredientUnitConversionService,
} from '../services/ingredient_unit_conversion.service';

export const getIngredientUnitConversions = async (
  req: Request,
  res: Response,
) => {
  const conversions = await getIngredientUnitConversionsService(
    requireUserId(req),
  );

  res.status(200).json({ status: 'success', data: conversions });
};

export const getIngredientUnitConversionByIngredientId = async (
  req: Request,
  res: Response,
) => {
  const conversions = await getIngredientUnitConversionByIngredientIdService(
    requireUserId(req),
    String(req.params.ingredientId),
  );

  res.status(200).json({ status: 'success', data: conversions });
};

export const getIngredientUnitConversionById = async (
  req: Request,
  res: Response,
) => {
  const { ingredientId, fromUnitId, toUnitId } = req.params;
  const conversion = await getIngredientUnitConversionByIdService(
    requireUserId(req),
    String(ingredientId),
    Number(fromUnitId),
    Number(toUnitId),
  );

  res.status(200).json({ status: 'success', data: conversion });
};

export const createIngredientUnitConversion = async (
  req: Request,
  res: Response,
) => {
  const conversion = await createIngredientUnitConversionService(
    requireUserId(req),
    req.body,
  );

  res.status(201).json({ status: 'success', data: conversion });
};

export const updateIngredientUnitConversion = async (
  req: Request,
  res: Response,
) => {
  const { ingredientId, fromUnitId, toUnitId } = req.params;
  const conversion = await updateIngredientUnitConversionService(
    requireUserId(req),
    String(ingredientId),
    Number(fromUnitId),
    Number(toUnitId),
    req.body,
  );

  res.status(200).json({ status: 'success', data: conversion });
};

export const deleteIngredientUnitConversion = async (
  req: Request,
  res: Response,
) => {
  const { ingredientId, fromUnitId, toUnitId } = req.params;
  await deleteIngredientUnitConversionService(
    requireUserId(req),
    String(ingredientId),
    Number(fromUnitId),
    Number(toUnitId),
  );

  res.status(204).send();
};
