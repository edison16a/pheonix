import { arcgisAll } from '../shared/arcgis.js';
import { https } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** NZ Transport Agency live cameras. */
export const loadNztaSources = guard('NZTA', async () => {
  const feats = await arcgisAll(
    'https://services.arcgis.com/XTtANUDT8Va4DLwI/arcgis/rest/services/LiveCamerasNZTA_Public_View/FeatureServer/0',
  );
  const list = [];
  for (const f of feats) {
    const a = f.attributes;
    const lat = toFiniteNumber(a.lat ?? f.geometry?.y);
    const lon = toFiniteNumber(a.lon ?? f.geometry?.x);
    const url = https(a.imageurl);
    if (String(a.offline) === 'true' || String(a.undermaintenance) === 'true')
      continue;
    if (
      !isPlausibleLatLon(lat, lon) ||
      !/^https:\/\/www\.trafficnz\.info\/camera\/\d+\.jpg$/i.test(url)
    )
      continue;
    list.push({
      id: `nz-${a.id}`,
      name: [a.name, a.direction].filter(Boolean).join(' - '),
      city: a.region ? `${a.region}, New Zealand` : 'New Zealand',
      cityId: 'new-zealand',
      provider: 'NZ Transport Agency',
      lat,
      lon,
      feedType: 'image',
      url,
      officialUrl: https(a.viewurl),
      sourceKind: 'nzta',
    });
  }
  return done('NZTA', list);
});
