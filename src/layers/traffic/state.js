/**
 * The one mutable record the traffic modules share. The modules are separate
 * files but they all work on the same session (what is loaded, whether the layer
 * is on, what the road network looks like), so it lives in a single object
 * instead of being passed around as a dozen loose arguments.
 */
import { createNetwork } from './roads/index.js';

/** Nothing measured: no links, no coverage index, no stale-feed note. */
export const emptyLive = () => ({ links: [], coverage: null, asOf: 0, stale: null });

export function createState() {
  return {
    enabled: false,
    tooHigh: false, // camera above MAX_HEIGHT_M: asking the user to zoom in
    net: createNetwork(),
    live: emptyLive(),
    loaded: new Map(), // detail level already fetched, by road tile key
    level: 'major', // 'major' or 'all' (residential and service streets too)
    abort: null, // AbortController of the refresh in flight
    lastTick: 0, // performance.now() of the previous animation step
    status: { state: 'idle', simulated: false },
  };
}
