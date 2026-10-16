import { HttpError } from '../middleware/errorHandling/error';
import { recipeRepository } from '../repositories/recipe.repo';
import { ingredientProductRepository } from '../repositories/ingredient_product.repo';
import { productPriceRepository } from '../repositories/product_price.repo';
import { ingredientUnitConversionRepository } from '../repositories/ingredient_unit_conversion.repo';
import { getStoreLocationByIdService } from './store_location.service';

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

const roundMoney = (value: number): string => value.toFixed(2);

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

  const lines: RecipeCostLine[] = [];
  let knownSubtotal = 0;
  for (const line of [...recipe.ingredients].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )) {
    const candidates = await ingredientProductRepository.find({
      where: { userId, ingredientId: line.ingredientId },
      relations: { packageUnit: true },
    });
    if (!candidates.length) {
      lines.push({
        recipeIngredientId: line.recipeIngredientId,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        quantity: line.quantity,
        unit: line.unit.abbreviation,
        productId: null,
        productName: null,
        source: null,
        priceRecordedAt: null,
        cost: null,
        issue: 'missing_product',
      });
      continue;
    }

    const conversions = await ingredientUnitConversionRepository.find({
      where: { ingredientId: line.ingredientId },
    });
    const priced: {
      product: (typeof candidates)[number];
      price: (typeof candidates)[number]['prices'][number];
      cost: number;
    }[] = [];
    let hasPrice = false;
    for (const product of candidates) {
      const prices = await productPriceRepository.find({
        where: { productId: product.productId, storeLocationId },
        order: { recordedAt: 'DESC', priceId: 'DESC' },
        take: 1,
      });
      const price = prices[0];
      if (!price) continue;
      hasPrice = true;

      let quantityInPackageUnit: number | undefined;
      if (line.unit.unitType === product.packageUnit.unitType) {
        quantityInPackageUnit =
          (Number(line.quantity) * Number(line.unit.conversionToBase)) /
          Number(product.packageUnit.conversionToBase);
      } else {
        const direct = conversions.find(
          (conversion) =>
            conversion.fromUnitId === line.unitId &&
            conversion.toUnitId === product.packageUnitId,
        );
        const reverse = conversions.find(
          (conversion) =>
            conversion.fromUnitId === product.packageUnitId &&
            conversion.toUnitId === line.unitId,
        );
        if (direct)
          quantityInPackageUnit =
            Number(line.quantity) * Number(direct.conversionFactor);
        else if (reverse)
          quantityInPackageUnit =
            Number(line.quantity) / Number(reverse.conversionFactor);
      }
      if (quantityInPackageUnit === undefined) continue;
      const cost =
        (Number(price.price) * quantityInPackageUnit) /
        Number(product.packageQuantity);
      priced.push({ product, price, cost });
    }

    const selected = priced.sort(
      (a, b) =>
        a.cost - b.cost ||
        b.price.recordedAt.getTime() - a.price.recordedAt.getTime(),
    )[0];
    const issue = selected
      ? null
      : hasPrice
        ? 'missing_conversion'
        : 'missing_price';
    if (selected) knownSubtotal += selected.cost;
    lines.push({
      recipeIngredientId: line.recipeIngredientId,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredient.name,
      quantity: line.quantity,
      unit: line.unit.abbreviation,
      productId: selected?.product.productId ?? null,
      productName: selected?.product.productName ?? null,
      source: selected?.price.source ?? null,
      priceRecordedAt: selected?.price.recordedAt ?? null,
      cost: selected ? roundMoney(selected.cost) : null,
      issue,
    });
  }

  const complete = lines.every((line) => line.cost !== null);
  return {
    recipeId,
    storeLocationId,
    servings: recipe.servings,
    lines,
    knownSubtotal: roundMoney(knownSubtotal),
    totalCost: complete ? roundMoney(knownSubtotal) : null,
    costPerServing: complete
      ? roundMoney(knownSubtotal / recipe.servings)
      : null,
    isComplete: complete,
  };
};
