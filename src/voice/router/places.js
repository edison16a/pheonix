/**
 * Place names and street addresses. The address check is the router's last resort, so it has to
 * be strict: a loose guess here would swallow phrases that belong to a real command.
 */
import { parseSpokenNumber } from './numbers.js';
import { nameAlternation } from './normalise.js';

export const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
/** First part of a geocoder name ("Paris, Ile-de-France, France" becomes "Paris"). */
export const shortName = (n, fallback) => String(n || fallback || '').split(',')[0].trim() || fallback;

const STREET_WORDS = new Set(['street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'lane', 'ln', 'drive', 'dr', 'way', 'court', 'ct', 'place', 'pl', 'square', 'sq', 'plaza', 'highway', 'hwy', 'terrace', 'ter', 'parkway', 'pkwy', 'loop', 'circle', 'cir', 'crescent', 'trail', 'alley', 'row']);
// Tokens that read better in capitals when we tidy a lowercase address ("washington dc").
const UPPER_TOKENS = new Set(['dc', 'ny', 'nyc', 'usa', 'uk', 'us', 'ca', 'la', 'nj', 'tx', 'fl', 'wa', 'ma', 'il', 'pa', 'va', 'md', 'ga', 'nv', 'az', 'co', 'or', 'oh', 'mi', 'nc', 'sc', 'ne', 'nw', 'se', 'sw']);

const clean = (t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '');

/** Capitalises a speech-model address, but leaves typed addresses that already have capitals alone. */
function prettify(addr) {
  if (/[A-Z]/.test(addr)) return addr.replace(/\b(\d+)([a-z])\b/g, (_, n, l) => n + l.toUpperCase());
  return addr
    .split(' ')
    .map((tok) => {
      const bare = tok.replace(/[^a-z0-9]/g, '');
      if (UPPER_TOKENS.has(bare)) return tok.toUpperCase();
      return tok.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/^(\d+)([a-z])$/i, (_, n, l) => n + l.toUpperCase());
    })
    .join(' ');
}

/**
 * Does `text` look like a street address? Returns { address, spoken } or null.
 * Rule A: house number (digits or spoken) followed later by a street word.
 * Rule B (allowComma): at least 2 comma parts, one digit somewhere, at least 3 tokens.
 * `spoken` is the short form we say back, house number and street name only.
 */
export function analyseAddress(text, { allowComma = true } = {}) {
  let tokens = String(text).trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const lowered = tokens.map(clean);
  const num = parseSpokenNumber(lowered);
  if (num && !/^\d/.test(tokens[0])) tokens = [num.value, ...tokens.slice(num.len)];
  const words = tokens.map(clean);
  // "5th avenue" starts with an ordinal, not a house number.
  const house = /^\d+[a-z]?(?:-\d+)?$/.test(words[0]) && !/^\d+(?:st|nd|rd|th)$/.test(words[0]);
  const hasStreet = words.slice(1).some((w) => STREET_WORDS.has(w));
  const joined = tokens.join(' ');
  let ok = house && hasStreet;
  if (!ok && allowComma) {
    const parts = joined.split(',').map((x) => x.trim()).filter(Boolean);
    ok = parts.length >= 2 && /\d/.test(joined) && tokens.length >= 3 && words.some((w) => /^[a-z]{3,}$/.test(w));
  }
  if (!ok) return null;
  const address = prettify(joined.replace(/\s*,\s*/g, ', ').replace(/[.!?,]+$/, ''));
  const toks = address.split(' ');
  const idx = toks.findIndex((t, i) => i > 0 && STREET_WORDS.has(clean(t)));
  const spoken = (idx > 0 ? toks.slice(0, idx + 1).join(' ') : address.split(',')[0]).replace(/,$/, '');
  return { address, spoken };
}

/**
 * Removes the "take me to" style lead-in from the raw text, keeping the original case and commas
 * that normalise() throws away. Needed because the address check wants the text as it was said.
 */
export function stripAddressLead(raw, names = []) {
  const res = [
    /^(?:hey|ok|okay|hi|hello)[,\s]+/i,
    new RegExp(`^(?:${nameAlternation(names)})\\b[,\\s]*`, 'i'),
    /^(?:please|kindly)[,\s]+/i,
    /^(?:could|can|would|will)\s+you\s+(?:please\s+)?/i,
    /^i\s+(?:want|need)\s+you\s+to\s+/i,
    /^(?:let'?s|lets)\s+/i,
    /^(?:go|fly|head|travel|navigate|jump|teleport|move|zoom|take\s+(?:me|us)|show(?:\s+me)?|bring\s+up|pull\s+up|display|find|locate|visit|look\s+at|where\s+is|where's|explore|get\s+(?:me|us))(?:\s+(?:over|across|back|down|up))?(?:\s+(?:to|towards|toward|into|at))?\s+/i,
    /^(?:the\s+)?address\s+(?:of\s+)?/i,
  ];
  let t = String(raw).trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const re of res) {
      const n = t.replace(re, '');
      if (n !== t) { t = n; changed = true; }
    }
  }
  return t.replace(/\s+(?:please|sir|thanks|thank you)[.!?]*$/i, '').replace(/\s+on the (?:map|globe)[.!?]*$/i, '').replace(/[.!?]+$/, '').trim();
}
