import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, roadFromWire } from '../src/layers/traffic/roads/network.js';
import { advance, allocate, spawnOn } from '../src/layers/traffic/sim/motion.js';
import { liveRoad, coverageIndex, bucketForMph } from '../src/layers/traffic/live/links.js';
import { seeded, road } from './helpers/roads.mjs';

test('vehicles continue across connected roads and turn at dead ends', () => {
  const net = createNetwork();
  const a = road('a', 0, 500);
  const b = road('b', 500 / 111320 + 0.000001, 500); // starts ~0.1 m after a ends
  net.addTile('t', [a, b]);
  const rng = seeded(7);
  const v = { road: a, s: 490, dir: 1, v: 20, dead: false };
  advance(v, 1, net, rng); // +20 m, so 10 m past the end of a
  assert.equal(v.road.id, 'b');
  assert.equal(v.dir, 1);
  assert.ok(v.s > 5 && v.s < 20, `entered b at ${v.s}`);
  // far end of b has no exit: two-way road turns the vehicle around
  const w = { road: b, s: 495, dir: 1, v: 20, dead: false };
  advance(w, 1, net, rng);
  assert.equal(w.dir, -1);
  assert.ok(w.s <= b.len && w.s > 450);
  // one-way dead end recycles
  const net2 = createNetwork();
  const o = road('o', 0, 300, { oneway: 1 });
  net2.addTile('t', [o]);
  const u = { road: o, s: 295, dir: 1, v: 30, dead: false };
  advance(u, 1, net2, rng);
  assert.equal(u.dead, true);
});

test('vehicle allocation: nearest roads first, bounded by budget, density by class', () => {
  const near = road('near', 0, 2000, { cls: 0 });
  const far = road('far', 0.5, 2000, { cls: 0 });
  const small = road('small', 0.0001, 2000, { cls: 6 });
  const rng = seeded(3);
  const all = allocate([far, small, near], { lon: 0, lat: 0 }, 1000, rng);
  assert.ok(all.get('near') > all.get('small'), 'motorways are denser than service roads');
  const tight = allocate([far, near], { lon: 0, lat: 0 }, 4, rng);
  assert.equal([...tight.values()].reduce((a, b) => a + b, 0), 4);
  assert.ok(tight.has('near') && !tight.has('far'));
  const v = spawnOn(roadFromWire(['ow', 0, -1, 0, 0, [0, 0, 0.01, 0]]), rng);
  assert.equal(v.dir, -1, 'reverse one-way spawns going backwards');
});

test('live links: measured speed drives vehicles, simulated roads underneath are suppressed', () => {
  const link = { id: '9', name: 'FDR', mph: 20, ageMin: 3, pts: [[-73.97, 40.75], [-73.969, 40.751], [-73.968, 40.752]] };
  const lr = liveRoad(link);
  assert.equal(lr.live, true);
  assert.ok(Math.abs(lr.speed - 8.9408) < 1e-3);
  assert.equal(lr.bucket, 'slow');
  assert.equal(bucketForMph(5).key, 'jam');
  assert.equal(bucketForMph(40).key, 'free');
  const idx = coverageIndex([link]);
  const over = roadFromWire(['osm1', 0, 0, 0, 0, [-73.97, 40.75, -73.969, 40.751, -73.968, 40.752]]);
  const elsewhere = roadFromWire(['osm2', 0, 0, 0, 0, [-73.9, 40.7, -73.899, 40.701]]);
  assert.equal(idx.covers(over), true);
  assert.equal(idx.covers(elsewhere), false);
  // a live link is a loop, never a transition
  const net = createNetwork();
  net.addTile('live', [lr]);
  const v = { road: lr, s: lr.len - 1, dir: 1, v: 30, dead: false };
  advance(v, 1, net);
  assert.equal(v.road, lr);
  assert.ok(v.s >= 0 && v.s < lr.len);
});
