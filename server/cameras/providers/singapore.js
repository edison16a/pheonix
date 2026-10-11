import { getJson } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** Singapore LTA traffic images via data.gov.sg. Image URLs rotate each minute;
 * the frame proxy resolves them through `resolveSingaporeFrame`. */
const SG_API = 'https://api.data.gov.sg/v1/transport/traffic-images';
let sgCache = { at: 0, map: new Map() };
async function singaporeMap() {
  if (Date.now() - sgCache.at < 30_000 && sgCache.map.size) return sgCache.map;
  const json = await getJson(SG_API);
  const map = new Map();
  for (const cam of json.items?.[0]?.cameras || []) {
    if (/^https:\/\/images\.data\.gov\.sg\//.test(cam.image || ''))
      map.set(String(cam.camera_id), { image: cam.image, loc: cam.location });
  }
  sgCache = { at: Date.now(), map };
  return map;
}

/** Current frame URL for one Singapore camera, for the frame route. */
export async function resolveSingaporeFrame(source) {
  const id = String(source.id).replace(/^sg-/, '');
  return (await singaporeMap()).get(id)?.image || '';
}
export const loadSingaporeSources = guard('Singapore LTA', async () => {
  const map = await singaporeMap();
  const list = [];
  for (const [id, v] of map) {
    const lat = toFiniteNumber(v.loc?.latitude);
    const lon = toFiniteNumber(v.loc?.longitude);
    if (!isPlausibleLatLon(lat, lon)) continue;
    list.push({
      id: `sg-${id}`,
      name: `Singapore traffic camera ${id}`,
      city: 'Singapore',
      cityId: 'singapore',
      provider: 'Singapore LTA',
      lat,
      lon,
      feedType: 'image',
      url: v.image,
      snapshotUrl: v.image,
      sourceKind: 'sg-lta',
    });
  }
  return done('Singapore', list);
});
