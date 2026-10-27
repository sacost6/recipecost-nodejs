import * as z from 'zod';
import { HttpError } from '../middleware/errorHandling/error';
import { logger } from '../middleware/logging.middleware';
import type { KrogerLocationSearchQuery } from '../schemas/kroger_location.schema';
import {
  krogerProductSuggestionSchema,
  type KrogerProductSearchQuery,
  type KrogerProductSuggestion,
} from '../schemas/kroger_product.schema';

const locationSchema = z.object({
  locationId: z.string(),
  name: z.string(),
  chain: z.string(),
  storeNumber: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  stateCode: z.string(),
  postalCode: z.string().nullable(),
});

const serviceEnvelopeSchema = z.object({
  status: z.literal('success'),
  data: z.unknown(),
});

export type KrogerLocation = z.infer<typeof locationSchema>;

const requestKrogerService = async <T>(
  path: string,
  stage: string,
  fetcher: typeof globalThis.fetch,
): Promise<T> => {
  const serviceUrl = process.env.KROGER_SERVICE_URL?.replace(/\/$/, '');
  const serviceToken = process.env.KROGER_SERVICE_TOKEN;
  if (!serviceUrl || !serviceToken) {
    throw new HttpError(503, 'Kroger service is not configured.');
  }

  let response: globalThis.Response;
  try {
    response = await fetcher(`${serviceUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        Accept: 'application/json',
      },
      signal: globalThis.AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
  } catch (error) {
    logger.error(
      {
        stage,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Kroger service request failed',
    );
    throw new HttpError(503, 'Kroger service is unavailable right now.');
  }

  if (!response.ok) {
    logger.error(
      { stage, statusCode: response.status },
      'Kroger service request failed',
    );
    if (response.status === 503) {
      throw new HttpError(503, 'Kroger API credentials are not configured.');
    }
    throw new HttpError(
      502,
      'Unable to complete the Kroger request right now.',
    );
  }

  try {
    const envelope = serviceEnvelopeSchema.parse(await response.json());
    return envelope.data as T;
  } catch (error) {
    logger.error(
      {
        stage,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Kroger service returned an invalid response',
    );
    throw new HttpError(502, 'Kroger service returned an invalid response.');
  }
};

export const searchKrogerLocations = async (
  query: KrogerLocationSearchQuery,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): Promise<KrogerLocation[]> => {
  const params = new globalThis.URLSearchParams({
    zipCode: query.zipCode,
    radiusInMiles: String(query.radiusInMiles),
  });
  const data = await requestKrogerService<unknown>(
    `/v1/locations?${params.toString()}`,
    'location search',
    fetcher,
  );
  try {
    return z.array(locationSchema).parse(data);
  } catch (error) {
    logger.error(
      {
        stage: 'location search response parsing',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Kroger service returned an invalid response',
    );
    throw new HttpError(502, 'Kroger service returned an invalid response.');
  }
};

export const getKrogerProduct = async (
  upc: string,
  locationId: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): Promise<unknown> => {
  const params = new globalThis.URLSearchParams({ locationId });
  return requestKrogerService(
    `/v1/products/${encodeURIComponent(upc)}?${params.toString()}`,
    'product lookup',
    fetcher,
  );
};

export const searchKrogerProducts = async (
  query: KrogerProductSearchQuery,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): Promise<KrogerProductSuggestion[]> => {
  const params = new globalThis.URLSearchParams({
    term: query.term,
    locationId: query.locationId,
  });
  const data = await requestKrogerService<unknown>(
    `/v1/products/search?${params.toString()}`,
    'product search',
    fetcher,
  );
  try {
    return z.array(krogerProductSuggestionSchema).parse(data);
  } catch (error) {
    logger.error(
      {
        stage: 'product search response parsing',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Kroger service returned an invalid response',
    );
    throw new HttpError(502, 'Kroger service returned an invalid response.');
  }
};
