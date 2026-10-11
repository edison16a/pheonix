const BASE =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.BASE_URL) ||
  '/';

/** URL of a generated file in public/brand/, honouring Vite's base path. Used by the no-WebGL fallbacks. */
export const brandAsset = (name) =>
  `${BASE}brand/${name}`.replace(/\/{2,}/g, '/');
