/** True when the OS asks for less motion. Safe to call where matchMedia does not exist. */
export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
