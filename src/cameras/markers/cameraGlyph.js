import { canvasFor } from './canvas.js';

export const RED = '#ff4d3d';
export const YELLOW = '#ffb347';

/** Draws the bullet-camera shape (wall mount, body, hood, lens) into a box of side `box`. */
export function drawCamera(g, box, col) {
  const S = 44;
  g.save();
  g.scale(box / S, box / S);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 1;
  g.translate(S / 2, S / 2);
  g.rotate(-0.22);
  g.translate(-S / 2, -S / 2);
  const outline = 'rgba(12,10,8,0.92)';
  const pill = (x, y, w, h, r) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };
  pill(7, 11, 4, 22, 2);
  g.fillStyle = col; g.fill(); g.lineWidth = 1.4; g.strokeStyle = outline; g.stroke();
  g.beginPath(); g.moveTo(11, 24); g.lineTo(17, 24); g.lineWidth = 3.4; g.strokeStyle = outline; g.stroke();
  g.lineWidth = 1.6; g.strokeStyle = col; g.stroke();
  pill(15, 14, 20, 12, 3.5);
  g.fillStyle = col; g.fill(); g.lineWidth = 1.6; g.strokeStyle = outline; g.stroke();
  pill(13, 11.5, 22, 3.2, 1.6);
  g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.stroke();
  pill(35, 16, 4.5, 8, 1.8);
  g.fillStyle = '#1b1612'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = outline; g.stroke();
  g.shadowBlur = 0;
  g.beginPath(); g.arc(37.4, 20, 1.4, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill();
  g.beginPath(); g.arc(19.5, 20, 1.5, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  g.restore();
}

/** Single camera: glyph coloured by feed kind (red live, amber snapshot). */
export function cameraGlyph({ live, active, dim }) {
  const S = 44;
  const [c, g] = canvasFor(S);
  g.globalAlpha = dim ? 0.45 : 1;
  if (active) {
    g.beginPath();
    g.arc(S / 2, S / 2, 20, 0, Math.PI * 2);
    g.strokeStyle = '#fff';
    g.lineWidth = 2.5;
    g.stroke();
  }
  drawCamera(g, S, live ? RED : YELLOW);
  return c;
}
