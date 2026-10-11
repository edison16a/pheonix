import fs from 'node:fs';
import path from 'node:path';

/**
 * Read a curated catalog file (Tallinn, Warendorf) relative to the project
 * root. Both packs ship hand-made JSON next to the code instead of calling an
 * API, and both treat a missing or broken file as "no cameras" with a warning.
 *
 * @param {string} label - Pack name used in the warning text.
 * @param {string} sourceFile - Absolute path, or one relative to sourceRoot.
 * @param {string} sourceRoot - Project root the relative path starts from.
 * @returns {?Array<object>} The rows, or null when the file is unusable.
 */
export function readCuratedCatalog(label, sourceFile, sourceRoot) {
  const resolved = path.isAbsolute(sourceFile)
    ? sourceFile
    : path.resolve(sourceRoot, sourceFile);
  try {
    if (!fs.existsSync(resolved)) {
      console.warn(`[CCTV] ${label} source file missing:`, resolved);
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(
      `[CCTV] ${label} source file read error:`,
      error?.message || error,
    );
    return null;
  }
}
