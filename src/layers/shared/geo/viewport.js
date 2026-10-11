import { bboxContains } from './geo.js';

/**
 * Should a new fetch be made for `view`, given the box and time of the last
 * one? A fetch covers a padded box, so small camera moves are free.
 */
export function needsFetch(last, view, nowMs, { maxAgeMs = 10_000, minOverlap = 0 } = {}) {
  if (!last) return true;
  if (nowMs - last.at > maxAgeMs) return true;
  const c = [(view.west + view.east) / 2, (view.south + view.north) / 2];
  if (!bboxContains(last.bbox, c[0], c[1])) return true;
  const inside =
    bboxContains(last.bbox, view.west, view.south) && bboxContains(last.bbox, view.east, view.north);
  return !inside && minOverlap >= 0 && !coversMostly(last.bbox, view);
}

/** True when the box covers more than 85% of the view's area (a small gap at the edge is not worth a refetch). */
function coversMostly(box, view) {
  const w = Math.min(box.east, view.east) - Math.max(box.west, view.west);
  const h = Math.min(box.north, view.north) - Math.max(box.south, view.south);
  if (w <= 0 || h <= 0) return false;
  return (w * h) / ((view.east - view.west) * (view.north - view.south)) > 0.85;
}

/** Pad a box by a fraction of its size on every side (cheap over-fetch for pan reuse). */
export function pad(b, f = 0.25) {
  const dx = (b.east - b.west) * f;
  const dy = (b.north - b.south) * f;
  return { west: b.west - dx, east: b.east + dx, south: Math.max(-90, b.south - dy), north: Math.min(90, b.north + dy) };
}

/** Does box `outer` contain all of `inner`? */
export function covers(outer, inner) {
  return inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;
}
