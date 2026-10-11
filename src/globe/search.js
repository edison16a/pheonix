import { GEOCODER_URL } from '../config.js';

const cache = new Map();
let lastCall = 0;

/**
 * Keyless place search via OpenStreetMap Nominatim. Honours its usage policy:
 * max 1 request/second, results cached per query.
 * @returns {Promise<Array<{name:string, lon:number, lat:number, bbox:number[]|null}>>}
 */
export async function searchPlaces(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const wait = Math.max(0, lastCall + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (signal?.aborted) return [];
  lastCall = Date.now();

  const url = new URL(GEOCODER_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '0');
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const rows = await res.json();
  const results = rows.map((r) => ({
    name: r.display_name,
    lon: Number(r.lon),
    lat: Number(r.lat),
    rank: Number(r.place_rank) || 30,
    bbox: r.boundingbox
      ? [
          Number(r.boundingbox[2]),
          Number(r.boundingbox[0]),
          Number(r.boundingbox[3]),
          Number(r.boundingbox[1]),
        ]
      : null,
  }));
  cache.set(key, results);
  return results;
}
