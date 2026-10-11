/** Which player kind a feed type needs. */
export function kindForFeed(feedType) {
  if (feedType === 'hls' || feedType === 'mp4' || feedType === 'webm') return 'video';
  if (feedType === 'mjpeg' || feedType === 'image') return 'snapshot';
  return 'embed';
}
