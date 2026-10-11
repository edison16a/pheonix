import { CCTV_MEDIA_FETCH_TIMEOUT_MS } from './limits.js';

/** Open registered media within a header deadline; leave timely live bodies running. */
export async function fetchCctvMediaUpstream(
  url,
  {
    headers = {},
    fetchImpl = fetch,
    timeoutMs = CCTV_MEDIA_FETCH_TIMEOUT_MS,
    signal: downstream = null,
  } = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // The client going away cancels the upstream request, not just the response
  // to it.
  const onDownstreamAbort = () => controller.abort();
  if (downstream?.aborted) controller.abort();
  else downstream?.addEventListener?.('abort', onDownstreamAbort);
  try {
    return await fetchImpl(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    downstream?.removeEventListener?.('abort', onDownstreamAbort);
  }
}
