/** Chip text for each status (shown lowercased). */
export const LABELS = {
  connecting: 'CONNECTING',
  live: 'LIVE',
  snapshot: 'SNAPSHOT',
  offline: 'OFFLINE',
  unavailable: 'UNAVAILABLE',
  paused: 'PAUSED',
};

const REASONS = {
  stalled: 'The stream stopped delivering video.',
  timeout: 'The camera did not respond in time.',
  stale: 'No new picture has arrived recently.',
  restricted: 'This provider does not allow embedding this camera.',
  'embed-restricted': 'This camera can only be viewed on the provider’s own page.',
};

/** Plain-language sentence for a reducer `reason` code, or '' when there is none. */
export const reasonText = (r) =>
  REASONS[r] ||
  (r?.startsWith('yt-') ? 'This stream cannot be played here.' : null) ||
  (r?.startsWith('http-') ? `The camera feed returned an error (${r.slice(5)}).` : r ? 'The camera feed could not be loaded.' : '');
