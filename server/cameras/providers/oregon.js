import { arcgisAll } from '../shared/arcgis.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** Oregon DOT TripCheck cameras. */
export const loadOregonSources = guard('Oregon TripCheck', async () => {
  const feats = await arcgisAll(
    'https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/TripCheck_Cameras/FeatureServer/0',
  );
  const list = [];
  for (const f of feats) {
    const a = f.attributes;
    const lat = toFiniteNumber(a.attributes_latitude ?? f.geometry?.y);
    const lon = toFiniteNumber(a.attributes_longitude ?? f.geometry?.x);
    let url = '';
    try {
      url = new URL(String(a.attributes_filename || '')).href;
    } catch {
      continue;
    }
    if (
      !isPlausibleLatLon(lat, lon) ||
      !/^https:\/\/tripcheck\.com\/RoadCams\//i.test(url)
    )
      continue;
    list.push({
      id: `or-${a.attributes_cameraId ?? a.ObjectId}`,
      name: String(a.attributes_title || 'Oregon camera').trim(),
      city: 'Oregon',
      cityId: 'oregon',
      provider: 'ODOT TripCheck',
      lat,
      lon,
      feedType: 'image',
      url,
      officialUrl: 'https://tripcheck.com/',
      sourceKind: 'oregon-tripcheck',
    });
  }
  return done('Oregon', list);
});
