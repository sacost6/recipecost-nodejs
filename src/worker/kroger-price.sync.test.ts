import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncKrogerPricesOnce, type WorkerDatabase } from './kroger-price.sync';

const targets = [
  {
    product_id: '11',
    upc: '0001234567890',
    store_location_id: '21',
    kroger_location_id: '12345',
  },
  {
    product_id: '12',
    upc: '0009876543210',
    store_location_id: '21',
    kroger_location_id: '12345',
  },
];
const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  apiBaseUrl: 'https://api.kroger.test',
  tokenUrl: 'https://api.kroger.test/token',
  maxItems: 50,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const createDatabase = (
  latestPrices: Record<string, string | undefined> = {},
) => {
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT p.product_id')) {
      return { rows: targets, rowCount: targets.length };
    }
    if (sql.includes('SELECT price FROM product_prices')) {
      const productId = String(values[0]);
      const price = latestPrices[productId];
      return { rows: price ? [{ price }] : [], rowCount: price ? 1 : 0 };
    }
    return { rows: [], rowCount: 1 };
  });
  return { database: { query } as unknown as WorkerDatabase, query };
};

beforeEach(() => vi.restoreAllMocks());

describe('Kroger price sync', () => {
  it('stays idle without credentials and does not query the database or API', async () => {
    const { database, query } = createDatabase();
    const fetcher = vi.fn();

    await expect(
      syncKrogerPricesOnce(
        database,
        { ...config, clientId: undefined },
        fetcher,
      ),
    ).resolves.toEqual({ enabled: false, checked: 0, recorded: 0 });
    expect(query).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requests local product prices and records promotional or regular prices as Kroger observations', async () => {
    const { database, query } = createDatabase();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { items: [{ price: { regular: 2.99, promo: 2.49 } }] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: { items: [{ price: { regular: 3.79, promo: null } }] },
        }),
      );

    await expect(
      syncKrogerPricesOnce(database, config, fetcher),
    ).resolves.toEqual({
      enabled: true,
      checked: 2,
      recorded: 2,
    });

    expect(query.mock.calls[0][0]).not.toContain('JOIN retailers');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toBe(config.tokenUrl);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
      },
    });
    expect(String(fetcher.mock.calls[1][0])).toBe(
      'https://api.kroger.test/v1/products/0001234567890?filter.locationId=12345',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO product_prices'),
      ['11', '21', '2.49'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO product_prices'),
      ['12', '21', '3.79'],
    );
  });

  it('does not insert an unchanged price and ignores unavailable local products', async () => {
    const { database, query } = createDatabase({ '11': '2.49' });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { items: [{ price: { regular: 2.99, promo: 2.49 } }] },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { items: [] } }));

    await expect(
      syncKrogerPricesOnce(database, config, fetcher),
    ).resolves.toEqual({
      enabled: true,
      checked: 2,
      recorded: 0,
    });
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO')),
    ).toHaveLength(0);
  });

  it('continues checking other products when one Kroger product request fails', async () => {
    const { database, query } = createDatabase();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [{ price: { regular: 3.79 } }] } }),
      );

    await expect(
      syncKrogerPricesOnce(database, config, fetcher),
    ).resolves.toEqual({
      enabled: true,
      checked: 2,
      recorded: 1,
    });
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO product_prices'),
      ['12', '21', '3.79'],
    );
  });
});
