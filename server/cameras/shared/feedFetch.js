import { CCTV_SOURCE_FETCH_TIMEOUT_MS, PROXY_USER_AGENT } from './upstream.js';

/** GET a URL as text (or bytes with `binary`), throwing on any non-2xx status. */
export async function getText(url, { binary = false } = {}) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': PROXY_USER_AGENT, Accept: '*/*' },
    signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return binary ? Buffer.from(await resp.arrayBuffer()) : resp.text();
}

/** GET a URL and parse the body as JSON. */
export const getJson = async (url) => JSON.parse(await getText(url));

/** Upgrade a plain http:// URL to https:// (the hosts answer both). */
export const https = (u) => String(u || '').replace(/^http:\/\//i, 'https://');
