/**
 * Road tiles for the simulation: OpenFreeMap vector tiles first (CDN, ~200 ms,
 * keyless, OSM data), the Overpass API as fallback. Z14 slippy tiles.
 *   level 'major' = motorway..tertiary, 'all' = plus residential/service.
 */
import { decodeRoads, tileBounds } from './mvt.js';
import { getOverpassRoads } from '../overpass/index.js';
import { createCache, singleFlight } from '../../../src/layers/shared/data/index.js';

export const ROAD_ZOOM = 14;
const TILEJSON = 'https://tiles.openfreemap.org/planet';
const UA = 'pheonix-traffic/1.0';

/** Only whole z14 tiles at the two known detail levels are served, so callers can't make us fetch arbitrary things. */
export const isValidRoadTile = (level, x, y) =>
  (level === 'major' || level === 'all') &&
  Number.isInteger(x) && Number.isInteger(y) &&
  x >= 0 && y >= 0 && x < 2 ** ROAD_ZOOM && y < 2 ** ROAD_ZOOM;

let template = { url: '', at: 0 };
/** Current OpenFreeMap tile URL template. The planet build is versioned in the URL, so it is refreshed hourly or on demand. */
async function tileTemplate(fetchImpl, force = false) {
  if (!force && template.url && Date.now() - template.at < 3_600_000) return template.url;
  const res = await fetchImpl(TILEJSON, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`tilejson ${res.status}`);
  const url = (await res.json()).tiles?.[0];
  if (!url) throw new Error('tilejson without tiles');
  template = { url, at: Date.now() };
  return url;
}

/** Raw vector tile bytes. Retries once with a fresh template when the planet version rolled over (404). */
async function openFreeMapTile(x, y, fetchImpl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = (await tileTemplate(fetchImpl, attempt > 0))
      .replace('{z}', ROAD_ZOOM).replace('{x}', x).replace('{y}', y);
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) });
    if (res.status === 404 && attempt === 0) continue; // planet version rolled over
    if (res.status === 204) return new Uint8Array();
    if (!res.ok) throw new Error(`tile ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error('tile unavailable');
}

const mem = createCache({ max: 240, ttlMs: 6 * 3_600_000 });
const flight = singleFlight();

/** Road tile body for the client, cached in memory and shared between concurrent requests. Falls back to Overpass when OpenFreeMap fails. */
export function getRoadTile(level, x, y, { fetchImpl = fetch } = {}) {
  const key = `${level}:${x}:${y}`;
  const hit = mem.get(key);
  if (hit) return Promise.resolve(hit);
  return flight(key, async () => {
    const prefix = `${x}.${y}.`;
    let roads;
    let source = 'OpenFreeMap (OpenStreetMap data)';
    try {
      const bytes = await openFreeMapTile(x, y, fetchImpl);
      roads = bytes.length ? decodeRoads(bytes, ROAD_ZOOM, x, y, { minor: level === 'all', idPrefix: prefix }) : [];
    } catch {
      source = 'OpenStreetMap via Overpass API';
      const b = tileBounds(ROAD_ZOOM, x, y);
      const major = await getOverpassRoads('major', b, `maj-${x}-${y}`);
      const minor = level === 'all' ? await getOverpassRoads('minor', b, `min-${x}-${y}`) : [];
      roads = [...major, ...minor].map((r) => [`${prefix}${r[0]}`, ...r.slice(1)]);
    }
    const body = { level, x, y, z: ROAD_ZOOM, source, roads };
    mem.set(key, body);
    return body;
  });
}
