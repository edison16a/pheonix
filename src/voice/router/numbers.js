/**
 * Spoken numbers. Speech models hand back "sixteen hundred" or "one two three" instead of
 * digits, and house numbers are the only place we need them, so this stays small.
 */
const ONES = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
// "oh" and "o" are how people say zero in a house number ("one oh one").
const DIGIT_WORDS = { zero: 0, oh: 0, o: 0, ...Object.fromEntries(Object.entries(ONES).filter(([, v]) => v < 10)) };

/** One chunk below a hundred ("twenty one", "fifteen") starting at words[j], or null. */
function chunk(words, j) {
  const w = words[j];
  if (w in TENS) {
    const nx = words[j + 1];
    return nx in ONES && ONES[nx] < 10 ? { v: TENS[w] + ONES[nx], len: 2 } : { v: TENS[w], len: 1 };
  }
  return w in ONES ? { v: ONES[w], len: 1 } : null;
}

/**
 * Reads a spoken number at the start of `words` ("sixteen hundred", "one two three").
 * Returns { value, len } where value is a digit string and len is how many words it used, or null.
 */
export function parseSpokenNumber(words) {
  let i = 0;
  while (i < words.length && words[i] in DIGIT_WORDS) i++;
  // Two or more digit words in a row are read digit by digit, unless they lead into "hundred".
  if (i >= 2 && words[i] !== 'hundred' && words[i] !== 'thousand') return { value: words.slice(0, i).map((w) => DIGIT_WORDS[w]).join(''), len: i };
  const c = chunk(words, 0);
  if (!c) return null;
  let len = c.len;
  if (words[len] === 'hundred') {
    len++;
    let k = len;
    if (words[k] === 'and') k++;
    const r = chunk(words, k);
    if (r) { len = k + r.len; return { value: String(c.v * 100 + r.v), len }; }
    return { value: String(c.v * 100), len };
  }
  return { value: String(c.v), len };
}
