// 'embed' entries are only served by the server while verified live.
const LIVE_TYPES = new Set(['hls', 'mjpeg', 'mp4', 'webm', 'embed']);

/** True for feeds that move (video, MJPEG, live embeds). Everything else is a still. */
export const isLiveFeed = (feedType) => LIVE_TYPES.has(feedType);
