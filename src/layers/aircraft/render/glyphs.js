/**
 * Canvas silhouettes (jet, prop, delta, helicopter) for the aircraft layer.
 * Everything is drawn white with a dark outline so Cesium's per-billboard
 * colour can tint it by altitude.
 */
import { makeCanvas } from './canvas.js';

function outline(g) {
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(12, 8, 4, 0.9)';
  g.lineWidth = 2.6;
  g.lineJoin = 'round';
  g.stroke();
  g.fill();
}

function jet() {
  const c = makeCanvas();
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.scale(1.62, 1.62);
  g.beginPath();
  g.moveTo(0, -17);
  g.lineTo(2.8, -8);
  g.lineTo(16, 2);
  g.lineTo(16, 6.5);
  g.lineTo(3, 3.5);
  g.lineTo(2.4, 11);
  g.lineTo(7, 14.8);
  g.lineTo(7, 17.4);
  g.lineTo(0, 15.8);
  g.lineTo(-7, 17.4);
  g.lineTo(-7, 14.8);
  g.lineTo(-2.4, 11);
  g.lineTo(-3, 3.5);
  g.lineTo(-16, 6.5);
  g.lineTo(-16, 2);
  g.lineTo(-2.8, -8);
  g.closePath();
  outline(g);
  return c;
}

function prop() {
  const c = makeCanvas();
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.scale(1.62, 1.62);
  g.beginPath();
  g.moveTo(0, -15);
  g.lineTo(2.4, -10);
  g.lineTo(2.4, -4);
  g.lineTo(17, -3);
  g.lineTo(17, 1.2);
  g.lineTo(2.4, 2.5);
  g.lineTo(2, 11);
  g.lineTo(8, 12.5);
  g.lineTo(8, 15.2);
  g.lineTo(0, 14.2);
  g.lineTo(-8, 15.2);
  g.lineTo(-8, 12.5);
  g.lineTo(-2, 11);
  g.lineTo(-2.4, 2.5);
  g.lineTo(-17, 1.2);
  g.lineTo(-17, -3);
  g.lineTo(-2.4, -4);
  g.lineTo(-2.4, -10);
  g.closePath();
  outline(g);
  return c;
}

function delta() {
  const c = makeCanvas();
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.scale(1.62, 1.62);
  g.beginPath();
  g.moveTo(0, -18);
  g.lineTo(2.2, -6);
  g.lineTo(14, 12);
  g.lineTo(14, 15);
  g.lineTo(3.4, 11.5);
  g.lineTo(2.6, 16);
  g.lineTo(0, 15);
  g.lineTo(-2.6, 16);
  g.lineTo(-3.4, 11.5);
  g.lineTo(-14, 15);
  g.lineTo(-14, 12);
  g.lineTo(-2.2, -6);
  g.closePath();
  outline(g);
  return c;
}

function heli() {
  const c = makeCanvas();
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.scale(1.6, 1.6);
  // tail boom + fin
  g.beginPath();
  g.moveTo(-1.6, 3);
  g.lineTo(-1.2, 16);
  g.lineTo(-4.5, 17.5);
  g.lineTo(-4.5, 15.2);
  g.lineTo(-1.2, 14.4);
  g.lineTo(1.2, 14.4);
  g.lineTo(4.5, 15.2);
  g.lineTo(4.5, 17.5);
  g.lineTo(1.2, 16);
  g.lineTo(1.6, 3);
  g.closePath();
  outline(g);
  // fuselage
  g.beginPath();
  g.ellipse(0, -2.5, 5.2, 8.6, 0, 0, Math.PI * 2);
  outline(g);
  // rotor disc as an X
  g.strokeStyle = 'rgba(12, 8, 4, 0.9)';
  g.lineWidth = 4.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-14, -14);
  g.lineTo(14, 10);
  g.moveTo(14, -14);
  g.lineTo(-14, 10);
  g.stroke();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.1;
  g.stroke();
  return c;
}

const BUILDERS = { jet, prop, delta, heli };
const cache = new Map(); // one canvas per shape, shared by every billboard

/** @param {'jet'|'prop'|'delta'|'heli'} shape */
export function glyphCanvas(shape) {
  if (!cache.has(shape)) cache.set(shape, (BUILDERS[shape] || jet)());
  return cache.get(shape);
}
