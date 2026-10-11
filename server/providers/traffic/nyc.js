/**
 * NYC DOT real-time traffic speeds (NYC Open Data / Socrata, dataset i4gi-tjb9),
 * keyless. The feed covers ~125 major-road links (expressways, bridges, big
 * arterials), each with a measured speed in mph and a data_as_of timestamp in
 * New York local time. We keep the newest reading per link.
 */
import { createCache, singleFlight } from '../../../src/layers/shared/data/index.js';

const URL_BASE = 'https://data.cityofnewyork.us/resource/i4gi-tjb9.json';
export const NYC_BBOX = { west: -74.3, south: 40.45, east: -73.65, north: 40.95 };
/** Readings older than this are not shown as live. (PHEONIX_TRAFFIC_MAX_AGE_MIN overrides, for testing.) */
export const maxAgeMin = () => Number(process.env.PHEONIX_TRAFFIC_MAX_AGE_MIN) || 45;

const tz = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Parse a New York wall-time string like "2026-10-10T23:16:06.000" into epoch ms. */
export function nyLocalToMs(str) {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/.exec(str || '');
  if (!m) return NaN;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  // Offset of New York at (approximately) that instant.
  let guess = asUtc;
  for (let k = 0; k < 2; k++) {
    const p = Object.fromEntries(tz.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess = asUtc - (wall - guess);
  }
  return guess;
}

/** Format epoch ms as New York wall time, the form the SoQL filter expects. */
export function msToNyLocal(ms) {
  const p = Object.fromEntries(tz.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** Some feed rows carry corrupt coordinates (links thousands of km long); reject those. */
export function plausible(pts) {
  for (let k = 0; k < pts.length; k++) {
    const [lon, lat] = pts[k];
    if (lon < NYC_BBOX.west || lon > NYC_BBOX.east || lat < NYC_BBOX.south || lat > NYC_BBOX.north) return false;
    if (k) {
      const dx = (lon - pts[k - 1][0]) * 84_000;
      const dy = (lat - pts[k - 1][1]) * 111_000;
      if (Math.hypot(dx, dy) > 1500) return false;
    }
  }
  return true;
}

/** Newest valid reading per link, as [{id,name,borough,mph,ageMin,pts}], whatever its age. */
export function parseNyc(rows, nowMs = Date.now()) {
  const best = new Map();
  for (const r of rows) {
    const at = nyLocalToMs(r.data_as_of);
    const mph = Number(r.speed);
    // speed 0 with travel_time 0 is "no reading", not a standstill.
    if (!Number.isFinite(at) || !Number.isFinite(mph) || (mph === 0 && Number(r.travel_time) === 0)) continue;
    const cur = best.get(r.link_id);
    if (cur && cur.at >= at) continue;
    const pts = String(r.link_points || '')
      .trim().split(/\s+/)
      .map((p) => p.split(',').map(Number))
      .filter((p) => p.length === 2 && p.every(Number.isFinite))
      .map(([lat, lon]) => [lon, lat]);
    if (pts.length < 2 || !plausible(pts)) continue;
    best.set(r.link_id, { at, id: r.link_id, name: r.link_name || '', borough: r.borough || '', mph, pts });
  }
  const out = [];
  for (const l of best.values()) {
    const ageMin = Math.max(0, Math.round((nowMs - l.at) / 60_000));
    out.push({ id: l.id, name: l.name, borough: l.borough, mph: l.mph, ageMin, pts: l.pts });
  }
  return out;
}

/** Only readings fresh enough to call live; `newestAgeMin` lets the UI explain an outage. */
export function freshLinks(all, limit = maxAgeMin()) {
  return {
    links: all.filter((l) => l.ageMin <= limit),
    newestAgeMin: all.length ? Math.min(...all.map((l) => l.ageMin)) : null,
  };
}

const cache = createCache({ max: 2, ttlMs: 60_000 });
const flight = singleFlight();

/** Measured NYC links, cached for a minute. On upstream failure the last good answer is served, however old. */
export async function getNycLinks({ fetchImpl = fetch, now = Date.now } = {}) {
  const hit = cache.get('nyc');
  if (hit) return hit;
  return flight('nyc', async () => {
    const soql = async (params) => {
      const res = await fetchImpl(`${URL_BASE}?${new URLSearchParams({
        $select: 'link_id,speed,travel_time,data_as_of,link_name,borough,link_points',
        $order: 'data_as_of DESC',
        ...params,
      })}`, { headers: { 'User-Agent': 'pheonix-traffic/1.0' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`nyc ${res.status}`);
      return res.json();
    };
    try {
      // Only the recent window: ~125 links report every ~5 minutes.
      const windowMin = Math.min(maxAgeMin() + 5, 720);
      let all = parseNyc(
        await soql({ $where: `data_as_of > '${msToNyLocal(now() - windowMin * 60_000)}'`, $limit: '6000' }),
        now(),
      );
      // Nothing recent: fetch just the newest row so the UI can say how stale the feed is.
      if (!all.length) all = parseNyc(await soql({ $limit: '3' }), now());
      const body = {
        region: 'nyc',
        source: 'NYC DOT real-time traffic speeds (NYC Open Data)',
        ...freshLinks(all),
      };
      cache.set('nyc', body);
      return body;
    } catch (err) {
      const stale = cache.get('nyc', { allowStale: true });
      if (stale) return stale;
      throw err;
    }
  });
}
