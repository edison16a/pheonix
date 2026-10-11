/**
 * Overpass API road fetcher: the fallback road source for the traffic
 * simulation when OpenFreeMap tiles are unreachable (see ../traffic/roadTiles.js).
 * Takes a bbox (never raw Overpass QL from the browser), compacts the answer for
 * the wire, caches in memory + on disk (7 days) and rate-limits itself: two
 * queries at a time, per-endpoint cool-downs on 429/5xx, mirror chain.
 * Data: (c) OpenStreetMap contributors, ODbL.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCache, singleFlight } from '../../../src/layers/shared/data/index.js';

const UPSTREAMS = (process.env.OVERPASS_UPSTREAMS || '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => /^https?:\/\//.test(s));
export const DEFAULT_UPSTREAMS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];
const UA = 'pheonix-traffic/1.0 (+https://github.com/; keyless road tiles, cached 7d)';
const TIMEOUT_MS = 28_000;
const MAX_CONCURRENT = 2;
const DISK_TTL_MS = 7 * 86_400_000;
const CACHE_DIR = path.join(os.tmpdir(), 'pheonix-cache', 'overpass');

const HIGHWAY_CLASS = {
  motorway: 0, motorway_link: 0, trunk: 1, trunk_link: 1, primary: 2, primary_link: 2,
  secondary: 3, secondary_link: 3, tertiary: 4, tertiary_link: 4,
  unclassified: 5, residential: 5, living_street: 5,
};
const LEVEL_FILTER = {
  major: '^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link)$',
  minor: '^(unclassified|residential|living_street)$',
};

/** Overpass QL for one road level inside the box. Built here so the browser never sends raw QL. */
export function tileQuery(level, bbox) {
  const { south, west, north, east } = bbox;
  const box = [south, west, north, east].map((v) => v.toFixed(5)).join(',');
  return `[out:json][timeout:25];way["highway"~"${LEVEL_FILTER[level]}"](${box});out tags geom qt;`;
}

/** OSM oneway tags as 1 (forward), -1 (reverse) or 0. Roundabouts and motorways are one-way unless tagged otherwise. */
function onewayOf(tags) {
  const o = tags.oneway;
  if (o === '-1' || o === 'reverse') return -1;
  if (o === 'yes' || o === 'true' || o === '1') return 1;
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 1;
  if (!o && (tags.highway === 'motorway' || tags.highway === 'motorway_link')) return 1;
  return 0;
}

/** Squeeze Overpass `out geom` JSON into the compact road wire format [[id, cls, oneway, firstNode, lastNode, [lon,lat,...]]]. */
export function compactOverpass(json) {
  const out = [];
  for (const el of json?.elements || []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const cls = HIGHWAY_CLASS[el.tags?.highway];
    if (cls === undefined) continue;
    const flat = [];
    for (const p of el.geometry) {
      if (!p) continue;
      flat.push(Math.round(p.lon * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6);
    }
    if (flat.length < 4) continue;
    const nodes = el.nodes || [];
    out.push([el.id, cls, onewayOf(el.tags || {}), nodes[0] || 0, nodes[nodes.length - 1] || 0, flat]);
  }
  return out;
}

const mem = createCache({ max: 160, ttlMs: 86_400_000 });
const flight = singleFlight();
const cooldown = new Map(); // time (ms) until which each upstream is skipped after a failure
let active = 0;
const waiters = [];
/** Wait for one of the MAX_CONCURRENT upstream query slots. */
async function slot() {
  if (active < MAX_CONCURRENT) return void active++;
  await new Promise((r) => waiters.push(r));
}
/** Give the slot to the next waiter, or free it. */
function release() {
  const next = waiters.shift();
  if (next) next();
  else active--;
}

/**
 * POST the query to each mirror in turn. A mirror that errors or is rate
 * limited sits out for a while, so one bad server doesn't slow every tile.
 */
async function queryUpstream(body, upstreams = UPSTREAMS.length ? UPSTREAMS : DEFAULT_UPSTREAMS, fetchImpl = fetch) {
  let lastErr = new Error('no upstream');
  for (const url of upstreams) {
    if ((cooldown.get(url) || 0) > Date.now()) continue;
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(body)}`,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) {
        cooldown.set(url, Date.now() + (res.status === 429 ? 60_000 : 15_000));
        lastErr = new Error(`upstream ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const json = await res.json();
      // Overpass reports server-side timeouts/out-of-memory as 200 + remark; not data.
      if (/runtime error|timed out|out of memory/i.test(json.remark || '')) {
        lastErr = new Error('upstream runtime error');
        continue;
      }
      return json;
    } catch (err) {
      lastErr = err;
      cooldown.set(url, Date.now() + 10_000);
    }
  }
  throw lastErr;
}

/** Cache file for a key, with anything unsafe in a filename replaced. */
const diskFile = (key) => path.join(CACHE_DIR, `${key.replace(/[^\w.-]/g, '_')}.json`);

/**
 * Roads for one bbox via Overpass. `level` 'major' (motorway..tertiary) or 'minor'
 * (residential and unclassified). Returns compact roads; cached 7 days on disk.
 */
export function getOverpassRoads(level, bbox, key, { fetchImpl } = {}) {
  const hit = mem.get(key);
  if (hit) return Promise.resolve(hit);
  return flight(key, async () => {
    try {
      const st = await fs.stat(diskFile(key));
      if (Date.now() - st.mtimeMs < DISK_TTL_MS) {
        const body = JSON.parse(await fs.readFile(diskFile(key), 'utf8'));
        mem.set(key, body);
        return body;
      }
    } catch {
      /* not cached */
    }
    await slot();
    try {
      const json = await queryUpstream(tileQuery(level, bbox), undefined, fetchImpl);
      const body = compactOverpass(json);
      mem.set(key, body);
      fs.mkdir(CACHE_DIR, { recursive: true })
        .then(() => fs.writeFile(diskFile(key), JSON.stringify(body)))
        .catch(() => {});
      return body;
    } finally {
      release();
    }
  });
}
