/**
 * Feather fans as plain parameter rows. Wing rows: angle (deg, counter-clockwise from +x), length, width,
 * curl. Tips curl up like rising flames.
 */
export const WING_BACK = [
  [70, 0.74, 0.085, 0.14],
  [60, 0.96, 0.095, 0.2],
  [50, 1.1, 0.1, 0.26],
  [40, 1.14, 0.1, 0.34],
  [30, 1.08, 0.095, 0.44],
  [20, 0.96, 0.09, 0.54],
  [10, 0.78, 0.082, 0.66],
];
export const WING_MID = [
  [65, 0.62, 0.07, 0.16],
  [55, 0.8, 0.078, 0.22],
  [45, 0.9, 0.08, 0.3],
  [35, 0.9, 0.078, 0.4],
  [25, 0.8, 0.072, 0.5],
  [15, 0.64, 0.066, 0.6],
];
export const WING_FRONT = [
  [60, 0.4, 0.052, 0.16],
  [49, 0.52, 0.058, 0.24],
  [38, 0.56, 0.058, 0.34],
  [27, 0.5, 0.054, 0.44],
  [17, 0.4, 0.048, 0.54],
];
/** Long flowing tail streamers: angle, length, width, curl, sway. */
export const TAIL = [
  [-90, 1.35, 0.11, 0.0, 0.9],
  [-75, 1.22, 0.1, 0.25, -0.9],
  [-105, 1.22, 0.1, -0.25, 0.9],
  [-59, 0.98, 0.085, 0.35, 0.8],
  [-121, 0.98, 0.085, -0.35, -0.8],
];
/** Crest plumes on the head: angle, length, width, curl, sway. */
export const CREST = [
  [126, 0.42, 0.03, 0.3, 0],
  [143, 0.36, 0.028, 0.4, 0],
  [160, 0.28, 0.024, 0.5, 0],
];
