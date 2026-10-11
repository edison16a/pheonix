/** Fetching road tiles from /api/traffic/roads into the in-memory network. */
import { pool } from '../../shared/data/index.js';
import { roadFromWire } from './network.js';
import { MAX_RETAINED_TILES } from '../policy.js';

/**
 * Forget the tiles furthest from the view once more than MAX_RETAINED_TILES are
 * held, so panning around a city doesn't grow the network without limit. The
 * 'live' pseudo tile (measured NYC links) is never dropped here.
 */
export function dropFarTiles(state, wanted) {
  const keys = state.net.tileKeys().filter((k) => k !== 'live');
  if (keys.length <= MAX_RETAINED_TILES) return;
  for (const k of keys.filter((k) => !wanted.has(k)).slice(0, keys.length - MAX_RETAINED_TILES)) {
    state.net.dropTile(k);
    state.loaded.delete(k);
  }
}

/**
 * Fetch `todo` tiles four at a time. `onTile` runs after each one lands in the
 * network (the caller rebalances the vehicles then, so dots appear tile by tile).
 * Returns how many tiles loaded and how many failed; an abort is not a failure.
 */
export async function fetchRoadTiles(todo, { state, level, signal, onTile }) {
  let failed = 0;
  let got = 0;
  await pool(todo, 4, async (t) => {
    if (signal.aborted) return;
    try {
      const res = await fetch(`/api/traffic/roads?level=${level}&x=${t.x}&y=${t.y}`, { signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (signal.aborted || !state.enabled) return;
      const roads = [];
      for (const w of body.roads) {
        const r = roadFromWire(w);
        if (r) roads.push(r);
      }
      state.net.addTile(t.key, roads);
      state.loaded.set(t.key, level);
      got++;
      onTile();
    } catch (err) {
      if (err.name !== 'AbortError') failed++;
    }
  });
  return { got, failed };
}
