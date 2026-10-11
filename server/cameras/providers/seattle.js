import { getJson } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';

/** Seattle DOT + WSDOT (Puget Sound), from the City of Seattle Travelers map data. */
export const loadSeattleSources = guard('Seattle', async () => {
  const json = await getJson(
    'https://web.seattle.gov/Travelers/api/Map/Data?zoomId=13&type=2',
  );
  const list = [];
  for (const f of json.Features || []) {
    const [lat, lon] = f.PointCoordinate || [];
    if (!isPlausibleLatLon(lat, lon)) continue;
    for (const cam of f.Cameras || []) {
      const file = String(cam.ImageUrl || '');
      if (!/^[\w.\-]+\.jpe?g$/i.test(file)) continue;
      const wsdot = cam.Type === 'wsdot';
      list.push({
        id: `sea-${cam.Id}`,
        name: String(cam.Description || cam.Id),
        city: 'Seattle',
        cityId: 'seattle',
        provider: wsdot ? 'WSDOT' : 'Seattle DOT',
        lat,
        lon,
        feedType: 'image',
        url: wsdot
          ? `https://images.wsdot.wa.gov/nw/${file}`
          : `https://www.seattle.gov/trafficcams/images/${file}`,
        sourceKind: 'seattle-travelers',
      });
    }
  }
  return done('Seattle', list);
});
