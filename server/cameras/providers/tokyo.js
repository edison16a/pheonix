/**
 * Tokyo Metropolitan Government open data (CC BY): river monitoring cameras and
 * Izu/Ogasawara port cameras. The CSV lists give each camera's coordinates and
 * its YouTube live URL.
 */
import {
  CCTV_SOURCE_FETCH_TIMEOUT_MS,
  PROXY_USER_AGENT,
} from '../shared/upstream.js';
import { parseCsv } from '../shared/csv.js';
import {
  embedToSource,
  verifyEmbeds,
  youtubeIdFromUrl,
} from '../shared/youtubeEmbeds.js';

/** GET a URL as bytes (the CSVs are not UTF-8, so the caller decodes them). */
async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': PROXY_USER_AGENT },
    signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const TOKYO_RIVER_CSV =
  'https://www.opendata.metro.tokyo.lg.jp/kensetsu/R4/130001_river-monitoring-cameras.csv';

const TOKYO_ISLANDS_CSV =
  'https://www.opendata.metro.tokyo.lg.jp/kouwan/position_information_of_port_live_cameras_at_Izu-Ogasawara_Islands.csv';

/** Fields every Tokyo open-data entry shares. */
const TOKYO_META = {
  cityId: 'tokyo',
  license: 'CC BY 4.0 (Tokyo Metropolitan Government Open Data)',
};

/** Tokyo Metropolitan Government river monitoring cameras (official live streams). */
export async function loadTokyoRiverSources() {
  try {
    const rows = parseCsv(
      new TextDecoder('utf-8')
        .decode(await fetchBuf(TOKYO_RIVER_CSV))
        .replace(/^\uFEFF/, ''),
    ).slice(1);
    const entries = [];
    for (const r of rows) {
      const youtubeId = youtubeIdFromUrl(r[3]);
      const lat = Number(r[4]);
      const lon = Number(r[5]);
      if (!youtubeId || !Number.isFinite(lat) || !Number.isFinite(lon))
        continue;
      entries.push({
        ...TOKYO_META,
        id: `tokyo-river-${r[0]}`,
        youtubeId,
        name: `${r[1]} (${r[2]})`,
        city: 'Tokyo',
        lat,
        lon,
        provider: 'Tokyo Metropolitan Government',
        credit: 'Tokyo Metropolitan Government, Bureau of Construction',
        officialUrl: 'https://www.kasen-suibo.metro.tokyo.lg.jp/',
      });
    }
    const ok = await verifyEmbeds(entries);
    console.log(
      `[CCTV] Loaded Tokyo river cameras: ${ok.length}/${entries.length} verified embeddable`,
    );
    return ok.map(embedToSource);
  } catch (error) {
    console.warn('[CCTV] Tokyo river cameras failed:', error?.message || error);
    return [];
  }
}

/** Tokyo Port and Harbor Bureau live cameras, Izu and Ogasawara islands. */
export async function loadTokyoIslandPortSources() {
  try {
    const text = new TextDecoder('shift_jis').decode(
      await fetchBuf(TOKYO_ISLANDS_CSV),
    );
    const entries = [];
    for (const r of parseCsv(text).slice(1)) {
      const youtubeId = youtubeIdFromUrl(r[5]);
      const [lat, lon] = String(r[4]).split(',').map(Number);
      if (!youtubeId || !Number.isFinite(lat) || !Number.isFinite(lon))
        continue;
      entries.push({
        ...TOKYO_META,
        id: `tokyo-port-${r[0]}`,
        youtubeId,
        name: String(r[2]).trim(),
        city: 'Tokyo Islands',
        lat,
        lon,
        provider: 'Tokyo Port and Harbor Bureau',
        credit: 'Tokyo Metropolitan Government, Port and Harbor Bureau',
        officialUrl:
          'https://catalog.data.metro.tokyo.lg.jp/dataset/t000015d0000000040',
      });
    }
    const ok = await verifyEmbeds(entries);
    console.log(
      `[CCTV] Loaded Tokyo island port cameras: ${ok.length}/${entries.length} verified embeddable`,
    );
    return ok.map(embedToSource);
  } catch (error) {
    console.warn(
      '[CCTV] Tokyo island port cameras failed:',
      error?.message || error,
    );
    return [];
  }
}
