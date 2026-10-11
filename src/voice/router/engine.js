/**
 * The router itself: normalise the text, find the first registry entry that matches, run its
 * handler against the injected `actions`, and speak the reply for the REAL result. Pure apart
 * from calling `actions`, which is what makes it easy to test with fakes.
 */
import { normalise } from './normalise.js';
import { failed } from './result.js';
import { defaultRegistry } from './commands/index.js';

/**
 * @param {{ actions: object, registry?: object[], names?: string[], address?: string }} opts
 */
export function createRouter({ actions, registry = defaultRegistry, names = [], address = 'sir' } = {}) {
  const entries = [...registry];

  /** Finds the first entry whose pattern matches and whose guard agrees. Returns null if none. */
  function parse(text) {
    const norm = normalise(text, { names });
    if (!norm) return null;
    for (const entry of entries) {
      // Entries with match() look at the raw text too (the address check needs commas and case).
      if (entry.match) {
        const args = entry.match(norm, String(text ?? ''), { names });
        if (args) return { entry, id: entry.id, args, normalised: norm };
        continue;
      }
      for (const pat of entry.patterns) {
        const m = (typeof pat === 'function' ? pat() : pat).exec(norm);
        if (!m) continue;
        const args = { ...(entry.defaults ?? {}) };
        for (const [k, v] of Object.entries(m.groups ?? {})) if (v !== undefined) args[k] = v.trim();
        if (entry.guard && !entry.guard(args)) continue;
        return { entry, id: entry.id, args, normalised: norm };
      }
    }
    return null;
  }

  /** Parses, runs the action and builds the spoken reply. Never throws: errors become a reply. */
  async function route(text, ctx = {}) {
    const parsed = parse(text);
    const c = { address, ...ctx };
    if (!parsed) {
      return { handled: false, id: null, reply: `I'm afraid I didn't understand that, ${c.address}. Say "what can you do" for my commands.`, ok: false };
    }
    const { entry, args } = parsed;
    let result;
    try {
      result = await entry.handler(actions, args, c);
    } catch (err) {
      return {
        handled: true, id: entry.id, args, ok: false, error: String(err?.message ?? err),
        reply: `I'm afraid that failed, ${c.address}: ${String(err?.message ?? 'an unexpected error occurred').slice(0, 120)}.`,
      };
    }
    const reply = entry.speak(result, args, c);
    return { handled: true, id: entry.id, args, result, ok: !failed(result), reply, sleep: !!entry.sleep };
  }

  return {
    parse,
    route,
    /** Extend: by default a new entry goes first so it takes priority over the built-ins. */
    register(entry, { first = true } = {}) {
      first ? entries.unshift(entry) : entries.push(entry);
    },
    entries: () => entries.map((e) => e.id),
  };
}
