import path from 'node:path';
import sharp from 'sharp';
import { out } from '../paths.js';

/** Square PNG of an SVG string on a transparent canvas. High density keeps thin strokes crisp. */
export const svgToPng = (svg, size, file) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(out, file));

/** PNG buffer of the favicon SVG at one size. Rendered at a very high density so 16px stays sharp. */
export const faviconPng = (svg, size) =>
  sharp(Buffer.from(svg), { density: 1536 })
    .resize(size, size)
    .png()
    .toBuffer();

/** The 1200x630 share card, rendered at its natural size. */
export const ogToPng = (svg, file) =>
  sharp(Buffer.from(svg), { density: 96 })
    .resize(1200, 630)
    .png()
    .toFile(path.join(out, file));
