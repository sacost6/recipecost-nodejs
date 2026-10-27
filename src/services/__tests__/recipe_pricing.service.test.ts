import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../middleware/errorHandling/error';
import { getRecipePricingService } from '../recipe_pricing.service';

const recipeRepository = vi.hoisted(() => ({ findOne: vi.fn() }));
const ingredientProductRepository = vi.hoisted(() => ({ find: vi.fn() }));
const productPriceRepository = vi.hoisted(() => ({ find: vi.fn() }));
const conversionRepository = vi.hoisted(() => ({ find: vi.fn() }));
const densityRepository = vi.hoisted(() => ({ findOneBy: vi.fn() }));
const pricingClient = vi.hoisted(() => ({ calculateRecipeCost: vi.fn() }));
const storeLookup = vi.hoisted(() => vi.fn());

vi.mock('../../repositories/recipe.repo', () => ({ recipeRepository }));
vi.mock('../../repositories/ingredient_product.repo', () => ({
  ingredientProductRepository,
}));
vi.mock('../../repositories/product_price.repo', () => ({
  productPriceRepository,
}));
vi.mock('../../repositories/ingredient_unit_conversion.repo', () => ({
  ingredientUnitConversionRepository: conversionRepository,
}));
vi.mock('../../repositories/ingredient_density.repo', () => ({
  ingredientDensityRepository: densityRepository,
}));
vi.mock('../pricing_service.client', () => pricingClient);
vi.mock('../store_location.service', () => ({
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
  currencyCode: 'USD',
  source: 'kroger',
  recordedAt,
};
const calculation = {
  knownSubtotal: '2.00',
  totalCost: '2.00',
  costPerServing: '0.50',
  currencyCode: 'USD',
  isComplete: true,
  lines: [
    {
      recipeIngredientId: line.recipeIngredientId,
      ingredientId: line.ingredientId,
      productId: firstProduct.productId,
      priceId: firstPrice.priceId,
      cost: '2.00',
      currencyCode: 'USD',
      priceRecordedAt: recordedAt.toISOString(),
      source: 'kroger',
      issue: null,
    },
  ],
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
  densityRepository.findOneBy.mockResolvedValue(null);
  pricingClient.calculateRecipeCost.mockResolvedValue(calculation);
  storeLookup.mockResolvedValue({ storeLocationId });
});

describe('recipe pricing', () => {
  it('loads local pricing data and maps the pricing service result to recipe lines', async () => {
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
      currencyCode: 'USD',
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
    expect(pricingClient.calculateRecipeCost).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          recipeIngredientId: line.recipeIngredientId,
          quantity: line.quantity,
          densityGramsPerMl: null,
          candidates: expect.arrayContaining([
            expect.objectContaining({
              productId: firstProduct.productId,
              price: expect.objectContaining({
                priceId: firstPrice.priceId,
                currencyCode: 'USD',
                source: 'kroger',
              }),
            }),
            expect.objectContaining({
              productId: secondProduct.productId,
              price: expect.objectContaining({
                priceId: '7002',
                price: '5.00',
                source: 'manual',
              }),
            }),
          ]),
          conversions: [],
        }),
      ],
      4,
    );
  });

  it('forwards ingredient density and unit conversions to the pricing service', async () => {
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
    densityRepository.findOneBy.mockResolvedValue({
      densityGramsPerMl: '0.91',
    });

    const result = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(result.lines[0]).toMatchObject({ cost: '2.00', issue: null });
    expect(pricingClient.calculateRecipeCost).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          quantity: '2.0000',
          unit: {
            unitId: 3,
            unitType: 'volume',
            conversionToBase: '236.588',
          },
          densityGramsPerMl: '0.91',
          conversions: [
            {
              ingredientId: line.ingredientId,
              fromUnitId: 3,
              toUnitId: 2,
              conversionFactor: '240',
            },
          ],
        }),
      ],
      4,
    );
  });

  it('maps missing price and conversion issues without claiming a complete total', async () => {
    ingredientProductRepository.find.mockResolvedValue([
      {
        ...firstProduct,
        packageUnit: { ...firstProduct.packageUnit, unitType: 'volume' },
      },
    ]);
    productPriceRepository.find.mockResolvedValue([{ ...firstPrice }]);
    pricingClient.calculateRecipeCost.mockResolvedValueOnce({
      knownSubtotal: '0.00',
      totalCost: null,
      costPerServing: null,
      currencyCode: 'USD',
      isComplete: false,
      lines: [
        {
          recipeIngredientId: line.recipeIngredientId,
          ingredientId: line.ingredientId,
          productId: firstProduct.productId,
          priceId: firstPrice.priceId,
          cost: null,
          currencyCode: 'USD',
          priceRecordedAt: null,
          source: 'kroger',
          issue: 'missing_conversion',
        },
      ],
    });
    const result = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(result).toMatchObject({
      knownSubtotal: '0.00',
      totalCost: null,
      costPerServing: null,
      currencyCode: 'USD',
      isComplete: false,
      lines: [{ cost: null, issue: 'missing_conversion' }],
    });

    productPriceRepository.find.mockResolvedValue([]);
    pricingClient.calculateRecipeCost.mockResolvedValueOnce({
      knownSubtotal: '0.00',
      totalCost: null,
      costPerServing: null,
      currencyCode: null,
      isComplete: false,
      lines: [
        {
          recipeIngredientId: line.recipeIngredientId,
          ingredientId: line.ingredientId,
          productId: firstProduct.productId,
          priceId: null,
          cost: null,
          currencyCode: null,
          priceRecordedAt: null,
          source: null,
          issue: 'missing_price',
        },
      ],
    });
    const missingPrice = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(missingPrice.lines[0].issue).toBe('missing_price');
  });

  it('marks ingredients without linked products and returns only a known subtotal', async () => {
    const saltLine = {
      ...line,
      recipeIngredientId: '4002',
      ingredientId: '5002',
      ingredient: { name: 'Salt' },
    };
    recipeRepository.findOne.mockResolvedValue({
      ...recipe,
      ingredients: [line, saltLine],
    });
    ingredientProductRepository.find.mockImplementation(({ where }) =>
      Promise.resolve(where.ingredientId === '5001' ? [firstProduct] : []),
    );
    productPriceRepository.find.mockResolvedValue([firstPrice]);
    pricingClient.calculateRecipeCost.mockResolvedValueOnce({
      knownSubtotal: '2.00',
      totalCost: null,
      costPerServing: null,
      currencyCode: 'USD',
      isComplete: false,
      lines: [
        {
          recipeIngredientId: line.recipeIngredientId,
          ingredientId: line.ingredientId,
          productId: firstProduct.productId,
          priceId: firstPrice.priceId,
          cost: '2.00',
          currencyCode: 'USD',
          priceRecordedAt: recordedAt.toISOString(),
          source: 'kroger',
          issue: null,
        },
        {
          recipeIngredientId: saltLine.recipeIngredientId,
          ingredientId: saltLine.ingredientId,
          productId: null,
          priceId: null,
          cost: null,
          currencyCode: null,
          priceRecordedAt: null,
          source: null,
          issue: 'missing_product',
        },
      ],
    });

    const result = await getRecipePricingService(
      userId,
      recipeId,
      storeLocationId,
    );
    expect(result).toMatchObject({
      knownSubtotal: '2.00',
      totalCost: null,
      currencyCode: 'USD',
      isComplete: false,
      lines: [
        {
          cost: '2.00',
          productName: firstProduct.productName,
          issue: null,
        },
        {
          ingredientName: 'Salt',
          productId: null,
          productName: null,
          cost: null,
          issue: 'missing_product',
        },
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
