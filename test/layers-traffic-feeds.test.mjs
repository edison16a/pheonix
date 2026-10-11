import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNyc, freshLinks, plausible, nyLocalToMs, msToNyLocal } from '../server/providers/traffic/nyc.js';
import { compactOverpass, tileQuery } from '../server/providers/overpass/index.js';
import { haversineM } from '../src/layers/shared/geo/index.js';

test('nyc dot feed: newest valid reading per link, timezone-correct age', () => {
  assert.equal(new Date(nyLocalToMs('2026-10-10T23:16:06.000')).toISOString(), '2026-10-11T03:16:06.000Z'); // EDT
  assert.equal(new Date(nyLocalToMs('2026-01-10T23:16:06.000')).toISOString(), '2026-01-11T04:16:06.000Z'); // EST
  assert.equal(msToNyLocal(Date.parse('2026-10-11T03:16:06Z')), '2026-10-10T23:16:06');
  const now = Date.parse('2026-10-11T03:36:06Z');
  const pts = '40.7,-73.9 40.71,-73.91';
  const rows = [
    { link_id: '1', speed: '30', travel_time: '60', data_as_of: '2026-10-10T23:10:00.000', link_points: pts, link_name: 'A', borough: 'Queens' },
    { link_id: '1', speed: '12', travel_time: '90', data_as_of: '2026-10-10T23:16:06.000', link_points: pts, link_name: 'A', borough: 'Queens' },
    { link_id: '2', speed: '0', travel_time: '0', data_as_of: '2026-10-10T23:16:06.000', link_points: pts },
    { link_id: '3', speed: '40', travel_time: '50', data_as_of: '2026-10-10T18:00:00.000', link_points: pts },
    { link_id: '4', speed: '40', travel_time: '50', data_as_of: '2026-10-10T23:16:06.000', link_points: '40.7,-73.9' },
  ];
  const links = freshLinks(parseNyc(rows, now), 45).links;
  assert.equal(links.length, 1);
  assert.equal(links[0].mph, 12);
  assert.equal(links[0].ageMin, 20);
  assert.deepEqual(links[0].pts[0], [-73.9, 40.7]); // lon,lat order
  assert.equal(plausible([[-73.9, 40.7], [-73.8, 40.7]]), false, 'a 8 km jump between vertices is corrupt');
  assert.equal(plausible([[-73.9, 40.7], [0, 0]]), false);
  assert.equal(plausible([[-73.9, 40.7], [-73.899, 40.701]]), true);
  const all = parseNyc(rows.slice(0, 1).concat(rows.slice(3, 4)).map((r, k) => ({ ...r, link_id: `x${k}` })), now);
  assert.equal(all.length, 2, 'parse keeps every age');
  const f = freshLinks(all, 45);
  assert.equal(f.links.length, 1, 'only readings under the limit are live');
  assert.equal(f.newestAgeMin, 26);
  assert.deepEqual(freshLinks(parseNyc(rows.slice(3, 4), now), 45), { links: [], newestAgeMin: 336 });
});

test('overpass fallback: compacts ways and bounds the query', () => {
  const json = {
    elements: [
      { type: 'way', id: 5, nodes: [10, 11, 12], tags: { highway: 'motorway_link' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }, { lat: 1.2, lon: 2.2 }] },
      { type: 'way', id: 6, nodes: [1, 2], tags: { highway: 'footway' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }] },
      { type: 'node', id: 7 },
      { type: 'way', id: 8, nodes: [3, 4], tags: { highway: 'residential', oneway: '-1' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1, lon: 3 }] },
    ],
  };
  const out = compactOverpass(json);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].slice(0, 5), [5, 0, 1, 10, 12]);
  assert.deepEqual(out[1].slice(0, 3), [8, 5, -1]);
  const q = tileQuery('major', { south: 1, west: 2, north: 1.02, east: 2.02 });
  assert.match(q, /\(1\.00000,2\.00000,1\.02000,2\.02000\)/);
  assert.ok(haversineM(0, 0, 0, 1) > 111000);
});
