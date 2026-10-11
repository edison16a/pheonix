/**
 * GTFS-realtime VehiclePosition decoder (protobuf, no dependency).
 * Returns [{ id, lat, lon, bearing, speed (m/s), route, trip, label, ts (epoch s) }].
 */
import { PbfReader } from '../../../src/layers/shared/data/index.js';

/* The read* helpers each walk one protobuf message (field numbers from the GTFS-realtime spec) into `out`. */
function readPosition(r, out) {
  while (r.more()) {
    const [f, w] = r.tag();
    if (f === 1 && w === 5) out.lat = r.float();
    else if (f === 2 && w === 5) out.lon = r.float();
    else if (f === 3 && w === 5) out.bearing = r.float();
    else if (f === 5 && w === 5) out.speed = r.float();
    else r.skip(w);
  }
}
function readTrip(r, out) {
  while (r.more()) {
    const [f, w] = r.tag();
    if (f === 1 && w === 2) out.trip = r.string();
    else if (f === 5 && w === 2) out.route = r.string();
    else r.skip(w);
  }
}
function readDescriptor(r, out) {
  while (r.more()) {
    const [f, w] = r.tag();
    if (f === 1 && w === 2) out.vid = r.string();
    else if (f === 2 && w === 2) out.label = r.string();
    else r.skip(w);
  }
}
function readVehicle(r) {
  const v = {};
  while (r.more()) {
    const [f, w] = r.tag();
    if (f === 1 && w === 2) readTrip(r.sub(), v);
    else if (f === 2 && w === 2) readPosition(r.sub(), v);
    else if (f === 5 && w === 0) v.ts = r.varint();
    else if (f === 8 && w === 2) readDescriptor(r.sub(), v);
    else r.skip(w);
  }
  return v;
}

/** Decode a FeedMessage, keeping each entity's vehicle position. Missing timestamps fall back to the feed header time. */
export function decodeVehiclePositions(bytes) {
  const out = [];
  const top = new PbfReader(bytes);
  let headerTs = 0;
  while (top.more()) {
    const [f, w] = top.tag();
    if (f === 1 && w === 2) {
      const h = top.sub();
      while (h.more()) {
        const [hf, hw] = h.tag();
        if (hf === 3 && hw === 0) headerTs = h.varint();
        else h.skip(hw);
      }
    } else if (f === 2 && w === 2) {
      const e = top.sub();
      let id = '';
      let v = null;
      while (e.more()) {
        const [ef, ew] = e.tag();
        if (ef === 1 && ew === 2) id = e.string();
        else if (ef === 4 && ew === 2) v = readVehicle(e.sub());
        else e.skip(ew);
      }
      if (!v || !Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
      if (Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180 || (v.lat === 0 && v.lon === 0)) continue;
      out.push({
        id: v.vid || id,
        lat: v.lat,
        lon: v.lon,
        bearing: Number.isFinite(v.bearing) ? v.bearing : null,
        speed: Number.isFinite(v.speed) ? v.speed : null,
        route: v.route || '',
        label: v.label || '',
        ts: v.ts || headerTs || 0,
      });
    } else top.skip(w);
  }
  return out;
}
