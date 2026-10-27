import { HttpError } from '../middleware/errorHandling/error';
import { recipeRepository } from '../repositories/recipe.repo';
import { ingredientProductRepository } from '../repositories/ingredient_product.repo';
import { productPriceRepository } from '../repositories/product_price.repo';
import { ingredientUnitConversionRepository } from '../repositories/ingredient_unit_conversion.repo';
import { ingredientDensityRepository } from '../repositories/ingredient_density.repo';
import { getStoreLocationByIdService } from './store_location.service';
import {
  calculateRecipeCost,
  type PricingServiceLineInput,
} from './pricing_service.client';

export type RecipeCostLine = {
  recipeIngredientId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  productId: string | null;
  productName: string | null;
  source: string | null;
  priceRecordedAt: Date | null;
  cost: string | null;
  issue: 'missing_product' | 'missing_price' | 'missing_conversion' | null;
};

export const getRecipePricingService = async (
  userId: string,
  recipeId: string,
  storeLocationId: string,
) => {
  const recipe = await recipeRepository.findOne({
    where: { recipeId, userId },
    relations: { ingredients: { ingredient: true, unit: true } },
  });
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  await getStoreLocationByIdService(storeLocationId);

  const orderedLines = [...recipe.ingredients].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const requestLines: PricingServiceLineInput[] = [];
  const lineDetails = new Map<
    string,
    {
      ingredientName: string;
      quantity: string;
      unit: string;
      productNames: Map<string, string>;
    }
  >();

  for (const line of orderedLines) {
    const [candidates, conversions, density] = await Promise.all([
      ingredientProductRepository.find({
        where: { userId, ingredientId: line.ingredientId },
        relations: { packageUnit: true },
      }),
      ingredientUnitConversionRepository.find({
        where: { ingredientId: line.ingredientId },
      }),
      ingredientDensityRepository.findOneBy({
        userId,
        ingredientId: line.ingredientId,
      }),
    ]);

    const productNames = new Map<string, string>();
    const productCandidates = await Promise.all(
      candidates.map(async (product) => {
        productNames.set(product.productId, product.productName);
        const prices = await productPriceRepository.find({
          where: { productId: product.productId, storeLocationId },
          order: { recordedAt: 'DESC', priceId: 'DESC' },
          take: 1,
        });
        const price = prices[0];

        return {
          productId: product.productId,
          productName: product.productName,
          ingredientId: product.ingredientId,
          packageQuantity: product.packageQuantity,
          packageUnit: {
            unitId: product.packageUnit.unitId,
            unitType: product.packageUnit.unitType,
            conversionToBase: product.packageUnit.conversionToBase,
          },
          price: price
            ? {
                priceId: price.priceId,
                productId: price.productId,
                price: price.price,
                currencyCode: price.currencyCode.trim(),
                recordedAt: price.recordedAt.toISOString(),
                source: price.source,
              }
            : null,
        };
      }),
    );

    requestLines.push({
      recipeIngredientId: line.recipeIngredientId,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unit: {
        unitId: line.unit.unitId,
        unitType: line.unit.unitType,
        conversionToBase: line.unit.conversionToBase,
      },
      densityGramsPerMl: density?.densityGramsPerMl ?? null,
      candidates: productCandidates,
      conversions: conversions.map((conversion) => ({
        ingredientId: conversion.ingredientId,
        fromUnitId: conversion.fromUnitId,
        toUnitId: conversion.toUnitId,
        conversionFactor: conversion.conversionFactor,
      })),
    });

    lineDetails.set(line.recipeIngredientId, {
      ingredientName: line.ingredient.name,
      quantity: line.quantity,
      unit: line.unit.abbreviation,
      productNames,
    });
  }

  const calculated = await calculateRecipeCost(requestLines, recipe.servings);
  const calculatedLines = new Map(
    calculated.lines.map((line) => [line.recipeIngredientId, line]),
  );
  const lines: RecipeCostLine[] = orderedLines.map((recipeLine) => {
    const result = calculatedLines.get(recipeLine.recipeIngredientId);
    const details = lineDetails.get(recipeLine.recipeIngredientId)!;
    return {
      recipeIngredientId: recipeLine.recipeIngredientId,
      ingredientId: recipeLine.ingredientId,
      ingredientName: details.ingredientName,
      quantity: details.quantity,
      unit: details.unit,
      productId: result?.productId ?? null,
      productName: result?.productId
        ? (details.productNames.get(result.productId) ?? null)
        : null,
      source: result?.source ?? null,
      priceRecordedAt: result?.priceRecordedAt
        ? new Date(result.priceRecordedAt)
        : null,
      cost: result?.cost ?? null,
      issue: result?.issue ?? 'missing_conversion',
    };
  });

  return {
    recipeId,
    storeLocationId,
    servings: recipe.servings,
    lines,
    knownSubtotal: calculated.knownSubtotal,
    totalCost: calculated.totalCost,
    costPerServing: calculated.costPerServing,
    currencyCode: calculated.currencyCode,
    isComplete: calculated.isComplete,
  };
};
