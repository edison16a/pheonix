import { roadFromWire } from '../../src/layers/traffic/roads/index.js';

/** Deterministic random numbers (Park-Miller) so motion tests don't flake. */
export const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/** A straight east-west road of about `m` metres at the equator: 1 degree of longitude is 111320 m there. */
export const road = (id, lon0, m, { cls = 3, oneway = 0 } = {}) =>
  roadFromWire([id, cls, oneway, 0, 0, [lon0, 0, lon0 + m / 111320 / 2, 0, lon0 + m / 111320, 0]]);
