/** Individual CCTV image fetches must settle before the active 10-second
 * client refresh cadence. A bounded miss can fall through to Street View or
 * the synthetic frame instead of leaving the browser preview pending. */
export const CCTV_FRAME_FETCH_TIMEOUT_MS = 8 * 1000;
/** Maximum buffered snapshot size. */
export const CCTV_FRAME_MAX_BODY_BYTES = 16 * 1024 * 1024;
/** Deadline for upstream response headers; live bodies keep streaming afterward. */
export const CCTV_MEDIA_FETCH_TIMEOUT_MS = 15 * 1000;
/** Silence a live body may carry before the relay gives up on it. Twice the
 * header deadline, because a camera that is merely slow between frames is far
 * more common than one that has died mid-stream, and a viewer would rather
 * wait than be dropped. */
export const CCTV_MEDIA_IDLE_TIMEOUT_MS = 30 * 1000;
/** Declared size ceiling for fixed media responses. */
export const CCTV_MEDIA_MAX_BODY_BYTES = 64 * 1024 * 1024;
