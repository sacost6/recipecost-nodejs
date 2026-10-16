import { Buffer } from 'node:buffer';

type KrogerAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  tokenUrl: string;
};

export const getKrogerAccessToken = async (
  config: KrogerAuthConfig,
  fetcher: typeof globalThis.fetch,
  scope?: string,
): Promise<string> => {
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Kroger client credentials are not configured');
  }

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString('base64');
  const body = new globalThis.URLSearchParams({
    grant_type: 'client_credentials',
  });
  if (scope) body.set('scope', scope);

  const response = await fetcher(config.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Kroger token request failed (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Kroger token response did not contain an access token');
  }

  return payload.access_token;
};
