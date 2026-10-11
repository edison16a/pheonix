import { PROXY_USER_AGENT } from '../../shared/upstream.js';
import { readCappedResponseBytes } from '../../media/cappedBytes.js';
import { TXDOT_CCTV_SNAPSHOT_URL } from './constants.js';
import {
  CCTV_FRAME_FETCH_TIMEOUT_MS,
  CCTV_FRAME_MAX_BODY_BYTES,
} from '../../media/limits.js';

const SNAPSHOT_ENDPOINT = new URL(TXDOT_CCTV_SNAPSHOT_URL);

/**
 * Fetch and decode a TxDOT ITS / TransGuide snapshot.
 *
 * TxDOT returns JSON with a base64-encoded JPEG in `snippet`, rather than
 * returning image/jpeg directly.
 */
export async function fetchTxdotSnapshot(
  url,
  {
    fetchImpl = fetch,
    timeoutMs = CCTV_FRAME_FETCH_TIMEOUT_MS,
    maxBytes = CCTV_FRAME_MAX_BODY_BYTES,
  } = {},
) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.origin !== SNAPSHOT_ENDPOINT.origin ||
    parsed.pathname !== SNAPSHOT_ENDPOINT.pathname
  ) {
    return null;
  }
  // Base64 inflates by 4/3; the JSON envelope adds a few bytes of framing.
  const maxEnvelopeBytes = Math.ceil((maxBytes * 4) / 3) + 4096;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The snapshot endpoint answers directly; a redirect is not followed, so
    // the origin/path pin above holds for the request that is actually made.
    const upstream = await fetchImpl(parsed.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': PROXY_USER_AGENT,
      },
      signal: controller.signal,
      redirect: 'manual',
    });
    if (!upstream.ok) return null;
    const envelope = await readCappedResponseBytes(upstream, maxEnvelopeBytes);
    if (!envelope) return null;
    let payload;
    try {
      payload = JSON.parse(envelope.toString('utf8'));
    } catch {
      return null;
    }
    let snippet =
      typeof payload?.snippet === 'string' ? payload.snippet.trim() : '';
    if (!snippet) return null;
    snippet = snippet.replace(/^data:image\/jpeg;base64,/i, '');
    // Canonical base64 only (4-char groups, padding only at the end):
    // Buffer.from() silently skips junk, which would let a non-image body
    // decode into "something".
    if (
      snippet.length > maxEnvelopeBytes ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        snippet,
      )
    ) {
      return null;
    }
    const body = Buffer.from(snippet, 'base64');
    if (body.length < 4 || body.length > maxBytes) return null;
    if (body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) return null;
    return { ok: true, body, contentType: 'image/jpeg' };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}
