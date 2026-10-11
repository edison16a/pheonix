/** Canvas icons for single transit vehicles: round for buses, rounded square for rail. */
const cache = {};

/** Rail and trams are drawn as yellow squares; buses and anything unknown as orange circles. */
export const isRail = (kind) => kind === 'rail' || kind === 'tram';

/**
 * `arrow` adds a heading chevron on top (rotated by the billboard) instead of a
 * centre dot. Canvases are cached per kind and arrow so Cesium reuses the texture.
 */
export function glyph(kind, arrow) {
  const key = `${kind}:${arrow}`;
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  g.translate(24, 24);
  const rail = isRail(kind);
  g.fillStyle = rail ? '#ffd166' : '#ff7a1a';
  g.strokeStyle = 'rgba(18,12,6,0.92)';
  g.lineWidth = 3;
  g.beginPath();
  if (rail) g.roundRect(-10, -10, 20, 20, 4);
  else g.arc(0, 0, 10.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (arrow) {
    // Heading chevron pointing up (rotated by billboard rotation).
    g.fillStyle = 'rgba(255,255,255,0.97)';
    g.beginPath();
    g.moveTo(0, -17);
    g.lineTo(5.5, -9);
    g.lineTo(-5.5, -9);
    g.closePath();
    g.fill();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(0, 0, 3, 0, Math.PI * 2);
    g.fill();
  }
  return (cache[key] = c);
}
