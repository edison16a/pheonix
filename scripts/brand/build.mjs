#!/usr/bin/env node
/**
 * Generates every Pheonix brand asset into public/brand/: the globe app mark, the wordmark, the OG
 * card, the flat phoenix (src/brand/flat), the PNG and ICO renders and the web manifest.
 * Idempotent: rerun any time.
 *   npm run brand
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { out, root } from './paths.js';
import { manifestJson } from './manifest.js';
import { ico } from './render/ico.js';
import { faviconPng, ogToPng, svgToPng } from './render/png.js';
import { globeSvg, maskableSvg } from './svg/globeDocs.js';
import { ogSvg } from './svg/og.js';
import { phoenixSvgs } from './svg/phoenix.js';
import { wordmarkSvg } from './svg/wordmark.js';

const w = (name, data) => writeFile(path.join(out, name), data);

async function main() {
  await mkdir(out, { recursive: true });

  // SVGs. The app mark is the globe (transparent). The phoenix stays as the splash fallback character.
  const globe = globeSvg({ id: 'gl' });
  const globeMono = globeSvg({ mode: 'mono', id: 'gm' });
  const favicon = globeSvg({ size: 64, pad: 0.01, variant: 'icon', id: 'fv' });
  const maskable = maskableSvg({ size: 512, scale: 0.84 });
  const { phoenix, phoenixMono } = phoenixSvgs();
  const og = ogSvg();
  await Promise.all([
    w('globe.svg', globe),
    w('globe-mono.svg', globeMono),
    w('favicon.svg', favicon),
    w('wordmark.svg', wordmarkSvg()),
    w('phoenix.svg', phoenix),
    w('phoenix-mono.svg', phoenixMono),
    w('og-image.svg', og),
  ]);
  await rm(path.join(out, 'app-icon.svg'), { force: true }); // superseded by globe.svg

  // Favicons: one PNG per size, packed into favicon.ico as well.
  const fav = {};
  for (const s of [16, 32, 48]) {
    fav[s] = await faviconPng(favicon, s);
    await w(`favicon-${s}.png`, fav[s]);
  }
  const icoBuf = ico([16, 32, 48].map((sz) => ({ size: sz, buf: fav[sz] })));
  await w('favicon.ico', icoBuf);
  // browsers request /favicon.ico at the site root regardless of <link> tags
  await writeFile(path.join(root, 'public', 'favicon.ico'), icoBuf);

  // App icons and the big transparent renders.
  const iconSvg = globeSvg({ pad: 0.02, id: 'ic' }); // transparent, fills the icon
  await Promise.all([
    svgToPng(globeSvg({ pad: 0.04, id: 'ap' }), 180, 'apple-touch-icon.png'),
    svgToPng(iconSvg, 192, 'icon-192.png'),
    svgToPng(iconSvg, 512, 'icon-512.png'),
    svgToPng(maskable, 512, 'icon-maskable-512.png'),
    svgToPng(globe, 1024, 'globe-transparent.png'),
    svgToPng(phoenix, 1024, 'phoenix-transparent.png'),
    ogToPng(og, 'og-image.png'),
  ]);

  await w('site.webmanifest', manifestJson());
  console.log('brand assets written to', path.relative(root, out));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
