import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import { searchKrogerLocations } from './kroger_location.service';

const jsonResponse = (body: unknown, status = 200) =>
  new globalThis.Response(JSON.stringify(body), { status });

const query = { zipCode: '45044', radiusInMiles: 25 };
const location = {
  locationId: '01400390',
  name: 'Kroger Marketplace',
  chain: 'KROGER',
  storeNumber: '00390',
  address: {
    addressLine1: '123 Main St',
    addressLine2: '',
    city: 'Maineville',
    state: 'OH',
    zipCode: '45039',
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Kroger location search', () => {
  it('requests nearby locations and normalizes store address data', async () => {
    vi.stubEnv('KROGER_CLIENT_ID', 'client-id');
    vi.stubEnv('KROGER_CLIENT_SECRET', 'client-secret');
    const fetcher = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token' }))
      .mockResolvedValueOnce(jsonResponse({ data: [location] }));

    await expect(searchKrogerLocations(query, fetcher)).resolves.toEqual([
      {
        locationId: '01400390',
        name: 'Kroger Marketplace',
        chain: 'KROGER',
        storeNumber: '00390',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Maineville',
        stateCode: 'OH',
        postalCode: '45039',
      },
    ]);

    const requestUrl = new globalThis.URL(String(fetcher.mock.calls[1][0]));
    expect(requestUrl.origin).toBe('https://api.kroger.com');
    expect(requestUrl.pathname).toBe('/v1/locations');
    expect(requestUrl.searchParams.get('filter.zipCode.near')).toBe('45044');
    expect(requestUrl.searchParams.get('filter.radiusInMiles')).toBe('25');
    expect(requestUrl.searchParams.get('filter.limit')).toBe('200');
    expect(requestUrl.searchParams.has('filter.chain')).toBe(false);
    expect(fetcher.mock.calls[0][1]?.body).toEqual(
      new globalThis.URLSearchParams({ grant_type: 'client_credentials' }),
    );
  });

  it('reports missing credentials without calling Kroger', async () => {
    vi.stubEnv('KROGER_CLIENT_ID', '');
    vi.stubEnv('KROGER_CLIENT_SECRET', '');
    const fetcher = vi.fn<typeof globalThis.fetch>();

    await expect(searchKrogerLocations(query, fetcher)).rejects.toMatchObject({
      statusCode: 503,
      message: 'Kroger API credentials are not configured.',
    } satisfies Partial<HttpError>);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('surfaces upstream failures as a gateway error', async () => {
    vi.stubEnv('KROGER_CLIENT_ID', 'client-id');
    vi.stubEnv('KROGER_CLIENT_SECRET', 'client-secret');
    const fetcher = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token' }))
      .mockResolvedValueOnce(jsonResponse({}, 429));

    await expect(searchKrogerLocations(query, fetcher)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Unable to search Kroger locations right now.',
    });
  });
});
