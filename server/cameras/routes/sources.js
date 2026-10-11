import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { normalizeFeedType } from '../shared/feedType.js';

/** Memoised lean catalogue payload: JSON + gzip + ETag, rebuilt only when the catalogue array changes. */
let leanMemo = { src: null, json: '', gzip: null, etag: '' };

function leanSourcesBody(sources) {
  if (leanMemo.src === sources) return leanMemo;
  const r5 = (n) => Math.round(n * 1e5) / 1e5;
  const cameras = sources
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
    .map((c) => {
      const o = {
        id: c.id,
        name: c.name,
        city: c.city || '',
        provider: c.provider,
        lat: r5(c.lat),
        lon: r5(c.lon),
        feedType: normalizeFeedType(c.feedType),
      };
      // Pose is sent only where the heading is derived from the provider's own
      // direction data; id-hash fallback headings are never published.
      if (c.headingConfidence === 'high' && Number.isFinite(c.headingDeg)) {
        o.headingDeg = Math.round(c.headingDeg * 10) / 10;
        o.headingConfidence = 'high';
        if (Number.isFinite(c.fovDeg)) o.fovDeg = Math.round(c.fovDeg);
        if (Number.isFinite(c.rangeM)) o.rangeM = Math.round(c.rangeM);
        if (Number.isFinite(c.pitchDeg)) o.pitchDeg = Math.round(c.pitchDeg);
      }
      if (c.embedId) o.embedId = c.embedId;
      if (c.credit) o.credit = c.credit;
      if (c.license) o.license = c.license;
      if (c.officialUrl) o.officialUrl = c.officialUrl;
      return o;
    });
  const json = JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: cameras.length,
    cameras,
  });
  const gzip = gzipSync(json);
  const etag = `"${createHash('sha1')
    .update(json.slice(json.indexOf('"cameras"')))
    .digest('hex')
    .slice(0, 16)}"`;
  leanMemo = { src: sources, json, gzip, etag };
  return leanMemo;
}

/**
 * GET /api/cctv/sources: the whole catalogue in its lean client shape, gzipped
 * when the browser accepts it. The ETag covers the camera list only (not the
 * timestamp), so a re-fetch of an unchanged catalogue answers 304.
 */
export function handleSources({ req, res, sources }) {
  const body = leanSourcesBody(sources);
  const inm = req.headers['if-none-match'];
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ETag: body.etag,
    'Cache-Control': 'public, max-age=300, must-revalidate',
    Vary: 'Accept-Encoding',
  };
  if (inm === body.etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gz) headers['Content-Encoding'] = 'gzip';
  res.writeHead(200, headers);
  res.end(gz ? body.gzip : body.json);
}
