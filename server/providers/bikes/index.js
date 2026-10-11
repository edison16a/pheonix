/**
 * Bikeshare stations with live availability (GBFS, keyless).
 *   GET /api/bikes?w=..&s=..&e=..&n=..
 *     returns { stations:[{id,name,lat,lon,cap,bikes,docks,e,ok,at,sys}], systems:[{id,name,count,error?}], covered, truncated }
 * Which systems cover a view comes from systems.json (built from the MobilityData
 * catalog by buildIndex.mjs). Station metadata is cached 1 h, availability 30 s.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverFeeds, parseInformation, parseStatus, mergeStations } from './gbfs.js';
import { bboxIntersects, bboxContains } from '../../../src/layers/shared/geo/index.js';
import { createCache, singleFlight } from '../../../src/layers/shared/data/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let catalog = null;
/** systems.json, read once. A missing or broken file means no bikes anywhere, not a crash. */
export function loadCatalog() {
  if (catalog) return catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(path.join(here, 'systems.json'), 'utf8')).systems;
  } catch {
    catalog = [];
  }
  return catalog;
}

const UA = 'pheonix-bikes/1.0';
const MAX_SYSTEMS = 5;
const MAX_STATIONS = 2500;
const infoCache = createCache({ max: 40, ttlMs: 3_600_000 });
const statusCache = createCache({ max: 80, ttlMs: 30_000 });
const feedCache = createCache({ max: 400, ttlMs: 6 * 3_600_000 });
const flight = singleFlight();

/** JSON GET with our user agent and a 15 s timeout. */
async function getJson(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Pick the systems whose station box meets the view, tightest (most local) first. */
export function selectSystems(systems, bbox, limit = MAX_SYSTEMS) {
  const cx = (bbox.west + bbox.east) / 2;
  const cy = (bbox.south + bbox.north) / 2;
  return systems
    .filter((s) => bboxIntersects(bbox, { west: s.bbox[0], south: s.bbox[1], east: s.bbox[2], north: s.bbox[3] }))
    .map((s) => ({ s, area: (s.bbox[2] - s.bbox[0] + 0.01) * (s.bbox[3] - s.bbox[1] + 0.01), inside: bboxContains({ west: s.bbox[0], south: s.bbox[1], east: s.bbox[2], north: s.bbox[3] }, cx, cy) }))
    .sort((a, b) => Number(b.inside) - Number(a.inside) || a.area - b.area)
    .slice(0, limit)
    .map((x) => x.s);
}

/**
 * Stations of one system with live availability. Feed URLs, station info and
 * station status each have their own cache lifetime (6 h, 1 h, 30 s).
 */
async function loadSystem(sys, { fetchImpl } = {}) {
  const feeds = await flight(`f:${sys.id}`, async () => {
    const hit = feedCache.get(sys.id);
    if (hit) return hit;
    const f = discoverFeeds(await getJson(sys.gbfs, fetchImpl));
    if (!f.information || !f.status) throw new Error('no station feeds');
    feedCache.set(sys.id, f);
    return f;
  });
  const info = await flight(`i:${sys.id}`, async () => {
    const hit = infoCache.get(sys.id);
    if (hit) return hit;
    const v = parseInformation(await getJson(feeds.information, fetchImpl));
    infoCache.set(sys.id, v);
    return v;
  });
  let status = statusCache.get(sys.id);
  if (!status)
    status = await flight(`s:${sys.id}`, async () => {
      const v = parseStatus(await getJson(feeds.status, fetchImpl));
      statusCache.set(sys.id, v);
      return v;
    });
  return mergeStations(info, status);
}

/**
 * Stations inside the box from each system, nearest the box centre first and
 * capped at `opts.limit`. A system that fails is reported in `systems`, it does not fail the request.
 */
export async function stationsFor(systems, bbox, opts = {}) {
  const cx = (bbox.west + bbox.east) / 2;
  const cy = (bbox.south + bbox.north) / 2;
  const rows = [];
  const report = [];
  await Promise.all(
    systems.map(async (sys) => {
      try {
        const list = await loadSystem(sys, opts);
        let count = 0;
        for (const st of list) {
          if (!bboxContains(bbox, st.lon, st.lat)) continue;
          if (st.cap == null && st.docks == null) continue; // virtual parking spot, not a dock
          count++;
          rows.push({ d: (st.lon - cx) ** 2 + (st.lat - cy) ** 2, st: { ...st, sys: sys.id } });
        }
        report.push({ id: sys.id, name: sys.name, location: sys.location, count });
      } catch (err) {
        report.push({ id: sys.id, name: sys.name, location: sys.location, count: 0, error: String(err.message || err).slice(0, 80) });
      }
    }),
  );
  rows.sort((a, b) => a.d - b.d);
  const limit = opts.limit || MAX_STATIONS;
  return { stations: rows.slice(0, limit).map((r) => r.st), systems: report, truncated: rows.length > limit };
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

/** Vite plugin that serves /api/bikes in dev and preview. */
export function bikesProxy() {
  const install = (server) => {
    server.middlewares.use('/api/bikes', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const [w, s, e, n] = ['w', 's', 'e', 'n'].map((k) => Number(url.searchParams.get(k)));
      if (![w, s, e, n].every(Number.isFinite)) return send(res, 400, { error: 'bbox required' });
      const bbox = { west: w, south: s, east: e, north: n };
      const systems = selectSystems(loadCatalog(), bbox);
      if (!systems.length) return send(res, 200, { stations: [], systems: [], covered: false, truncated: false });
      send(res, 200, { ...(await stationsFor(systems, bbox)), covered: true });
    });
  };
  return { name: 'pheonix-bikes', configureServer: install, configurePreviewServer: install };
}
