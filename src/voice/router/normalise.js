/**
 * Turns whatever the speech model or the keyboard gave us into a flat, lowercase command so the
 * patterns only have to describe the command itself. Politeness, the assistant's name and
 * "could you" style lead-ins are all noise as far as routing goes.
 */

// Lead-ins are stripped in a loop because people stack them ("ok so could you please ...").
const FILLER_PREFIX = [
  /^(?:hey|ok|okay|hi|hello)\s+/,
  /^(?:please|kindly)\s+/,
  /^(?:could|can|would|will)\s+you\s+(?:please\s+)?/,
  /^(?:i\s+(?:want|need)\s+you\s+to|i(?:'d| would)\s+like\s+(?:you\s+)?to|i\s+want\s+to|i\s+would\s+like\s+to)\s+/,
  /^(?:let'?s|lets)\s+/,
  /^(?:and|so|then|now|just|ok|okay|alright|right|um+|uh+|er+)\s+/,
];
const FILLER_ANYWHERE = /\b(?:please|sir|thanks|thank you|for me|right now|um+|uh+)\b/g;

/**
 * Regex alternation of every name the assistant answers to. Speech models spell the wake name
 * several ways, so the old names stay in even when the configured one is different.
 */
export function nameAlternation(names = []) {
  return ['jarvis', 'pheonix', 'phoenix', ...names.map((n) => String(n).toLowerCase())].filter(Boolean).join('|');
}

export function normalise(text, { names = [] } = {}) {
  let t = String(text ?? '')
    .toLowerCase()
    .replace(/[“”"]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const nameRe = new RegExp(`\\b(?:${nameAlternation(names)})\\b`, 'g');
  t = t.replace(nameRe, ' ').replace(FILLER_ANYWHERE, ' ').replace(/\s+/g, ' ').trim();
  let prev;
  do {
    prev = t;
    for (const re of FILLER_PREFIX) t = t.replace(re, '');
  } while (t !== prev);
  return t.replace(/\s+(?:please|now|for me)$/, '').trim();
}
