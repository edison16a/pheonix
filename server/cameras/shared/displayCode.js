/** Longest unselected camera label the HUD shows before it gets noisy. */
const CAMERA_CODE_MAX_CHARS = 28;

/**
 * Short display code for the unselected camera label ("CAM-<code>"): the
 * feed's own name for the camera ("5TH ST / CONGRESS AVE", "TRAFALGAR
 * SQUARE"), trimmed to CAMERA_CODE_MAX_CHARS. A pack may pass an explicit
 * `code` (TxDOT's device key, NSW's title); the id is the last resort.
 *
 * @param {string} text
 * @returns {string}
 */
export function cameraDisplayCode(text) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= CAMERA_CODE_MAX_CHARS) return clean;
  return `${clean.slice(0, CAMERA_CODE_MAX_CHARS - 1).trimEnd()}\u2026`;
}
