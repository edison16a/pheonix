import test from 'node:test';
import assert from 'node:assert/strict';
import { nswCameraToSource } from '../server/cameras/providers/nsw.js';
import { vegvesenCameraToSource } from '../server/cameras/providers/vegvesen.js';
import { calgaryCameraToSource } from '../server/cameras/providers/calgary/normalize.js';
import { normalizeTxdotDistrictPayload } from '../server/cameras/providers/txdot/normalize.js';
import {
  parseTarkteeDatexImages,
  parseTarkteeDatexLocations,
} from '../server/cameras/providers/tarktee.js';
import { allocateSourceCap } from '../server/cameras/catalog/cap.js';
import { sanitizeCctvRangeHeader } from '../server/cameras/media/range.js';
import { parseHlsMedia } from '../server/cameras/media/hls/parse.js';
import { fetchCctvImageFromUpstream } from '../server/cameras/media/index.js';
import { sourceLimit } from '../server/cameras/shared/sourceLimit.js';
import { directionToHeading } from '../server/cameras/shared/directionText.js';

test('NSW feature becomes a camera with a compass heading from its direction', () => {
  const camera = nswCameraToSource({
    id: '42',
    geometry: { coordinates: [151.2, -33.9] },
    properties: {
      href: 'https://webcams.transport.nsw.gov.au/livetraffic-webcams/cameras/x.jpg',
      direction: 'N-E',
      title: '5 Ways (Miranda)',
      view: '5 Ways looking west',
      region: 'SYD_NORTH',
    },
  });
  assert.equal(camera.id, 'nsw-42');
  assert.equal(camera.headingDeg, 45);
  assert.equal(camera.headingConfidence, 'high');
  assert.equal(camera.name, '5 Ways looking west');
  assert.equal(camera.city, 'SYD NORTH');
});

test('NSW feature off the official image host is refused', () => {
  const camera = nswCameraToSource({
    id: '1',
    geometry: { coordinates: [151.2, -33.9] },
    properties: { href: 'https://evil.example/x.jpg' },
  });
  assert.equal(camera, null);
});

test('Vegvesen feature needs its still image on the agency host', () => {
  const feature = (stillImageUrl) => ({
    geometry: { coordinates: [10.75, 59.91] },
    properties: { cameraId: 'ab12', description: 'Oslo', stillImageUrl },
  });
  const ok = vegvesenCameraToSource(
    feature('https://kamera.atlas.vegvesen.no/api/images/ab12'),
  );
  assert.equal(ok.id, 'no-vegvesen-ab12');
  assert.equal(ok.feedType, 'image');
  assert.equal(
    vegvesenCameraToSource(feature('https://evil.example/ab12')),
    null,
  );
});

test('Calgary row without a heading signal gets the low-confidence fallback', () => {
  const camera = calgaryCameraToSource({
    point: { coordinates: [-114.06, 51.04] },
    camera_url: { url: 'http://trafficcam.calgary.ca/loc86.jpg' },
    camera_location: 'Bow Trail / 37 Street SW',
    quadrant: 'SW',
  });
  assert.equal(camera.id, 'calgary-86');
  assert.equal(camera.url, 'https://trafficcam.calgary.ca/loc86.jpg');
  assert.equal(camera.headingConfidence, 'low');
});

test('TxDOT district payload keeps online cameras once per device key', () => {
  const row = {
    statusDescription: 'Device Online',
    latitude: 30.27,
    longitude: -97.74,
    icd_Id: 'AUS-1',
    name: 'US-290 EB at Lamar',
    equipLoc: { roadway: 'US-290' },
  };
  const payload = {
    roadwayCctvStatuses: {
      a: [row, { ...row, statusDescription: 'Offline', icd_Id: 'AUS-2' }],
      b: [row],
    },
  };
  const cameras = normalizeTxdotDistrictPayload(payload, 'aus');
  assert.equal(cameras.length, 1);
  assert.equal(cameras[0].headingDeg, 90);
  assert.match(cameras[0].url, /icdId=AUS-1&districtCode=AUS$/);
});

test('Tarktee DATEX parsers pair locations with official image URLs', () => {
  const locations = parseTarkteeDatexLocations(
    '<predefinedLocation id="L1"><value>Tallinn</value><latitude>59.4</latitude><longitude>24.7</longitude></predefinedLocation>',
  );
  assert.deepEqual(locations.get('L1'), {
    name: 'Tallinn',
    lat: 59.4,
    lon: 24.7,
  });
  const images = parseTarkteeDatexImages(
    '<trafficView><linearPredefinedLocationReference id="L1"/><urlLinkAddress>https://tarktee.transpordiamet.ee/images/1/a.jpg</urlLinkAddress></trafficView>' +
      '<trafficView><linearPredefinedLocationReference id="L2"/><urlLinkAddress>https://evil.example/b.jpg</urlLinkAddress></trafficView>',
  );
  assert.equal(images.size, 1);
  assert.equal(
    images.get('L1'),
    'https://tarktee.transpordiamet.ee/images/1/a.jpg',
  );
});

test('catalog cap is shared round-robin and later packs win duplicate ids', () => {
  const pack = (name, ids) => ({ name, sources: ids.map((id) => ({ id })) });
  const { sources, packs } = allocateSourceCap(
    [pack('a', ['1', '2', '3']), pack('b', ['x', '2'])],
    3,
  );
  assert.deepEqual(
    sources.map((s) => s.id),
    ['1', 'x', '3'],
  );
  assert.deepEqual(
    packs.map((p) => p.kept),
    [2, 1],
  );
});

test('Range header: single bounded ranges pass, everything else is dropped', () => {
  assert.equal(sanitizeCctvRangeHeader('bytes=0-99'), 'bytes=0-99');
  assert.equal(sanitizeCctvRangeHeader('bytes=0-10,20-30'), '');
  assert.equal(sanitizeCctvRangeHeader('bytes=-0'), '');
  assert.equal(sanitizeCctvRangeHeader(undefined), '');
  assert.equal(sanitizeCctvRangeHeader('bytes=5-', 100), 'bytes=5-104');
});

test('HLS parser accepts clear MPEG-TS lists and refuses encrypted ones', () => {
  const list = [
    '#EXTM3U',
    '#EXT-X-MEDIA-SEQUENCE:7',
    '#EXTINF:2.0,',
    'a.ts',
    '#EXTINF:2.0,',
    'b.ts',
  ].join('\n');
  const segments = parseHlsMedia(list, 'https://h.example/live/p.m3u8');
  assert.deepEqual(
    segments.map((s) => s.seq),
    [7, 8],
  );
  assert.equal(segments[0].uri, 'https://h.example/live/a.ts');
  assert.throws(() =>
    parseHlsMedia(
      `${list}\n#EXT-X-KEY:METHOD=AES-128`,
      'https://h.example/p.m3u8',
    ),
  );
});

test('frame fetch follows redirects only within the same origin', async () => {
  const redirect = (location) => ({
    status: 302,
    headers: new Headers({ location }),
    body: null,
  });
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const image = {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    body: new Response(jpeg).body,
  };
  const sameHost = await fetchCctvImageFromUpstream(
    'https://cam.example/a.jpg',
    {
      fetchImpl: async (url) =>
        url.endsWith('/a.jpg') ? redirect('/b.jpg') : image,
    },
  );
  assert.equal(sameHost.contentType, 'image/jpeg');
  const offHost = await fetchCctvImageFromUpstream(
    'https://cam.example/a.jpg',
    {
      fetchImpl: async () => redirect('https://other.example/b.jpg'),
    },
  );
  assert.equal(offHost, null);
});

test('per-pack cap reads its env variable within [8, 20000]', () => {
  const key = 'CCTV_TEST_PACK_MAX_SOURCES';
  try {
    assert.equal(sourceLimit(key), 20000);
    process.env[key] = '3';
    assert.equal(sourceLimit(key), 8);
    process.env[key] = '500.9';
    assert.equal(sourceLimit(key), 500);
    process.env[key] = 'abc';
    assert.equal(sourceLimit(key), 20000);
  } finally {
    delete process.env[key];
  }
});

test('bare cardinal words only count in dedicated direction fields', () => {
  assert.ok(Number.isNaN(directionToHeading('5TH ST / WEST AVE')));
  assert.equal(directionToHeading('West', true), 270);
  assert.equal(directionToHeading('US 13 SB @ Main'), 180);
});
