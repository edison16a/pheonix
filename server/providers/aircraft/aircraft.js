/**
 * Viewport-scoped live aircraft positions (keyless).
 *
 *   GET /api/aircraft?lat=..&lon=..&radius=..   (radius in nautical miles, <= 450)
 *
 * Upstream: adsb.lol community ADS-B network (https://api.adsb.lol, ODbL data).
 * Views wider than one 250 nm query are covered by a fixed anchor lattice
 * (anchors.js). Every anchor is cached for a short TTL and single-flighted, so
 * many viewers/moves never exceed the provider's limits; a failing or
 * rate-limiting upstream serves stale data and is left alone for a cooldown.
 */
import { distanceNm, planAnchors } from './anchors.js';

const UPSTREAM = 'https://api.adsb.lol/v2/point';
const TTL_MS = 10_000;
const STALE_MS = 60_000;
const COOLDOWN_MS = 20_000;
const MAX_ENTRIES = 160;
const MAX_RADIUS_NM = 450;
const MAX_AIRCRAFT = 3000;
const CONCURRENCY = 4;

const cache = new Map(); // keyed by anchor, holds { at, aircraft }
const inflight = new Map(); // keyed by anchor, holds the pending request
let cooldownUntil = 0;
let refusals = 0;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = (v) => (Number.isFinite(v) ? v : null);

export function normalize(payload) {
  const list = Array.isArray(payload?.ac) ? payload.ac : [];
  const out = [];
  for (const a of list) {
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !a.hex) continue;
    const onGround = a.alt_baro === 'ground';
    out.push({
      id: a.hex,
      callsign: String(a.flight || '').trim(),
      lat: a.lat,
      lon: a.lon,
      altFt: typeof a.alt_baro === 'number' ? a.alt_baro : 0,
      altGeomFt: num(a.alt_geom),
      onGround,
      track: num(a.track ?? a.true_heading ?? a.mag_heading),
      speedKt: num(a.gs),
      vRateFpm: num(a.baro_rate ?? a.geom_rate),
      squawk: a.squawk || '',
      reg: a.r || '',
      type: a.t || '',
      desc: a.desc || '',
      owner: a.ownOp || '',
      category: a.category || '',
      seenPos: Number.isFinite(a.seen_pos) ? a.seen_pos : 0,
    });
  }
  return out;
}

async function fetchAnchor(anchor) {
  const key = `${anchor.lat},${anchor.lon},${anchor.radius}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit;
  if (inflight.has(key)) return inflight.get(key);
  if (now < cooldownUntil) {
    if (hit && now - hit.at < STALE_MS) return hit;
    throw new Error('upstream cooling down');
  }
  const p = (async () => {
    try {
      const res = await fetch(
        `${UPSTREAM}/${anchor.lat}/${anchor.lon}/${anchor.radius}`,
        {
          headers: { 'User-Agent': 'pheonix-aircraft-proxy/1.1' },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        // adsb.lol rate-limits in bursts and unevenly: back off only after repeated refusals.
        if (res.status === 429 || res.status >= 500) {
          if (++refusals >= 4) cooldownUntil = Date.now() + COOLDOWN_MS;
        }
        throw new Error(`upstream ${res.status}`);
      }
      refusals = 0;
      const entry = { at: Date.now(), aircraft: normalize(await res.json()) };
      cache.set(key, entry);
      if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
      return entry;
    } catch (err) {
      if (hit && Date.now() - hit.at < STALE_MS) return hit; // serve stale rather than fail
      throw err;
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Fetch `anchors` with bounded concurrency; failures are dropped, all failing throws. */
async function fetchAll(anchors) {
  const results = [];
  let failures = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, anchors.length) }, async () => {
      while (next < anchors.length) {
        const anchor = anchors[next++];
        try {
          results.push(await fetchAnchor(anchor));
        } catch {
          failures++;
        }
      }
    }),
  );
  if (!results.length && failures)
    throw new Error('all upstream queries failed');
  return results;
}

/**
 * Merge anchor results: dedupe by hex keeping the freshest report, attach each
 * aircraft's age (seconds since the position was true) and keep the nearest
 * `MAX_AIRCRAFT` inside the requested circle.
 */
export function mergeAircraft(results, lat, lon, radiusNm, now = Date.now()) {
  const byId = new Map();
  for (const { at, aircraft } of results) {
    const fetchAge = (now - at) / 1000;
    for (const a of aircraft) {
      const age = Math.round((fetchAge + a.seenPos) * 10) / 10;
      const prev = byId.get(a.id);
      if (prev && prev.age <= age) continue;
      const { seenPos, ...rest } = a; // eslint-disable-line no-unused-vars
      byId.set(a.id, { ...rest, age });
    }
  }
  const limit = radiusNm * 1.1;
  const scored = [];
  for (const a of byId.values()) {
    const d = distanceNm(lat, lon, a.lat, a.lon);
    if (d <= limit) scored.push([d, a]);
  }
  scored.sort((x, y) => x[0] - y[0]);
  return scored.slice(0, MAX_AIRCRAFT).map(([, a]) => a);
}

export function aircraftProxy() {
  const install = (server) => {
    server.middlewares.use('/api/aircraft', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const lat = Number(url.searchParams.get('lat'));
      const lon = Number(url.searchParams.get('lon'));
      const radius = clamp(
        Math.round(Number(url.searchParams.get('radius')) || 100),
        10,
        MAX_RADIUS_NM,
      );
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'lat and lon are required' }));
        return;
      }
      try {
        const results = await fetchAll(planAnchors(lat, lon, radius));
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify({
            source: 'adsb.lol',
            license: 'ODbL 1.0',
            fetchedAt: Date.now(),
            aircraft: mergeAircraft(results, lat, lon, radius),
          }),
        );
      } catch {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Aircraft feed unavailable' }));
      }
    });
  };
  return {
    name: 'pheonix-aircraft',
    configureServer: install,
    configurePreviewServer: install,
  };
}
