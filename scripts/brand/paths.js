import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root and the folder every generated brand file lands in. */
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
export const out = path.join(root, 'public', 'brand');
