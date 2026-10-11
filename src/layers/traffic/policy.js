/** Tunables for the traffic layer. */
export const TILE_Z = 14; // slippy-map zoom of road tiles (~2.4 km at 40 deg N)
export const MAX_HEIGHT_M = 14_000; // above this camera height: "zoom in"
export const DETAIL_BELOW_M = 4_500; // residential/service streets only when closer than this
export const MAX_TILES = 12;
export const MAX_RETAINED_TILES = 40;
export const MAX_VEHICLES = 2400;
export const FRAME_MS = 33; // ~30 fps animation cap
export const SIM_LABEL = 'Simulated traffic flow, not live';
