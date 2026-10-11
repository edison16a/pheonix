/** Altitude colour ramp for the glyphs (orange when low, cyan at cruise). */
const ALT_STOPS = [
  [0, [255, 122, 26]], // orange: low / departing / arriving
  [8000, [255, 179, 71]], // amber
  [20000, [255, 232, 160]], // warm white
  [32000, [150, 224, 255]], // pale cyan
  [42000, [90, 190, 255]], // cyan: cruise
];

/** Altitude in feet to [r, g, b] (0 to 255), interpolated linearly between stops. */
export function altitudeRgb(altFt) {
  const a = Number.isFinite(altFt) ? Math.max(0, altFt) : 0;
  if (a <= ALT_STOPS[0][0]) return ALT_STOPS[0][1].slice();
  for (let i = 1; i < ALT_STOPS.length; i++) {
    const [a1, c1] = ALT_STOPS[i];
    if (a <= a1) {
      const [a0, c0] = ALT_STOPS[i - 1];
      const t = (a - a0) / (a1 - a0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
    }
  }
  return ALT_STOPS[ALT_STOPS.length - 1][1].slice();
}
