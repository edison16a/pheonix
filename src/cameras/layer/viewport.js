import * as Cesium from 'cesium';

export const WORLD = [-180, -90, 180, 90];

/**
 * What the camera can see, as [west, south, east, north] in degrees, padded by
 * 10% so markers just off screen are ready before you pan to them. Falls back
 * to the whole world when the view includes space (no rectangle).
 */
export function currentBbox(viewer) {
  const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!rect) return WORLD;
  const d = Cesium.Math.toDegrees;
  const w = d(rect.west);
  const e = d(rect.east);
  const padLat = Math.max(0.05, (d(rect.north) - d(rect.south)) * 0.1);
  const padLon = Math.max(0.05, (e >= w ? e - w : e + 360 - w) * 0.1);
  return [
    Math.max(-180, w - padLon),
    Math.max(-90, d(rect.south) - padLat),
    Math.min(180, e + padLon),
    Math.min(90, d(rect.north) + padLat),
  ];
}
