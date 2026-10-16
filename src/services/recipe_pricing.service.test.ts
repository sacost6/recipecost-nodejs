import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import { getRecipePricingService } from './recipe_pricing.service';

const recipeRepository = vi.hoisted(() => ({ findOne: vi.fn() }));
const ingredientProductRepository = vi.hoisted(() => ({ find: vi.fn() }));
const productPriceRepository = vi.hoisted(() => ({ find: vi.fn() }));
const conversionRepository = vi.hoisted(() => ({ find: vi.fn() }));
const storeLookup = vi.hoisted(() => vi.fn());

vi.mock('../repositories/recipe.repo', () => ({ recipeRepository }));
vi.mock('../repositories/ingredient_product.repo', () => ({
  ingredientProductRepository,
}));
vi.mock('../repositories/product_price.repo', () => ({
  productPriceRepository,
}));
vi.mock('../repositories/ingredient_unit_conversion.repo', () => ({
  ingredientUnitConversionRepository: conversionRepository,
}));
vi.mock('./store_location.service', () => ({
  getStoreLocationByIdService: storeLookup,
}));

const userId = '1001';
const recipeId = '2001';
const storeLocationId = '3001';
const recordedAt = new Date('2026-09-01T12:00:00Z');
const unit = {
  unitId: 1,
  abbreviation: 'g',
  unitType: 'weight',
  conversionToBase: '1',
};
const line = {
  recipeIngredientId: '4001',
  recipeId,
  ingredientId: '5001',
  quantity: '500.0000',
  unitId: 1,
  sortOrder: 0,
  ingredient: { ingredientId: '5001', name: 'Flour' },
  unit,
};
const recipe = { recipeId, userId, servings: 4, ingredients: [line] };
const firstProduct = {
  productId: '6001',
  userId,
  ingredientId: '5001',
  productName: 'Two kilogram bag',
  packageQuantity: '2',
  packageUnitId: 2,
  packageUnit: {
    unitId: 2,
    abbreviation: 'kg',
    unitType: 'weight',
    conversionToBase: '1000',
  },
};
const secondProduct = {
  ...firstProduct,
  productId: '6002',
  productName: 'One kilogram bag',
  packageQuantity: '1',
  packageUnit: { ...firstProduct.packageUnit, conversionToBase: '1000' },
};
const firstPrice = {
  priceId: '7001',
  productId: firstProduct.productId,
  storeLocationId,
  price: '8.00',
  source: 'kroger',
  recordedAt,
};

beforeEach(() => {
  vi.resetAllMocks();
  recipeRepository.findOne.mockResolvedValue(recipe);
  ingredientProductRepository.find.mockResolvedValue([
    firstProduct,
    secondProduct,
  ]);
  productPriceRepository.find.mockImplementation(({ where }) =>
    Promise.resolve(
      where.productId === firstProduct.productId
        ? [firstPrice]
        : [
            {
              ...firstPrice,
              priceId: '7002',
              productId: secondProduct.productId,
              price: '5.00',
              source: 'manual',
            },
          ],
    ),
  );
  conversionRepository.find.mockResolvedValue([]);
  storeLookup.mockResolvedValue({ storeLocationId });
});

describe('recipe pricing', () => {
  it('uses the latest available product prices, normalizes same-type units, and selects the lowest line cost', async () => {
    await expect(
      getRecipePricingService(userId, recipeId, storeLocationId),
    ).resolves.toEqual({
      recipeId,
      storeLocationId,
      servings: 4,
      lines: [
        {
          recipeIngredientId: line.recipeIngredientId,
          ingredientId: line.ingredientId,
          ingredientName: 'Flour',
          quantity: '500.0000',
          unit: 'g',
          productId: firstProduct.productId,
          productName: firstProduct.productName,
          source: 'kroger',
          priceRecordedAt: recordedAt,
          cost: '2.00',
          issue: null,
        },
      ],
      knownSubtotal: '2.00',
      totalCost: '2.00',
      costPerServing: '0.50',
      isComplete: true,
    });
    expect(recipeRepository.findOne).toHaveBeenCalledExactlyOnceWith({
      where: { recipeId, userId },
      relations: { ingredients: { ingredient: true, unit: true } },
    });
    expect(ingredientProductRepository.find).toHaveBeenCalledExactlyOnceWith({
      where: { userId, ingredientId: line.ingredientId },
      relations: { packageUnit: true },
    });
    expect(productPriceRepository.find).toHaveBeenCalledWith({
      where: { productId: firstProduct.productId, storeLocationId },
      order: { recordedAt: 'DESC', priceId: 'DESC' },
      take: 1,
    });
  });

  it('uses ingredient-specific conversions for cross-type units', async () => {
    recipeRepository.findOne.mockResolvedValue({
      ...recipe,
      ingredients: [
        {
          ...line,
          quantity: '2.0000',
          unitId: 3,
          unit: {
            unitId: 3,
            abbreviation: 'cup',
            unitType: 'volume',
            conversionToBase: '236.588',
          },
        },
      ],
    });
    ingredientProductRepository.find.mockResolvedValue([
      {
        ...firstProduct,
        productName: 'One kilogram bag',
        packageQuantity: '1000',
      },
    ]);
    productPriceRepository.find.mockResolvedValue([
      { ...firstPrice, price: '10.00' },
    ]);
    conversionRepository.find.mockResolvedValue([
      {
        ingredientId: line.ingredientId,
        fromUnitId: 3,
        toUnitId: 2,
        conversionFactor: '240',
      },
    ]);

    const result = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(result.lines[0]).toMatchObject({ cost: '4.80', issue: null });
  });

  it('reports missing prices and conversions without claiming a complete total', async () => {
    ingredientProductRepository.find.mockResolvedValue([
      {
        ...firstProduct,
        packageUnit: { ...firstProduct.packageUnit, unitType: 'volume' },
      },
    ]);
    productPriceRepository.find.mockResolvedValue([{ ...firstPrice }]);
    const result = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(result).toMatchObject({
      knownSubtotal: '0.00',
      totalCost: null,
      costPerServing: null,
      isComplete: false,
      lines: [{ cost: null, issue: 'missing_conversion' }],
    });

    productPriceRepository.find.mockResolvedValue([]);
    const missingPrice = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(missingPrice.lines[0].issue).toBe('missing_price');
  });

  it('marks ingredients without linked products and returns only a known subtotal', async () => {
    recipeRepository.findOne.mockResolvedValue({
      ...recipe,
      ingredients: [
        line,
        {
          ...line,
          recipeIngredientId: '4002',
          ingredientId: '5002',
          ingredient: { name: 'Salt' },
        },
      ],
    });
    ingredientProductRepository.find.mockImplementation(({ where }) =>
      Promise.resolve(where.ingredientId === '5001' ? [firstProduct] : []),
    );
    productPriceRepository.find.mockResolvedValue([firstPrice]);

    const result = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(result).toMatchObject({
      knownSubtotal: '2.00',
      totalCost: null,
      isComplete: false,
      lines: [
        { cost: '2.00', issue: null },
        { ingredientName: 'Salt', cost: null, issue: 'missing_product' },
      ],
    });
  });

  it('returns 404 and does not look up a store for a recipe the caller does not own', async () => {
    recipeRepository.findOne.mockResolvedValue(null);
    await expect(
      getRecipePricingService(userId, recipeId, storeLocationId),
    ).rejects.toEqual(new HttpError(404, 'Recipe not found'));
    expect(storeLookup).not.toHaveBeenCalled();
  });
});
