/** Minimal typed-by-convention event bus shared by every Pheonix module. */
export function createBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    emit(type, detail) {
      for (const fn of handlers.get(type) ?? []) {
        try {
          fn(detail);
        } catch (err) {
          console.error(`[bus] handler for "${type}" failed`, err);
        }
      }
    },
  };
}
