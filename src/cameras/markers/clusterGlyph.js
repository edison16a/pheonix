import { canvasFor } from './canvas.js';
import { drawCamera, YELLOW } from './cameraGlyph.js';

/** Glyph box size (CSS px) for a cluster: 38 to 64 with log(count), in 5 buckets. */
export function clusterSize(count) {
  const t = Math.max(0, Math.min(1, Math.log10(Math.max(2, count)) / 4));
  return 38 + Math.round(t * 4) * 6.5;
}

/** Cluster: the same camera glyph, large, on a dark translucent backing, with the count in an orange pill. */
export function clusterGlyph(label, size, hasLive) {
  const pad = 5;
  const W = size + pad * 2;
  const [c, g] = canvasFor(W);
  // backing
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 7;
  g.beginPath();
  g.roundRect(pad, pad, size, size, size * 0.3);
  g.fillStyle = 'rgba(14,12,10,0.58)';
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = hasLive ? 2 : 1.4;
  g.strokeStyle = hasLive ? 'rgba(255,77,61,0.95)' : 'rgba(255,179,71,0.8)';
  g.stroke();
  g.save();
  g.translate(pad + size * 0.08, pad + size * 0.02);
  drawCamera(g, size * 0.84, YELLOW);
  g.restore();
  // count pill, lower right
  const fs = Math.round(size * 0.27);
  g.font = `700 ${fs}px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif`;
  const tw = g.measureText(label).width;
  const ph = fs + 6;
  const pw = Math.max(ph, tw + 12);
  const px = pad + size - pw * 0.78;
  const py = pad + size - ph * 0.78;
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 4;
  g.beginPath();
  g.roundRect(px, py, pw, ph, ph / 2);
  g.fillStyle = '#ff7a1a';
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 1.2;
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, px + pw / 2, py + ph / 2 + 0.5);
  return c;
}
