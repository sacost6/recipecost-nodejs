type QueryResult<T> = { rows: T[]; rowCount: number | null };
export type WorkerDatabase = {
  query<T = Record<string, unknown>>(
    text: string,
    values?: Array<string | number | boolean | null>,
  ): Promise<QueryResult<T>>;
};

type SyncTarget = {
  product_id: string;
  upc: string;
  store_location_id: string;
  kroger_location_id: string;
};

type KrogerProduct = {
  items?: Array<{ price?: { regular?: number; promo?: number | null } }>;
};

type WorkerConfig = {
  clientId?: string;
  clientSecret?: string;
  apiBaseUrl: string;
  tokenUrl: string;
  maxItems: number;
};

import { getKrogerAccessToken } from '../services/kroger_api.service';

const fetchPrice = async (
  target: SyncTarget,
  token: string,
  config: WorkerConfig,
  fetcher: typeof globalThis.fetch,
): Promise<number | null> => {
  const url = new globalThis.URL(
    `${config.apiBaseUrl.replace(/\/$/, '')}/v1/products/${encodeURIComponent(target.upc)}`,
  );
  url.searchParams.set('filter.locationId', target.kroger_location_id);
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error(`Kroger product request failed (${response.status})`);
  const payload = (await response.json()) as { data?: KrogerProduct };
  const item = payload.data?.items?.[0];
  const price = item?.price?.promo ?? item?.price?.regular;
  return typeof price === 'number' && Number.isFinite(price) && price >= 0
    ? price
    : null;
};

export const syncKrogerPricesOnce = async (
  database: WorkerDatabase,
  config: WorkerConfig,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): Promise<{ enabled: boolean; checked: number; recorded: number }> => {
  if (!config.clientId || !config.clientSecret) {
    return { enabled: false, checked: 0, recorded: 0 };
  }
  const targets = await database.query<SyncTarget>(
    `
      SELECT p.product_id, p.upc, s.store_location_id, s.kroger_location_id
      FROM ingredient_products p
      JOIN store_locations s ON s.kroger_location_id IS NOT NULL
      LEFT JOIN LATERAL (
        SELECT price.recorded_at
        FROM product_prices price
        WHERE price.product_id = p.product_id AND price.store_location_id = s.store_location_id
        ORDER BY price.recorded_at DESC, price.price_id DESC
        LIMIT 1
      ) last_observation ON true
      WHERE p.kroger_sync_enabled = true AND p.upc IS NOT NULL
      ORDER BY last_observation.recorded_at ASC NULLS FIRST, p.product_id, s.store_location_id
      LIMIT $1
    `,
    [config.maxItems],
  );
  if (!targets.rows.length) return { enabled: true, checked: 0, recorded: 0 };

  const token = await getKrogerAccessToken(config, fetcher, 'product.compact');
  let recorded = 0;
  for (const target of targets.rows) {
    try {
      const price = await fetchPrice(target, token, config, fetcher);
      if (price === null) continue;
      const latest = await database.query<{ price: string }>(
        `SELECT price FROM product_prices WHERE product_id = $1 AND store_location_id = $2 ORDER BY recorded_at DESC, price_id DESC LIMIT 1`,
        [target.product_id, target.store_location_id],
      );
      if (latest.rows[0]?.price === price.toFixed(2)) continue;
      await database.query(
        `INSERT INTO product_prices (product_id, store_location_id, price, currency_code, source) VALUES ($1, $2, $3, 'USD', 'kroger')`,
        [target.product_id, target.store_location_id, price.toFixed(2)],
      );
      recorded++;
    } catch (error) {
      console.error(
        `Kroger price sync failed for product ${target.product_id}, store ${target.store_location_id}:`,
        error,
      );
    }
  }
  return { enabled: true, checked: targets.rows.length, recorded };
};
