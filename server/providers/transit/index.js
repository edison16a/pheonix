/**
 * GET /api/transit?w=..&s=..&e=..&n=..   live vehicles inside the box
 *   returns { vehicles: [{i,lon,lat,b,s,r,l,k,f,t}], feeds:[{id,name,city,count,ageS,error?,attribution}], covered, truncated }
 *   short keys: i id, b bearing deg, s speed m/s, r route, l label, k kind, f feed id, t age in seconds
 * GET /api/transit/feeds                  the coverage list
 *
 * Only feeds whose coverage box intersects the request are fetched; each feed is
 * cached ~10 s and single-flighted, so many viewers never multiply upstream load.
 * Positions older than 5 minutes are dropped rather than shown as live.
 */
import { FEEDS } from './feeds.js';
import { bboxIntersects, bboxContains } from '../../../src/layers/shared/geo/index.js';
import { createCache, singleFlight } from '../../../src/layers/shared/data/index.js';

const TTL_MS = 10_000;
const STALE_OK_MS = 90_000;
const MAX_AGE_S = 300;
const MAX_FEEDS = 4;
const MAX_VEHICLES = 4000;
const MAX_BYTES = 12 * 1024 * 1024;

const cache = createCache({ max: 40, ttlMs: TTL_MS });
const flight = singleFlight();

/** Read a response body, refusing anything over MAX_BYTES so a bad feed can't eat memory. */
async function readCapped(res) {
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('feed too large');
  return buf;
}

/**
 * One feed's vehicles, cached for TTL_MS and shared between concurrent requests.
 * On failure a slightly old answer is better than none; otherwise an empty list with the error.
 */
export async function loadFeed(feed, { fetchImpl = fetch, now = Date.now } = {}) {
  const hit = cache.get(feed.id);
  if (hit) return hit;
  return flight(feed.id, async () => {
    try {
      const res = await fetchImpl(feed.url, {
        headers: { 'User-Agent': 'pheonix-transit/1.0', Accept: feed.format === 'json' ? 'application/json' : '*/*' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await readCapped(res);
      const vehicles = feed.parse(feed.format === 'json' ? JSON.parse(new TextDecoder().decode(raw)) : raw);
      const entry = { at: now(), vehicles };
      cache.set(feed.id, entry);
      return entry;
    } catch (err) {
      const stale = cache.get(feed.id, { allowStale: true });
      if (stale && now() - stale.at < STALE_OK_MS) return stale;
      return { at: now(), vehicles: [], error: String(err.message || err).slice(0, 80) };
    }
  });
}

/** Pure: pick, filter and shape vehicles for one request. */
export function selectVehicles(entries, bbox, nowS, limit = MAX_VEHICLES) {
  const cx = (bbox.west + bbox.east) / 2;
  const cy = (bbox.south + bbox.north) / 2;
  const rows = [];
  const feeds = [];
  for (const { feed, entry } of entries) {
    let count = 0;
    let newest = Infinity;
    for (const v of entry.vehicles) {
      if (!bboxContains(bbox, v.lon, v.lat)) continue;
      const age = v.ts ? Math.max(0, Math.round(nowS - v.ts)) : 0;
      if (v.ts && age > MAX_AGE_S) continue;
      count++;
      newest = Math.min(newest, age);
      rows.push({
        d: (v.lon - cx) ** 2 + (v.lat - cy) ** 2,
        row: {
          i: `${feed.id}:${v.id}`, lon: +v.lon.toFixed(6), lat: +v.lat.toFixed(6),
          b: v.bearing == null ? null : Math.round(v.bearing), s: v.speed == null ? null : +v.speed.toFixed(1),
          r: v.route || '', l: v.label || '', k: v.kind, f: feed.id, t: age,
        },
      });
    }
    feeds.push({
      id: feed.id, name: feed.name, city: feed.city, attribution: feed.attribution, count,
      ageS: newest === Infinity ? null : newest, ...(entry.error ? { error: entry.error } : {}),
    });
  }
  rows.sort((a, b) => a.d - b.d);
  return { vehicles: rows.slice(0, limit).map((r) => r.row), feeds, truncated: rows.length > limit };
}

/** Send an uncached JSON response. */
function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

/** Vite plugin that serves /api/transit in dev and preview. */
export function transitProxy() {
  const install = (server) => {
    server.middlewares.use('/api/transit', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/feeds')
        return send(res, 200, FEEDS.map(({ id, name, city, bbox, attribution }) => ({ id, name, city, bbox, attribution })));
      const [w, s, e, n] = ['w', 's', 'e', 'n'].map((k) => Number(url.searchParams.get(k)));
      if (![w, s, e, n].every(Number.isFinite)) return send(res, 400, { error: 'bbox required' });
      const bbox = { west: w, south: s, east: e, north: n };
      const cx = (w + e) / 2;
      const cy = (s + n) / 2;
      const near = FEEDS.filter((f) => bboxIntersects(bbox, { west: f.bbox[0], south: f.bbox[1], east: f.bbox[2], north: f.bbox[3] }))
        .sort((a, b) => Math.hypot((a.bbox[0] + a.bbox[2]) / 2 - cx, (a.bbox[1] + a.bbox[3]) / 2 - cy) - Math.hypot((b.bbox[0] + b.bbox[2]) / 2 - cx, (b.bbox[1] + b.bbox[3]) / 2 - cy))
        .slice(0, MAX_FEEDS);
      if (!near.length) return send(res, 200, { vehicles: [], feeds: [], covered: false, truncated: false });
      const entries = await Promise.all(near.map(async (feed) => ({ feed, entry: await loadFeed(feed) })));
      send(res, 200, { ...selectVehicles(entries, bbox, Date.now() / 1000), covered: true });
    });
  };
  return { name: 'pheonix-transit', configureServer: install, configurePreviewServer: install };
}
