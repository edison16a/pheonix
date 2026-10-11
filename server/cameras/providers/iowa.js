import { arcgisAll } from '../shared/arcgis.js';
import { https } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** Iowa DOT (traffic, RWIS, rest areas) public ArcGIS layer. */
export const loadIowaSources = guard('Iowa DOT', async () => {
  const feats = await arcgisAll(
    'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0',
  );
  const list = [];
  for (const f of feats) {
    const a = f.attributes;
    const lat = toFiniteNumber(f.geometry?.y ?? a.latitude);
    const lon = toFiniteNumber(f.geometry?.x ?? a.longitude);
    const url = https(a.ImageURL);
    if (
      !isPlausibleLatLon(lat, lon) ||
      !/^https:\/\/atmsqf\.iowadot\.gov\//i.test(url)
    )
      continue;
    list.push({
      id: `ia-${a.device_id ?? a.FID}`,
      name: String(a.Desc_ || 'Iowa DOT camera').replace(
        /^(RWIS|CB|DM|CR|IC|QC|SC|DB|AM|WL|MC) - /,
        '',
      ),
      city: a.Route ? `Iowa, ${a.Route}` : 'Iowa',
      cityId: 'iowa',
      provider: 'Iowa DOT',
      lat,
      lon,
      feedType: 'image',
      url,
      sourceKind: 'iowa-dot',
    });
  }
  return done('Iowa DOT', list);
});
