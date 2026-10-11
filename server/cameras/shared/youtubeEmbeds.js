import { PROXY_USER_AGENT } from './upstream.js';

const OEMBED_TTL_MS = 15 * 60 * 1000;
const ID_RE = /^[\w-]{11}$/;

const oembedCache = new Map(); // video id to { ok, at }

/** Run `fn` over items with at most `size` in flight; a failed item becomes null. */
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]).catch(() => null);
      }
    }),
  );
  return out;
}

/** Does YouTube's oEmbed endpoint accept this video id? Cached for 15 minutes. */
async function checkOembed(id) {
  const hit = oembedCache.get(id);
  if (hit && Date.now() - hit.at < OEMBED_TTL_MS) return hit.ok;
  let ok = false;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      {
        headers: { 'User-Agent': PROXY_USER_AGENT },
        signal: AbortSignal.timeout(10000),
      },
    );
    ok = res.status === 200;
    await res.body?.cancel().catch(() => {});
  } catch {
    ok = false;
  }
  oembedCache.set(id, { ok, at: Date.now() });
  return ok;
}

/**
 * Keep only entries whose stream verifies right now. YouTube oEmbed must answer
 * 200 (the video exists and allows embedding). It cannot say whether a stream is
 * live this minute; the player decides that from its own playback telemetry.
 */
export async function verifyEmbeds(entries) {
  const checked = await pool(entries, 4, async (e) => {
    if (!ID_RE.test(e.youtubeId)) return null;
    return (await checkOembed(e.youtubeId)) ? e : null;
  });
  return checked.filter(Boolean);
}

/** Catalog source object for one verified embed entry. */
export const embedToSource = (e) => ({
  id: e.id,
  name: e.name,
  city: e.city,
  cityId: e.cityId || '',
  provider: e.provider || e.credit,
  lat: e.lat,
  lon: e.lon,
  feedType: 'embed',
  embedId: e.youtubeId,
  url: '',
  credit: e.credit,
  license: e.license || '',
  officialUrl: e.officialUrl || '',
  sourceKind: 'youtube-embed',
});

/** YouTube video id from a watch, live or youtu.be URL, or ''. */
export const youtubeIdFromUrl = (u) =>
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/))([\w-]{11})/.exec(
    String(u),
  )?.[1] || '';
