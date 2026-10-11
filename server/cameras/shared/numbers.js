/**
 * Coerce a value to a finite number, returning fallback if NaN or Infinity.
 *
 * @param {*} value
 * @param {number} [fallback=NaN]
 * @returns {number}
 */
export function toFiniteNumber(value, fallback = NaN) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
