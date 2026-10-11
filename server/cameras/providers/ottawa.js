import { getJson } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** City of Ottawa traffic cameras (City + MTO), still images. */
export const loadOttawaSources = guard('Ottawa', async () => {
  const rows = await getJson('https://traffic.ottawa.ca/beta/camera_list');
  const list = [];
  for (const r of rows) {
    const lat = toFiniteNumber(r.latitude);
    const lon = toFiniteNumber(r.longitude);
    if (!isPlausibleLatLon(lat, lon) || !Number.isInteger(r.id)) continue;
    list.push({
      id: `ott-${r.id}`,
      name: String(r.description || `Ottawa camera ${r.id}`).replace(
        /^\((MTO|CITY)\)\s*/i,
        '',
      ),
      city: 'Ottawa',
      cityId: 'ottawa',
      provider:
        r.type === 'MTO' ? 'Ontario MTO via City of Ottawa' : 'City of Ottawa',
      lat,
      lon,
      feedType: 'image',
      url: `https://traffic.ottawa.ca/beta/camera?id=${r.id}`,
      sourceKind: 'ottawa-traffic',
    });
  }
  return done('Ottawa', list);
});
