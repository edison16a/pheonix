import { isLiveFeed } from '../catalog/index.js';

/**
 * Turns the `live` option into a filter: true keeps live feeds, false keeps
 * stills, anything else means "don't care" (returns null).
 */
export const wantKind = (live) =>
  live === true
    ? (c) => isLiveFeed(c.feedType)
    : live === false
      ? (c) => !isLiveFeed(c.feedType)
      : null;
