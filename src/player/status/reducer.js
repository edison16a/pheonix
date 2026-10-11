/**
 * Real playback status. A pure reducer: the UI only ever shows what these
 * events, taken from actual media and network behaviour, justify. Nothing here
 * is timer-faked. LIVE needs the playback clock to advance, SNAPSHOT needs a
 * frame that actually arrived.
 */
export const STALL_MS = 9000;
export const CONNECT_TIMEOUT_MS = 25000;

/** @param {'video'|'snapshot'|'embed'} kind */
export function initialState(kind, now = 0) {
  return {
    kind,
    status: kind === 'embed' ? 'unavailable' : 'connecting',
    startedAt: now,
    lastTime: -1,
    lastProgressAt: 0,
    lastFrameAt: 0,
    failures: 0,
    reason: kind === 'embed' ? 'embed-restricted' : '',
  };
}

export function reduce(state, ev) {
  const s = { ...state };
  switch (ev.type) {
    case 'timeupdate':
      // LIVE only while the playback clock actually advances: the first
      // sample is only a baseline, a later, larger one is progress.
      if (s.lastTime < 0) {
        s.lastTime = ev.currentTime;
        return s;
      }
      if (ev.currentTime > s.lastTime + 0.01) {
        s.lastTime = ev.currentTime;
        s.lastProgressAt = ev.now;
        if (s.status !== 'unavailable') {
          s.status = 'live';
          s.reason = '';
        }
      }
      return s;
    case 'frame-ok':
      s.status = 'snapshot';
      s.lastFrameAt = ev.now;
      s.failures = 0;
      s.reason = '';
      return s;
    case 'frame-fail':
      // 403 and 451 mean the provider refuses us, so retrying is pointless.
      if (ev.code === 403 || ev.code === 451) {
        s.status = 'unavailable';
        s.reason = 'restricted';
        return s;
      }
      s.failures += 1;
      if (s.failures >= 2) {
        s.status = 'offline';
        s.reason = ev.code ? `http-${ev.code}` : 'network';
      }
      return s;
    case 'error':
      s.status = ev.restricted ? 'unavailable' : 'offline';
      s.reason = ev.reason || 'error';
      return s;
    case 'tick': {
      if (s.kind === 'video') {
        if (s.status === 'live' && ev.now - s.lastProgressAt > STALL_MS) {
          s.status = 'offline';
          s.reason = 'stalled';
        } else if (s.status === 'connecting' && ev.now - s.startedAt > CONNECT_TIMEOUT_MS) {
          s.status = 'offline';
          s.reason = 'timeout';
        }
      } else if (s.kind === 'snapshot') {
        const stale = ev.staleMs ?? 60000;
        if (s.status === 'snapshot' && ev.now - s.lastFrameAt > stale) {
          s.status = 'offline';
          s.reason = 'stale';
        }
      }
      return s;
    }
    case 'paused':
      s.status = 'paused';
      return s;
    default:
      return s;
  }
}
