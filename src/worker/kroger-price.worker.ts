import { Pool } from 'pg';
import { syncKrogerPricesOnce } from './kroger-price.sync';

const intervalMinutes = Number(
  process.env.KROGER_SYNC_INTERVAL_MINUTES ?? 1440,
);
const maxItems = Number(process.env.KROGER_SYNC_MAX_ITEMS ?? 1000);
const apiBaseUrl = (
  process.env.KROGER_API_BASE_URL ?? 'https://api.kroger.com'
).replace(/\/$/, '');
const tokenUrl =
  process.env.KROGER_TOKEN_URL ?? `${apiBaseUrl}/v1/connect/oauth2/token`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const config = {
  clientId: process.env.KROGER_CLIENT_ID,
  clientSecret: process.env.KROGER_CLIENT_SECRET,
  apiBaseUrl,
  tokenUrl,
  maxItems,
};

const start = async (): Promise<void> => {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 15) {
    throw new Error('KROGER_SYNC_INTERVAL_MINUTES must be at least 15');
  }
  if (!Number.isSafeInteger(maxItems) || maxItems < 1) {
    throw new Error('KROGER_SYNC_MAX_ITEMS must be a positive integer');
  }
  const run = async () => {
    try {
      const result = await syncKrogerPricesOnce(pool, config);
      if (!result.enabled) {
        console.info(
          'Kroger worker idle: configure KROGER_CLIENT_ID and KROGER_CLIENT_SECRET to enable sync.',
        );
      } else if (!result.checked) {
        console.info(
          'Kroger worker found no opted-in products at mapped Kroger stores.',
        );
      } else {
        console.info(
          `Kroger sync completed: ${result.checked} product/store pairs checked, ${result.recorded} new price observations recorded.`,
        );
      }
    } catch (error) {
      console.error('Kroger sync cycle failed:', error);
    }
  };
  await run();
  setInterval(() => void run(), intervalMinutes * 60_000);
};

void start().catch((error: unknown) => {
  console.error('Kroger worker failed to start:', error);
  process.exitCode = 1;
});

process.on('SIGTERM', () => void pool.end().then(() => process.exit(0)));
process.on('SIGINT', () => void pool.end().then(() => process.exit(0)));
