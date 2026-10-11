import {
  CCTV_FRAME_FETCH_TIMEOUT_MS,
  CCTV_FRAME_MAX_BODY_BYTES,
} from './limits.js';
import { readCappedResponseBytes } from './cappedBytes.js';
import { cctvUpstreamUserAgent } from './userAgent.js';

/** Redirect hops the frame path will follow, and only within the same host. */
const MAX_SAME_HOST_REDIRECTS = 2;

/**
 * Fetch a registered frame URL following redirects ONLY within the original
 * origin (scheme, host and port; at most MAX_SAME_HOST_REDIRECTS hops).
 * Default redirect-following would let an upstream steer a host-pinned
 * request, and its host-specific headers, to any origin, another port, or a
 * plaintext downgrade.
 *
 * @param {string} url
 * @param {object} init - fetch init (headers, signal).
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<Response|null>} Final response, or null on an off-host or
 *   over-long redirect chain.
 */
async function fetchWithinHost(url, init, fetchImpl = fetch) {
  let current;
  try {
    current = new URL(url);
  } catch {
    return null;
  }
  const origin = current.origin;
  for (let hop = 0; hop <= MAX_SAME_HOST_REDIRECTS; hop++) {
    const upstream = await fetchImpl(current.toString(), {
      ...init,
      redirect: 'manual',
    });
    // Anything that is not a 3xx (including a test double with no status) is
    // the final answer.
    const status = Number(upstream?.status);
    if (!(status >= 300 && status < 400)) return upstream;
    const location = upstream.headers.get('location');
    try {
      await upstream.body?.cancel();
    } catch {
      /* no-op */
    }
    if (!location || hop === MAX_SAME_HOST_REDIRECTS) return null;
    let next;
    try {
      next = new URL(location, current);
    } catch {
      return null;
    }
    if (next.origin !== origin) return null;
    current = next;
  }
  return null;
}

/**
 * Fetch one upstream CCTV image within the frame-refresh budget.
 *
 * A timeout is treated like every other upstream miss so the caller can
 * continue through the Street View and synthetic fallback chain. `fetchImpl`
 * and `timeoutMs` are injectable only to keep the timeout contract unit-testable.
 *
 * @param {string} url - Server-registered upstream image URL.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl=fetch] - Fetch implementation.
 * @param {number} [options.timeoutMs=CCTV_FRAME_FETCH_TIMEOUT_MS] - Abort timeout.
 * @param {number} [options.maxBytes=CCTV_FRAME_MAX_BODY_BYTES] - Snapshot byte cap.
 * @returns {Promise<{ok:true,body:Buffer,contentType:string}|null>}
 */
export async function fetchCctvImageFromUpstream(
  url,
  {
    fetchImpl = fetch,
    timeoutMs = CCTV_FRAME_FETCH_TIMEOUT_MS,
    maxBytes = CCTV_FRAME_MAX_BODY_BYTES,
  } = {},
) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException('CCTV upstream frame fetch timed out', 'TimeoutError'),
    );
  }, timeoutMs);
  try {
    const upstream = await fetchWithinHost(
      url,
      {
        headers: { 'User-Agent': cctvUpstreamUserAgent(url) },
        signal: controller.signal,
      },
      fetchImpl,
    );
    if (!upstream) return null;
    const contentType = upstream.headers.get('content-type') || '';
    const octet = /^application\/octet-stream/i.test(contentType);
    if (!upstream.ok || !(contentType.startsWith('image/') || octet)) {
      controller.abort();
      return null;
    }
    const body = await readCappedResponseBytes(upstream, maxBytes);
    if (!body) return null;
    if (octet) {
      // Some open-data hosts (data.gov.sg) label JPEGs as octet-stream:
      // accept only when the bytes really are a JPEG or PNG.
      const jpeg = body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
      const png = body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e;
      if (!jpeg && !png) return null;
      return { ok: true, body, contentType: jpeg ? 'image/jpeg' : 'image/png' };
    }
    return { ok: true, body, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}
