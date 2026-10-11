/** How every camera upstream sees this proxy. */
export const PROXY_USER_AGENT = 'pheonix-cctv-proxy/1.0';

/**
 * Per-provider catalog-fetch timeout. Bounds the worst-case refresh so one
 * stalled upstream can't leave the catalog (and thus every CCTV route) pending
 * forever: a hung fetch aborts, the loader returns [], and stale data or the
 * other packs take over.
 */
export const CCTV_SOURCE_FETCH_TIMEOUT_MS = 15 * 1000;
