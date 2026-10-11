import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, roadFromWire, positionAt } from '../src/layers/traffic/roads/network.js';
import { road } from './helpers/roads.mjs';

test('road geometry: length and position along a polyline', () => {
  const r = road(1, 0, 1000);
  assert.ok(Math.abs(r.len - 1000) < 2);
  const mid = positionAt(r, r.len / 2);
  assert.ok(Math.abs(mid.lon - 500 / 111320) < 1e-6);
  const end = positionAt(r, 5000); // clamps
  assert.ok(Math.abs(end.lon - 1000 / 111320) < 1e-6);
  assert.equal(roadFromWire([1, 0, 0, 0, 0, [0, 0, 0, 0.00001]]), null, 'tiny roads are dropped');
});

test('one-way roads are only entered at their upstream end', () => {
  const net = createNetwork();
  const a = road('a', 0, 400);
  const oneway = roadFromWire(['o', 3, 1, 0, 0, [400 / 111320, 0, 800 / 111320, 0]]);
  const against = roadFromWire(['x', 3, 1, 0, 0, [400 / 111320, 0.0001, 400 / 111320, 0.00001]]); // would be entered at its end
  net.addTile('t', [a, oneway, against]);
  const exits = net.exits(a, 1);
  const ids = exits.map((e) => e.road.id).sort();
  assert.deepEqual(ids, ['o']);
});

test('tile bookkeeping: shared roads survive until their last tile is dropped', () => {
  const net = createNetwork();
  const r = road('shared', 0, 300);
  const r2 = road('shared', 0, 300);
  net.addTile('t1', [r]);
  net.addTile('t2', [r2]);
  assert.equal(net.roads.size, 1);
  assert.equal(net.dropTile('t1').length, 0);
  assert.equal(net.roads.size, 1);
  assert.equal(net.dropTile('t2').length, 1);
  assert.equal(net.roads.size, 0);
  assert.equal(net.exits(r, 1).length, 0);
});
