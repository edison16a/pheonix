/**
 * Layer status reporting on the event bus. A layer re-checks its state on every
 * pan and poll, so repeats of the same non-ok state are swallowed here: listeners
 * (the voice assistant, the data popup) only hear about changes. 'ok' always goes
 * through because it carries fresh counts.
 */
export function createStatusEmitter(bus, layer) {
  let last = '';
  return {
    emit(state, extra = {}) {
      if (state !== 'ok' && state === last) return;
      last = state;
      bus?.emit('layer:status', { layer, state, ...extra });
    },
    /** Forget the last state so the next one is announced again (used when a layer is switched off). */
    reset() {
      last = '';
    },
  };
}
