/**
 * Render the local media playlist for a session. Segment URLs point back at
 * this proxy (never at the camera host) and carry the session token and the
 * viewer's lease, so the segment route can check both.
 *
 * @param {object} entry - Session with at least two cached segments.
 * @param {string} cameraId
 * @param {string} leaseId
 * @returns {string} M3U8 text.
 */
export function renderPlaylist(entry, cameraId, leaseId) {
  const segments = [...entry.segments.values()].sort((a, b) => a.seq - b.seq);
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...segments.map((s) => s.duration)))}`,
    `#EXT-X-MEDIA-SEQUENCE:${segments[0].seq}`,
    `#EXT-X-DISCONTINUITY-SEQUENCE:${entry.discontinuitiesRemoved}`,
  ];
  let previous;
  for (const segment of segments) {
    if (
      segment.discontinuity ||
      (previous !== undefined && segment.seq !== previous + 1)
    )
      lines.push('#EXT-X-DISCONTINUITY');
    lines.push(
      `#EXTINF:${segment.duration.toFixed(3)},`,
      `/api/cctv/media/${encodeURIComponent(cameraId)}/seg_${segment.seq}.ts?session=${entry.token}&lease=${encodeURIComponent(leaseId)}`,
    );
    previous = segment.seq;
  }
  return lines.join('\n') + '\n';
}
