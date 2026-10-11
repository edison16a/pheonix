/**
 * Canvas art for the soft halo behind each glyph and for the selection ring.
 * Both are white so Cesium can tint them per aircraft.
 */
import { makeCanvas } from './canvas.js';

const cache = new Map();

/** Soft radial glow, tinted per aircraft. */
export function haloCanvas() {
  if (!cache.has('halo')) {
    const c = makeCanvas();
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    cache.set('halo', c);
  }
  return cache.get('halo');
}

/** Selection ring (open circle with four ticks). */
export function ringCanvas() {
  if (!cache.has('ring')) {
    const c = makeCanvas(96);
    const g = c.getContext('2d');
    g.translate(48, 48);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(12,8,4,0.55)';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(0, 0, 36, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3.6;
    g.beginPath();
    g.arc(0, 0, 36, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i * Math.PI) / 2);
      g.beginPath();
      g.moveTo(0, -36);
      g.lineTo(0, -45);
      g.stroke();
      g.restore();
    }
    cache.set('ring', c);
  }
  return cache.get('ring');
}
