/**
 * Turns a raw server record into a camera, or null when it is unusable.
 * Pose (heading, field of view, range) is copied only when the server says
 * it is confident. We never invent a direction.
 */
export function normalizeCamera(raw) {
  if (!raw || raw.id == null) return null;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const feedType = String(raw.feedType || 'image');
  return {
    id: String(raw.id),
    name: String(raw.name || raw.id),
    city: String(raw.city || ''),
    provider: String(raw.provider || ''),
    lat,
    lon,
    feedType,
    status: 'unknown',
    license: raw.license || '',
    credit: raw.credit || '',
    officialUrl: raw.officialUrl || '',
    ...(/^[\w-]{11}$/.test(raw.embedId || '') ? { embedId: raw.embedId } : {}),
    ...(Number.isFinite(Number(raw.headingDeg)) && raw.headingConfidence === 'high'
      ? {
          headingDeg: Number(raw.headingDeg),
          fovDeg: Number(raw.fovDeg) || 56,
          rangeM: Number(raw.rangeM) || 180,
          pitchDeg: Number.isFinite(Number(raw.pitchDeg)) ? Number(raw.pitchDeg) : -20,
        }
      : {}),
  };
}
