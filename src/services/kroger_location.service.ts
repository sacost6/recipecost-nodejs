import * as z from 'zod';
import { HttpError } from '../middleware/errorHandling/error';
import { getKrogerAccessToken } from './kroger_api.service';
import type { KrogerLocationSearchQuery } from '../schemas/kroger_location.schema';

const krogerLocationsPayloadSchema = z.object({
  data: z.array(
    z.object({
      locationId: z.string().trim().min(1),
      name: z.string().trim().min(1),
      chain: z.string().trim().min(1),
      storeNumber: z.string().trim().nullable().optional(),
      address: z.object({
        addressLine1: z.string().trim().min(1),
        addressLine2: z.string().trim().nullable().optional(),
        city: z.string().trim().min(1),
        state: z.string().trim().length(2),
        zipCode: z.string().trim().nullable().optional(),
      }),
    }),
  ),
});

export type KrogerLocation = {
  locationId: string;
  name: string;
  chain: string;
  storeNumber: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateCode: string;
  postalCode: string | null;
};

const apiBaseUrl = (
  process.env.KROGER_API_BASE_URL ?? 'https://api.kroger.com'
).replace(/\/$/, '');
const tokenUrl =
  process.env.KROGER_TOKEN_URL ?? `${apiBaseUrl}/v1/connect/oauth2/token`;

export const searchKrogerLocations = async (
  query: KrogerLocationSearchQuery,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): Promise<KrogerLocation[]> => {
  const { KROGER_CLIENT_ID: clientId, KROGER_CLIENT_SECRET: clientSecret } =
    process.env;
  if (!clientId || !clientSecret) {
    throw new HttpError(503, 'Kroger API credentials are not configured.');
  }

  try {
    const token = await getKrogerAccessToken(
      { clientId, clientSecret, tokenUrl },
      fetcher,
    );
    const url = new globalThis.URL(`${apiBaseUrl}/v1/locations`);
    url.searchParams.set('filter.zipCode.near', query.zipCode);
    url.searchParams.set('filter.radiusInMiles', String(query.radiusInMiles));
    url.searchParams.set('filter.limit', '200');
    // Omitting filter.chain lets Kroger return all of its owned banners.

    const response = await fetcher(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Kroger location request failed (${response.status})`);
    }

    const payload = krogerLocationsPayloadSchema.parse(await response.json());
    return payload.data.map((location) => ({
      locationId: location.locationId,
      name: location.name,
      chain: location.chain,
      storeNumber: location.storeNumber || null,
      addressLine1: location.address.addressLine1,
      addressLine2: location.address.addressLine2 || null,
      city: location.address.city,
      stateCode: location.address.state,
      postalCode: location.address.zipCode || null,
    }));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'Unable to search Kroger locations right now.');
  }
};
