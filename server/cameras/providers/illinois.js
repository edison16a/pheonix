import { arcgisAll } from '../shared/arcgis.js';
import { https } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** Illinois Gateway / IDOT cameras (travelmidwest snapshots). */
export const loadIllinoisSources = guard('Illinois', async () => {
  const feats = await arcgisAll(
    'https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0',
    "TooOld='false'",
    2000,
  );
  const list = [];
  for (const f of feats) {
    const a = f.attributes;
    const lat = toFiniteNumber(f.geometry?.y ?? a.y);
    const lon = toFiniteNumber(f.geometry?.x ?? a.x);
    const url = https(a.SnapShot);
    if (
      !isPlausibleLatLon(lat, lon) ||
      !/^https:\/\/cctv\.travelmidwest\.com\//i.test(url)
    )
      continue;
    list.push({
      id: `il-${a.OBJECTID}`,
      name: String(a.CameraLocation || 'Illinois camera').trim(),
      city: 'Illinois',
      cityId: 'illinois',
      provider: 'Illinois DOT / Gateway',
      lat,
      lon,
      feedType: 'image',
      url,
      officialUrl:
        a.ImgPath && /^https:\/\/travelmidwest\.com\//.test(a.ImgPath)
          ? a.ImgPath
          : '',
      sourceKind: 'illinois-gateway',
    });
  }
  return done('Illinois', list);
});
