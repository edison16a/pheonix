import { isLiveFeed } from '../../cameras/registry.js';

export const isLive = (cam) => isLiveFeed(cam.feedType);

/** Rough ground distance in km; good enough for "is this camera near that place". */
export function distKm(c, v) {
  const dLat = (c.lat - v.lat) * 111;
  const dLon = (c.lon - v.lon) * 111 * Math.cos((v.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

/** Is this still camera returning a real frame right now? (Live streams are not probed.) */
async function cameraWorks(cam) {
  if (isLive(cam)) return true;
  try {
    const res = await fetch(`/api/cctv/frame/${encodeURIComponent(cam.id)}`, {
      signal: AbortSignal.timeout(6000),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ask `pick(skipIds)` for candidates until one actually works, giving up after a few.
 * Voice commands should open a camera that shows something, not a dead one.
 */
export async function firstWorking(pick) {
  const tried = new Set();
  for (let i = 0; i < 6; i++) {
    const cam = pick([...tried]);
    if (!cam) return null;
    if (await cameraWorks(cam)) return cam;
    tried.add(cam.id);
  }
  return null;
}
