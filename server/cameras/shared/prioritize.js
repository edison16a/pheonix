import { haversineKm } from './geo.js';

/**
 * Distance-prioritizes cameras to a cap: keeps the maxCount cameras closest
 * to ANY of the given anchor points (min distance over anchors), tie-broken
 * by original array order. Every live pack uses it (Austin: one downtown
 * anchor; Caltrans: one anchor per major CA metro; TfL: central London) so a
 * cap always keeps the densest, most interesting cores.
 *
 * @param {Array<object>} cameras - Normalized camera source objects.
 * @param {number} maxCount - Cap (<=0 or >= length disables).
 * @param {Array<{lat:number,lon:number}>} anchors - At least one anchor.
 * @returns {Array<object>} Capped, priority-ordered camera list.
 */
export function prioritizeSources(cameras, maxCount, anchors) {
  const list = Array.isArray(cameras) ? cameras : [];
  const anchorList = (Array.isArray(anchors) ? anchors : []).filter(
    (a) => Number.isFinite(a?.lat) && Number.isFinite(a?.lon),
  );
  if (!anchorList.length) return list;
  // Always sort when anchors exist, even when the pack fits its own cap: the
  // catalog-wide cap (catalog/cap.js) thins a pack from the END of this order,
  // so "nearest to an anchor first" has to hold whether or not the pack was
  // trimmed here.
  const cap =
    Number.isFinite(maxCount) && maxCount > 0
      ? Math.min(maxCount, list.length)
      : list.length;

  const scored = list.map((camera, idx) => {
    const lat = Number(camera?.lat);
    const lon = Number(camera?.lon);
    const distKm =
      Number.isFinite(lat) && Number.isFinite(lon)
        ? Math.min(
            ...anchorList.map((a) => haversineKm(lat, lon, a.lat, a.lon)),
          )
        : Number.POSITIVE_INFINITY;
    return { camera, idx, distKm };
  });

  scored.sort((a, b) => {
    if (a.distKm !== b.distKm) return a.distKm - b.distKm;
    return a.idx - b.idx;
  });

  return scored.slice(0, cap).map((entry) => entry.camera);
}
