import test from 'node:test';
import assert from 'node:assert/strict';
import {
  altitudeRgb,
  classifyAircraft,
  glyphShapeFor,
  modelSpecFor,
} from '../src/layers/aircraft/classify/index.js';
import {
  needsRequery,
  radiusForRange,
} from '../src/layers/aircraft/feed/viewport.js';

test("type codes map to the original God's Eye View classes", () => {
  assert.equal(classifyAircraft({ typeCode: 'B789' }), 'widebody');
  assert.equal(classifyAircraft({ typeCode: 'b744' }), 'quadjet');
  assert.equal(classifyAircraft({ typeCode: 'A320' }), 'airliner');
  assert.equal(classifyAircraft({ typeCode: 'AT72' }), 'turboprop');
  assert.equal(classifyAircraft({ typeCode: 'C172' }), 'light');
  assert.equal(classifyAircraft({ typeCode: 'EC35' }), 'helicopter');
  assert.equal(classifyAircraft({ typeCode: 'C525' }), 'bizjet');
  assert.equal(classifyAircraft({ typeCode: 'F16' }), 'fastjet');
});

test('unknown type falls back to the emitter category, then to airliner', () => {
  assert.equal(
    classifyAircraft({ typeCode: '', category: 'A7' }),
    'helicopter',
  );
  assert.equal(classifyAircraft({ typeCode: '', category: 'A1' }), 'light');
  assert.equal(classifyAircraft({}), 'airliner');
});

test('every class has a model and a glyph shape', () => {
  for (const k of [
    'light',
    'glider',
    'turboprop',
    'airliner',
    'widebody',
    'quadjet',
    'helicopter',
    'fastjet',
    'bizjet',
    'uav',
  ]) {
    const spec = modelSpecFor(k);
    assert.match(spec.url, /^\/models\/.+\.glb$/);
    assert.ok(spec.scale > 0 && spec.radiusM > 0);
    assert.ok(['jet', 'prop', 'delta', 'heli'].includes(glyphShapeFor(k)));
  }
  assert.equal(modelSpecFor('helicopter').url, '/models/bell206.glb');
  assert.equal(modelSpecFor('widebody').url, '/models/b789.glb');
});

test('altitude ramp runs from orange (low) to cyan (cruise) and clamps', () => {
  const low = altitudeRgb(0);
  const high = altitudeRgb(40000);
  assert.deepEqual(low, [255, 122, 26]);
  assert.ok(high[2] > high[0], 'cruise is bluish');
  assert.deepEqual(altitudeRgb(-500), low);
  assert.deepEqual(altitudeRgb(90000), altitudeRgb(42000));
  assert.deepEqual(altitudeRgb(NaN), low);
  const mid = altitudeRgb(4000);
  assert.ok(mid[1] > low[1] && mid[1] < 190);
});

test('feed sizing: radius follows the camera range, requery only on a real change', () => {
  assert.equal(radiusForRange(500), 40);
  assert.ok(radiusForRange(200_000) > 80);
  assert.equal(radiusForRange(1_000_000), 450);
  assert.equal(radiusForRange(50_000_000), 450);
  const last = { lat: 51.5, lon: 0, radiusNm: 100 };
  assert.equal(needsRequery(null, last), true);
  assert.equal(
    needsRequery(last, { lat: 51.55, lon: 0.05, radiusNm: 100 }),
    false,
  );
  assert.equal(needsRequery(last, { lat: 53.5, lon: 0, radiusNm: 100 }), true);
  assert.equal(needsRequery(last, { lat: 51.5, lon: 0, radiusNm: 300 }), true);
});
