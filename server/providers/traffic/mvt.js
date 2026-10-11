/**
 * Decode the `transportation` layer of an OpenFreeMap (OpenMapTiles schema)
 * vector tile into the compact road wire format used by the traffic layer:
 *   [id, cls, oneway, 0, 0, [lon,lat,...]]
 * Lines are clipped to the tile so neighbouring tiles never duplicate a road;
 * the client joins roads by endpoint proximity.
 */
import { PbfReader } from '../../../src/layers/shared/data/index.js';

const CLASS_OF = {
  motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, minor: 5, service: 6,
};

/** Lon/lat edges of a slippy-map tile. */
export function tileBounds(z, x, y) {
  const n = 2 ** z;
  const lon = (xx) => (xx / n) * 360 - 180;
  const lat = (yy) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return { west: lon(x), east: lon(x + 1), north: lat(y), south: lat(y + 1) };
}

/** Vector tile geometry commands to lines of [x,y] in tile units. Polygons' ClosePath is ignored: roads are lines. */
function decodeGeometry(geom) {
  // Returns an array of lines: [[x,y],...] in tile units. Only MoveTo/LineTo matter.
  const lines = [];
  let cur = null;
  let x = 0;
  let y = 0;
  for (let k = 0; k < geom.length; ) {
    const cmd = geom[k] & 7;
    const count = geom[k] >> 3; // safe: command counts are small
    k++;
    if (cmd === 7) continue;
    for (let c = 0; c < count; c++) {
      const dx = geom[k++];
      const dy = geom[k++];
      x += dx % 2 ? -(dx + 1) / 2 : dx / 2;
      y += dy % 2 ? -(dy + 1) / 2 : dy / 2;
      if (cmd === 1) lines.push((cur = [[x, y]]));
      else cur?.push([x, y]);
    }
  }
  return lines;
}

/** Clip a polyline to the tile square [0,extent]; returns the pieces inside. */
export function clipLine(line, extent) {
  const pieces = [];
  let cur = null;
  const clipSeg = (x0, y0, x1, y1) => {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    for (const [p, q] of [[-dx, x0], [dx, extent - x0], [-dy, y0], [dy, extent - y0]]) {
      if (p === 0) {
        if (q < 0) return null;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }
    return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy, t0 > 0, t1 < 1];
  };
  for (let k = 1; k < line.length; k++) {
    const c = clipSeg(line[k - 1][0], line[k - 1][1], line[k][0], line[k][1]);
    if (!c) {
      cur = null;
      continue;
    }
    if (!cur) pieces.push((cur = [[c[0], c[1]]]));
    cur.push([c[2], c[3]]);
    if (c[5]) cur = null; // exited the tile
  }
  return pieces.filter((p) => p.length >= 2);
}

/**
 * Walk a vector tile and return its road lines in the compact wire format.
 * Drops tunnels, non-road classes and (when `minor` is false) residential and
 * service streets. `idPrefix` keeps ids unique across tiles.
 * @param {Uint8Array} bytes raw (already decompressed) tile
 */
export function decodeRoads(bytes, z, x, y, { minor = true, idPrefix = '' } = {}) {
  const b = tileBounds(z, x, y);
  const roads = [];
  const tile = new PbfReader(bytes);
  while (tile.more()) {
    const [f, w] = tile.tag();
    if (f !== 3 || w !== 2) {
      tile.skip(w);
      continue;
    }
    const layer = tile.sub();
    let name = '';
    let extent = 4096;
    const keys = [];
    const values = [];
    const features = [];
    while (layer.more()) {
      const [lf, lw] = layer.tag();
      if (lf === 1) name = layer.string();
      else if (lf === 2) features.push(layer.sub());
      else if (lf === 3) keys.push(layer.string());
      else if (lf === 4) {
        const v = layer.sub();
        let val = null;
        while (v.more()) {
          const [vf, vw] = v.tag();
          if (vf === 1) val = v.string();
          else if (vf === 2) val = v.float();
          else if (vf === 3) val = v.double();
          else if (vf === 4 || vf === 5) val = v.varint();
          else if (vf === 6) val = v.svarint();
          else if (vf === 7) val = v.varint() === 1;
          else v.skip(vw);
        }
        values.push(val);
      } else if (lf === 5) extent = layer.varint();
      else layer.skip(lw);
    }
    if (name !== 'transportation') continue;
    let seq = 0;
    for (const fr of features) {
      let tags = [];
      let type = 0;
      let geom = null;
      while (fr.more()) {
        const [ff, fw] = fr.tag();
        if (ff === 2) tags = fr.packed();
        else if (ff === 3) type = fr.varint();
        else if (ff === 4) geom = fr.packed();
        else fr.skip(fw);
      }
      if (type !== 2 || !geom) continue;
      const props = {};
      for (let t = 0; t + 1 < tags.length; t += 2) props[keys[tags[t]]] = values[tags[t + 1]];
      const cls = CLASS_OF[props.class];
      if (cls === undefined || (!minor && cls >= 5)) continue;
      // Tunnels are underground, ferries/rail are not roads here.
      if (props.brunnel === 'tunnel') continue;
      const oneway = props.oneway === 1 || props.oneway === true ? 1 : props.oneway === -1 ? -1 : cls === 0 ? 1 : 0;
      for (const raw of decodeGeometry(geom))
        for (const line of clipLine(raw, extent)) {
        const flat = [];
        for (const [px, py] of line) {
          flat.push(
            Math.round((b.west + (px / extent) * (b.east - b.west)) * 1e6) / 1e6,
            Math.round((b.north + (py / extent) * (b.south - b.north)) * 1e6) / 1e6,
          );
        }
        roads.push([
          `${idPrefix}${seq++}`, cls, oneway,
          0, 0, flat,
        ]);
        }
    }
  }
  return roads;
}
