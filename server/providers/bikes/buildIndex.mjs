/**
 * Rebuilds systems.json: every keyless GBFS station system in the MobilityData
 * catalog (https://github.com/MobilityData/gbfs/blob/master/systems.csv), with
 * the box its stations cover. Run occasionally:
 *   node server/providers/bikes/buildIndex.mjs
 * The browser never sees this file; the proxy uses it to pick feeds for a view.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverFeeds, parseInformation, robustBBox } from './gbfs.js';
import { pool } from '../../../src/layers/shared/data/index.js';

const CSV = 'https://raw.githubusercontent.com/MobilityData/gbfs/master/systems.csv';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'systems.json');
const UA = 'pheonix-bikes-index/1.0';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') cell += (i++, '"');
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const getJson = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

async function main() {
  const rows = parseCsv(await (await fetch(CSV, { headers: { 'User-Agent': UA } })).text());
  // Car sharing, and free-floating scooter operators whose "stations" are virtual parking spots.
  const NOT_BIKES = /car.?shar|autohaus|stadtmobil|flinkster|cambio|zipcar|ubeeqo|poppy|share ?now|^voi\b|\bdott\b|\blime\b|\bbird\b|\bbolt\b|\btier\b|\bspin\b/i;
  const open = rows.filter((r) => r['Auto-Discovery URL'] && !r['Authentication Type'].trim() && !NOT_BIKES.test(`${r.Name} ${r['System ID']}`));
  console.log(`${rows.length} systems in catalog, ${open.length} without authentication`);
  const out = [];
  let done = 0;
  await pool(open, 12, async (r) => {
    const gbfs = r['Auto-Discovery URL'].trim();
    try {
      const feeds = discoverFeeds(await getJson(gbfs));
      if (!feeds.information || !feeds.status) throw new Error('no station feeds');
      const info = [...parseInformation(await getJson(feeds.information)).values()];
      if (info.length < 3 || /PBSC HQ/i.test(r.Name)) throw new Error('too small / demo');
      // Free-floating operators publish virtual parking "stations" without capacity: not docks, skip.
      if (info.filter((x) => x.capacity > 0).length < info.length * 0.3) throw new Error('not a docked system');
      const bbox = robustBBox(info);
      if (bbox[2] - bbox[0] > 25 || bbox[3] - bbox[1] > 25) throw new Error('implausible extent');
      out.push({
        id: r['System ID'], name: r.Name, location: r.Location, country: r['Country Code'], gbfs,
        n: info.length, bbox: bbox.map((v) => Math.round(v * 1e4) / 1e4),
      });
    } catch (err) {
      /* unreachable or station-less (free-floating) systems are left out */
    }
    if (++done % 50 === 0) console.log(`${done}/${open.length}, ${out.length} usable`);
  });
  out.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  await fs.writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), source: CSV, systems: out }, null, 0));
  console.log(`wrote ${out.length} systems to ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
