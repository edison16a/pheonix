/** Tunables for the bikes layer. */
export const POLL_MS = 30_000; // GBFS availability refreshes about this often
export const MAX_HEIGHT_M = 35_000; // above this camera height: "zoom in"
export const LABEL_BELOW_M = 2_800; // bike counts are printed on stations only when closer than this
export const MAX_LABELS = 260;
export const MIN_CLUSTER = 3;
export const MOVE_DEBOUNCE_MS = 350;
