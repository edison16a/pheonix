/**
 * Pure geometry for field-of-view fans. Nothing here touches Cesium, so it is
 * unit tested in node.
 */
const EARTH = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

/** Offset lat/lon (deg) by distance along a compass heading. */
export function project(lat, lon, headingDeg, distM) {
  const b = rad(headingDeg);
  const la = rad(lat);
  const ad = distM / EARTH;
  const la2 = Math.asin(Math.sin(la) * Math.cos(ad) + Math.cos(la) * Math.sin(ad) * Math.cos(b));
  const lo2 =
    rad(lon) +
    Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(la), Math.cos(ad) - Math.sin(la) * Math.sin(la2));
  return [(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI];
}

/** Exaggerated ground range: real range at street level, growing with altitude. */
export function fovRange(realRangeM, heightM) {
  return Math.max(realRangeM || 150, Math.min(heightM * 0.1, 2500));
}

/** Fan outline as [lon,lat] pairs: mount, then an arc across the field of view. */
export function fanPoints(cam, rangeM, steps = 10) {
  const half = (cam.fovDeg || 56) / 2;
  const pts = [[cam.lon, cam.lat]];
  for (let i = 0; i <= steps; i++) {
    pts.push(project(cam.lat, cam.lon, cam.headingDeg - half + (i * half * 2) / steps, rangeM));
  }
  return pts;
}

/** True when the server gave us a real heading for this camera. */
export const hasPose = (c) => Number.isFinite(c.headingDeg);
