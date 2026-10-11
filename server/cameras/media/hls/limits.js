/**
 * Hard bounds for HLS relaying: how many camera sessions and viewer leases may
 * exist, how large playlists, segments and a whole session cache may grow, and
 * the timings (in ms) for polling, idling out and waiting for the first
 * segments. Nothing in the relay grows past these.
 */
export const HLS_LIMITS = Object.freeze({
  sessions: 2,
  leasesPerSession: 8,
  playlistBytes: 256 * 1024,
  segmentBytes: 4 * 1024 * 1024,
  sessionBytes: 24 * 1024 * 1024,
  segments: 12,
  pollMs: 2000,
  idleMs: 15000,
  timeoutMs: 10000,
  readyMs: 12000,
});
