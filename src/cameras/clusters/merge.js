import { mercY } from './mercator.js';

/**
 * Merge cluster bubbles whose centres are closer than `minDeg` (lon and
 * mercator-lat degrees). Grid cells can leave two bubbles touching across a
 * cell edge, so this runs after the grid pass. Biggest clusters absorb first.
 */
export function mergeOverlapping(items, minDeg) {
  const clusters = items.filter((i) => i.type === 'cluster').sort((a, b) => b.count - a.count);
  if (clusters.length < 2) return items;
  const gone = new Set();
  const min2 = minDeg * minDeg;
  for (let i = 0; i < clusters.length; i++) {
    const a = clusters[i];
    if (gone.has(a)) continue;
    const ay = mercY(a.lat);
    for (let j = i + 1; j < clusters.length; j++) {
      const b = clusters[j];
      if (gone.has(b)) continue;
      const dx = a.lon - b.lon;
      const dy = ay - mercY(b.lat);
      if (dx * dx + dy * dy >= min2) continue;
      const n = a.count + b.count;
      a.lon = (a.lon * a.count + b.lon * b.count) / n;
      a.lat = (a.lat * a.count + b.lat * b.count) / n;
      a.count = n;
      a.live += b.live;
      a.members = a.members.concat(b.members);
      a.bbox = [
        Math.min(a.bbox[0], b.bbox[0]),
        Math.min(a.bbox[1], b.bbox[1]),
        Math.max(a.bbox[2], b.bbox[2]),
        Math.max(a.bbox[3], b.bbox[3]),
      ];
      gone.add(b);
    }
  }
  return gone.size ? items.filter((i) => !gone.has(i)) : items;
}
