import * as z from 'zod';
import { HttpError } from '../middleware/errorHandling/error';
import { logger } from '../middleware/logging.middleware';

const foodSearchResponseSchema = z.object({
  foods: z.array(
    z.object({
      fdcId: z.number().int().positive(),
      dataType: z.string(),
      description: z.string(),
      brandOwner: z.string().nullable().optional(),
    }),
  ),
});

const densitySuggestionsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      fdcId: z.number().int().positive(),
      dataType: z.string(),
      foodDescription: z.string(),
      portionId: z.number().int().positive(),
      portionAmount: z.string(),
      portionDescription: z.string(),
      measureUnit: z.string(),
      gramWeight: z.string(),
      densityGramsPerMl: z.string(),
    }),
  ),
});

const pricingResponseSchema = z.object({
  knownSubtotal: z.string(),
  totalCost: z.string().nullable(),
  costPerServing: z.string().nullable(),
  currencyCode: z.string().nullable(),
  isComplete: z.boolean(),
  lines: z.array(
    z.object({
      recipeIngredientId: z.string(),
      ingredientId: z.string(),
      productId: z.string().nullable(),
      priceId: z.string().nullable(),
      cost: z.string().nullable(),
      currencyCode: z.string().nullable(),
      priceRecordedAt: z.string().nullable(),
      source: z.string().nullable(),
      issue: z
        .enum(['missing_product', 'missing_price', 'missing_conversion'])
        .nullable(),
    }),
  ),
});

export type PricingServiceLineInput = {
  recipeIngredientId: string;
  ingredientId: string;
  quantity: string;
  unit: { unitId: number; unitType: string; conversionToBase: string };
  densityGramsPerMl: string | null;
  candidates: {
    productId: string;
    productName: string;
    ingredientId: string;
    packageQuantity: string;
    packageUnit: { unitId: number; unitType: string; conversionToBase: string };
    price: {
      priceId: string;
      productId: string;
      price: string;
      currencyCode: string;
      recordedAt: string;
      source: string;
    } | null;
  }[];
  conversions: {
    ingredientId: string;
    fromUnitId: number;
    toUnitId: number;
    conversionFactor: string;
  }[];
};

export type PricingServiceResponse = z.infer<typeof pricingResponseSchema>;

const requestPricingService = async <T>(
  path: string,
  stage: string,
  parse: (value: unknown) => T,
  init: Parameters<typeof globalThis.fetch>[1],
  fetcher: typeof globalThis.fetch,
): Promise<T> => {
  const serviceUrl = process.env.PRICING_SERVICE_URL?.replace(/\/$/, '');
  const serviceToken = process.env.PRICING_SERVICE_TOKEN;
  if (!serviceUrl || !serviceToken) {
    throw new HttpError(503, 'Pricing service is not configured.');
  }

  let response: Awaited<ReturnType<typeof globalThis.fetch>>;
  try {
    response = await fetcher(`${serviceUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${serviceToken}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: globalThis.AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch (error) {
    logger.error(
      {
        stage,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Pricing service request failed',
    );
    throw new HttpError(503, 'Pricing service is unavailable right now.');
  }

  if (!response.ok) {
    logger.error(
      { stage, statusCode: response.status },
      'Pricing service request failed',
    );
    throw new HttpError(
      response.status,
      'Unable to complete the pricing request right now.',
    );
  }

  try {
    return parse(await response.json());
  } catch (error) {
    logger.error(
      {
        stage,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Pricing service returned an invalid response',
    );
    throw new HttpError(502, 'Pricing service returned an invalid response.');
  }
};

export const searchUsdaFoods = (
  query: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
) =>
  requestPricingService(
    '/v1/usda/foods/search',
    'USDA food search',
    (value) => foodSearchResponseSchema.parse(value).foods,
    { method: 'POST', body: JSON.stringify({ query }) },
    fetcher,
  );

export const getUsdaDensitySuggestions = (
  fdcId: number,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
) =>
  requestPricingService(
    `/v1/usda/foods/${fdcId}/density-suggestions`,
    'USDA density suggestions',
    (value) => densitySuggestionsResponseSchema.parse(value).suggestions,
    { method: 'GET' },
    fetcher,
  );

export const calculateRecipeCost = (
  lines: PricingServiceLineInput[],
  servings: number,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
) =>
  requestPricingService(
    '/v1/pricing/calculate',
    'recipe cost calculation',
    (value) => pricingResponseSchema.parse(value),
    { method: 'POST', body: JSON.stringify({ lines, servings }) },
    fetcher,
  );
