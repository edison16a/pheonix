import { PACK_META } from './packMeta.js';
import { normalizeSourceItem } from './normalizeItem.js';

/**
 * Normalize one pack's raw loader output into the shape the cap and dedupe
 * steps work on: valid objects only, tagged with the pack name, with the
 * pack's default official page, credit and license filled in where the camera
 * has none of its own.
 *
 * @param {string} name - Pack name (a LIVE_PACKS entry, "file" or "env").
 * @param {Array<object>} items - Raw loader output.
 * @returns {{name: string, sources: Array<object>}}
 */
export function normalizePack(name, items) {
  return {
    name,
    sources: items
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const n = { ...normalizeSourceItem(item), pack: name };
        const meta = PACK_META[name];
        if (meta) {
          n.officialUrl = n.officialUrl || meta[0];
          n.credit = n.credit || meta[1];
          n.license = n.license || meta[2];
        }
        return n;
      })
      .filter((item) => item.id),
  };
}
