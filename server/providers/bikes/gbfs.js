/**
 * GBFS (General Bikeshare Feed Specification) parsing, tolerant of v1/v2/v3.
 * Pure functions: no I/O.
 */
/** Number, or `fallback` when the feed sent null, a blank or junk. */
export const num = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
/** GBFS booleans arrive as true/false, 0/1 or strings; anything unset gets `fallback`. */
export const flag = (v, fallback = true) => {
  if (v == null) return fallback;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (Number.isFinite(n)) return n !== 0;
  return !/^(false|no)$/i.test(String(v));
};

/** Find the { information, status } URLs in gbfs.json (v1/v2 per-language map, v3 flat list). */
export function discoverFeeds(doc) {
  const data = doc?.data || {};
  let feeds = [];
  if (Array.isArray(data.feeds)) feeds = data.feeds;
  else {
    const lang = data.en || data[Object.keys(data)[0]];
    feeds = lang?.feeds || [];
  }
  const url = (name) => feeds.find((f) => f.name === name)?.url || null;
  return { information: url('station_information'), status: url('station_status') };
}

/** v3 names are lists of {language, text}, v2 names are plain strings. Prefers English. */
const text = (v) => {
  if (Array.isArray(v)) return String(v.find((x) => x.language?.startsWith('en'))?.text ?? v[0]?.text ?? '');
  return String(v ?? '');
};

/** Parse station_information into a Map from station id to {id,name,lat,lon,capacity}. */
export function parseInformation(doc) {
  const out = new Map();
  for (const s of doc?.data?.stations || []) {
    const id = String(s.station_id ?? '');
    const lat = num(s.lat);
    const lon = num(s.lon);
    if (!id || lat == null || lon == null || (lat === 0 && lon === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.set(id, { id, name: text(s.name).trim() || text(s.short_name).trim(), lat, lon, capacity: num(s.capacity) });
  }
  return out;
}

/** Parse station_status into a Map from station id to {bikes, docks, ebikes, renting, installed, reported}. */
export function parseStatus(doc) {
  const out = new Map();
  for (const s of doc?.data?.stations || []) {
    const id = String(s.station_id ?? '');
    if (!id) continue;
    const types = s.vehicle_types_available;
    let ebikes = null;
    if (Array.isArray(types)) ebikes = types.reduce((n, t) => n + (/e.?bike|electric|assist/i.test(String(t.vehicle_type_id)) ? num(t.count, 0) : 0), 0) || null;
    out.set(id, {
      bikes: num(s.num_bikes_available ?? s.num_vehicles_available),
      docks: num(s.num_docks_available),
      ebikes: num(s.num_ebikes_available, ebikes),
      renting: flag(s.is_renting) && flag(s.is_installed),
      reported: num(s.last_reported),
    });
  }
  return out;
}

/** Join information and status into display stations. */
export function mergeStations(info, status) {
  const out = [];
  for (const [id, s] of info) {
    const st = status.get(id);
    out.push({
      id, name: s.name, lat: s.lat, lon: s.lon, cap: s.capacity,
      bikes: st?.bikes ?? null, docks: st?.docks ?? null, e: st?.ebikes ?? null,
      ok: st ? st.renting : null, at: st?.reported ?? null,
    });
  }
  return out;
}

/** Robust bbox [w,s,e,n] of points: ignores the 1% most remote stragglers on each side. */
export function robustBBox(points) {
  if (!points.length) return null;
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];
  const lons = points.map((p) => p.lon).sort((a, b) => a - b);
  const lats = points.map((p) => p.lat).sort((a, b) => a - b);
  const trim = points.length >= 50 ? 0.01 : 0;
  return [q(lons, trim), q(lats, trim), q(lons, 1 - trim), q(lats, 1 - trim)];
}
