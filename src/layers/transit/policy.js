/** Tunables for the transit layer. */
export const POLL_MS = 10_000; // matches the agencies' own refresh rate
export const MAX_HEIGHT_M = 450_000; // above this camera height: "zoom in"
export const MIN_CLUSTER = 3;
export const MOVE_DEBOUNCE_MS = 350;
export const FRAME_CHECK_MS = 100; // how often to ask for a frame while vehicles glide
