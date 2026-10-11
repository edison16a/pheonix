/**
 * Did the action fail? Actions report failure either as `false` or as `{ ok: false, ... }`.
 * Lives on its own because both the engine and the spoken replies need the same answer.
 */
export const failed = (r) => r === false || (r && typeof r === 'object' && r.ok === false);
