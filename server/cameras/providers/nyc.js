import { getJson } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** NYC DOT Traffic Management Center (~950 cameras). */
export const loadNycSources = guard('NYC DOT', async () => {
  const rows = await getJson('https://webcams.nyctmc.org/api/cameras');
  const list = [];
  for (const r of rows) {
    if (String(r.isOnline) !== 'true') continue;
    const lat = toFiniteNumber(r.latitude);
    const lon = toFiniteNumber(r.longitude);
    if (!isPlausibleLatLon(lat, lon) || !r.id) continue;
    list.push({
      id: `nyc-${r.id}`,
      name: String(r.name || 'NYC DOT camera'),
      city: r.area ? `${r.area}, New York` : 'New York',
      cityId: 'new-york',
      provider: 'NYC DOT',
      lat,
      lon,
      feedType: 'image',
      url: `https://webcams.nyctmc.org/api/cameras/${r.id}/image`,
      sourceKind: 'nyc-dot',
    });
  }
  return done('NYC DOT', list);
});
