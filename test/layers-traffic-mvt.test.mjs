import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRoads, clipLine } from '../server/providers/traffic/mvt.js';

// Hand-built protobuf fixture: just enough of a vector tile to carry road lines.
function varint(n) {
  const out = [];
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
  return out;
}
const field = (num, wire, bytes) => [...varint(num * 8 + wire), ...bytes];
const lenField = (num, bytes) => field(num, 2, [...varint(bytes.length), ...bytes]);
const str = (s) => [...Buffer.from(s)];
const zig = (n) => (n < 0 ? -2 * n - 1 : 2 * n);

function tileWith(lines, cls = 'motorway') {
  const geom = [];
  let px = 0;
  let py = 0;
  for (const line of lines) {
    geom.push(...varint((1 << 3) | 1), ...varint(zig(line[0][0] - px)), ...varint(zig(line[0][1] - py)));
    [px, py] = line[0];
    geom.push(...varint(((line.length - 1) << 3) | 2));
    for (const [x, y] of line.slice(1)) {
      geom.push(...varint(zig(x - px)), ...varint(zig(y - py)));
      [px, py] = [x, y];
    }
  }
  const feature = [...lenField(2, [0, 0, 1, 0]), ...field(3, 0, [2]), ...lenField(4, geom)];
  const layer = [
    ...lenField(1, str('transportation')),
    ...lenField(2, feature),
    ...lenField(3, str('class')),
    ...lenField(3, str('oneway')),
    ...lenField(4, lenField(1, str(cls))),
    ...lenField(4, field(5, 0, [1])),
    ...field(5, 0, varint(4096)),
  ];
  return Uint8Array.from(lenField(3, layer));
}

test('mvt: decodes road lines, converts tile units to lon/lat, clips to the tile', () => {
  const bytes = tileWith([[[100, 100], [2000, 100], [5000, 100]]]);
  const roads = decodeRoads(bytes, 14, 4825, 6156, { idPrefix: 'p.' });
  assert.equal(roads.length, 1);
  const [id, cls, oneway, , , flat] = roads[0];
  assert.equal(id, 'p.0');
  assert.equal(cls, 0);
  assert.equal(oneway, 1);
  // clipped at x = 4096: three points (start, vertex, clip point)
  assert.equal(flat.length, 6);
  const west = (4825 / 2 ** 14) * 360 - 180;
  const east = (4826 / 2 ** 14) * 360 - 180;
  assert.ok(flat[0] > west && flat[4] <= east + 1e-6 && flat[4] > east - 1e-4);
  assert.equal(decodeRoads(bytes, 14, 4825, 6156, { minor: false }).length, 1, 'major roads survive the major filter');
  assert.equal(decodeRoads(tileWith([[[0, 0], [10, 10]]], 'service'), 14, 1, 1, { minor: false }).length, 0);
  assert.deepEqual(clipLine([[-10, -10], [-5, -5]], 4096), []);
});
