import { getJson } from './feedFetch.js';

/** Page through an ArcGIS FeatureServer layer (WGS84). */
export async function arcgisAll(layerUrl, where = '1=1', pageSize = 1000) {
  const out = [];
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const q = new URLSearchParams({
      where,
      outFields: '*',
      outSR: '4326',
      f: 'json',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });
    const json = await getJson(`${layerUrl}/query?${q}`);
    if (json.error) throw new Error(json.error.message || 'arcgis error');
    const feats = json.features || [];
    out.push(...feats);
    if (!json.exceededTransferLimit || !feats.length) break;
  }
  return out;
}
