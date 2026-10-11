import { getText, https } from '../shared/feedFetch.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { done, guard } from '../shared/loaderLog.js';
import { toFiniteNumber } from '../shared/numbers.js';

/** Hong Kong Transport Department traffic snapshot cameras (data.gov.hk). */
export const loadHongKongSources = guard('Hong Kong TD', async () => {
  const buf = await getText(
    'https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.csv',
    { binary: true },
  );
  const text =
    buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString('utf16le')
      : buf.toString('utf8');
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const head = lines
    .shift()
    .split('\t')
    .map((h) => h.trim());
  const col = (n) => head.indexOf(n);
  const list = [];
  for (const line of lines) {
    const c = line.split('\t');
    const key = c[col('key')]?.trim();
    const lat = toFiniteNumber(c[col('latitude')]);
    const lon = toFiniteNumber(c[col('longitude')]);
    const url = https(c[col('url')]?.trim());
    if (
      !key ||
      !isPlausibleLatLon(lat, lon) ||
      !/^https:\/\/tdcctv\.data\.one\.gov\.hk\//.test(url)
    )
      continue;
    list.push({
      id: `hk-${key}`,
      name: (c[col('description')] || key)
        .replace(/\s*\[[^\]]+\]\s*$/, '')
        .trim(),
      city: `${c[col('district')]?.trim() || 'Hong Kong'}, Hong Kong`,
      cityId: 'hong-kong',
      provider: 'HK Transport Department',
      lat,
      lon,
      feedType: 'image',
      url,
      sourceKind: 'hk-td',
    });
  }
  return done('Hong Kong', list);
});
