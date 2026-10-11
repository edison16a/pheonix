import * as THREE from 'three';

const _c = new THREE.Color();
/** sRGB hex to the linear working space the vertex colours live in. */
export const lin = (hex) => {
  _c.set(hex);
  return [_c.r, _c.g, _c.b];
};

const mixc = (a, b, f) => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
];
/** Colour at t (0..1) along a list of stops. */
export function ramp(stops, t) {
  const n = stops.length - 1;
  const x = Math.min(1, Math.max(0, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return mixc(stops[i], stops[i + 1], x - i);
}

/** Colour ramps per feather family, dark root to bright tip (linear RGB). */
export const RAMPS = {
  primary: ['#8e1a0b', '#d9381a', '#ff6a1a', '#ff9a2e'].map(lin),
  secondary: ['#9d1f0a', '#e8452c', '#ff7a1a', '#ffb347'].map(lin),
  covert: ['#ff5f1a', '#ff8a24', '#ffb347'].map(lin),
  covert2: ['#e03a1a', '#ff6f1a', '#ffa03a'].map(lin),
  fringe: ['#ff6a1a', '#ffb347', '#fff0b8'].map(lin),
  tail: ['#9d1d0b', '#e8452c', '#ff8a24', '#ffd166'].map(lin),
  streamer: ['#c8340f', '#ff7a1a', '#ffd166', '#fff0b8'].map(lin),
  crest: ['#ff9a2a', '#ffd166', '#fff3c9'].map(lin),
  chest: ['#ff8a24', '#ffa83a', '#ffc457'].map(lin),
  belly: ['#e8452c', '#ff7a1a', '#ffb347'].map(lin),
  shaft: ['#ffb347', '#ffe08a', '#fff6d6'].map(lin),
  head: ['#ff9a2e', '#ffb347', '#ffd166'].map(lin),
  beak: ['#ffe4a0', '#ffb347', '#d9541a'].map(lin),
};
