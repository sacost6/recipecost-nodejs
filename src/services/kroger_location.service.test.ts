import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../middleware/errorHandling/error';
import { getKrogerProduct } from './kroger_service.client';
import { searchKrogerLocations } from './kroger_location.service';

const jsonResponse = (body: unknown, status = 200) =>
  new globalThis.Response(JSON.stringify(body), { status });

const query = { zipCode: '45044', radiusInMiles: 25 };
const location = {
  locationId: '01400390',
  name: 'Kroger Marketplace',
  chain: 'KROGER',
  storeNumber: '00390',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Maineville',
  stateCode: 'OH',
  postalCode: '45039',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Kroger service client', () => {
  it('calls the internal Kroger service and returns its location data', async () => {
    vi.stubEnv('KROGER_SERVICE_URL', 'http://kroger-service:3001');
    vi.stubEnv('KROGER_SERVICE_TOKEN', 'internal-token');
    const fetcher = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(jsonResponse({ status: 'success', data: [location] }));

    await expect(searchKrogerLocations(query, fetcher)).resolves.toEqual([
      location,
    ]);

    const [requestUrl, requestOptions] = fetcher.mock.calls[0];
    const url = new globalThis.URL(String(requestUrl));
    expect(url.origin).toBe('http://kroger-service:3001');
    expect(url.pathname).toBe('/v1/locations');
    expect(url.searchParams.get('zipCode')).toBe('45044');
    expect(url.searchParams.get('radiusInMiles')).toBe('25');
    expect(requestOptions?.headers).toMatchObject({
      Authorization: 'Bearer internal-token',
      Accept: 'application/json',
    });
    expect(requestOptions?.cache).toBe('no-store');
  });

  it('reports missing internal service configuration without making a request', async () => {
    vi.stubEnv('KROGER_SERVICE_URL', '');
    vi.stubEnv('KROGER_SERVICE_TOKEN', '');
    const fetcher = vi.fn<typeof globalThis.fetch>();

    await expect(searchKrogerLocations(query, fetcher)).rejects.toMatchObject({
      statusCode: 503,
      message: 'Kroger service is not configured.',
    } satisfies Partial<HttpError>);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps internal service failures to a safe gateway error', async () => {
    vi.stubEnv('KROGER_SERVICE_URL', 'http://kroger-service:3001');
    vi.stubEnv('KROGER_SERVICE_TOKEN', 'internal-token');
    const fetcher = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        jsonResponse(
          { status: 'error', message: 'secret provider detail' },
          502,
        ),
      );

    await expect(searchKrogerLocations(query, fetcher)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Unable to complete the Kroger request right now.',
    });
  });

  it('proxies a product lookup and returns the product payload unchanged', async () => {
    vi.stubEnv('KROGER_SERVICE_URL', 'http://kroger-service:3001');
    vi.stubEnv('KROGER_SERVICE_TOKEN', 'internal-token');
    const productPayload = {
      data: [{ upc: '0001234567890', price: { regular: 4.99 } }],
    };
    const fetcher = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        jsonResponse({ status: 'success', data: productPayload }),
      );

    await expect(
      getKrogerProduct('0001234567890', '01400390', fetcher),
    ).resolves.toEqual(productPayload);

    const [requestUrl, requestOptions] = fetcher.mock.calls[0];
    const url = new globalThis.URL(String(requestUrl));
    expect(url.pathname).toBe('/v1/products/0001234567890');
    expect(url.searchParams.get('locationId')).toBe('01400390');
    expect(requestOptions?.headers).toMatchObject({
      Authorization: 'Bearer internal-token',
      Accept: 'application/json',
    });
    expect(requestOptions?.cache).toBe('no-store');
  });
});
