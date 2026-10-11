/**
 * DEV-ONLY fake voice backend (no models, no microphone). Same client interface as
 * serviceClient. Text passed to inject() behaves like speech: in wake mode it must contain the
 * wake phrase (for example "hey pheonix ..."); in capture mode it is the utterance. TTS falls back to the
 * browser's own SpeechSynthesis because no service is present.
 */
export function createMockClient({ config = {}, delayMs = 150 } = {}) {
  const listeners = new Set();
  let mode = 'idle';
  let muted = false;
  let open = false;
  let pending = '';
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const phrase = String(config.wakePhrase ?? 'hey jarvis').toLowerCase();
  const name = String(config.assistantName ?? 'jarvis').toLowerCase();
  const later = (fn) => setTimeout(fn, delayMs);

  return {
    kind: 'mock',
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async connect() { open = true; later(() => open && emit({ type: 'open', config: { ...config, models: {} } })); },
    close() { open = false; },
    setMode(m) {
      mode = m;
      // A command said together with the wake phrase waits here until the assistant starts capturing.
      if (m === 'capture' && pending) { const t = pending; pending = ''; later(() => emit({ type: 'transcript', text: t })); }
    },
    setMuted(b) { muted = !!b; },
    inject(text) {
      if (!open || muted || mode === 'idle') return false; // like a muted/deaf mic
      const lower = String(text).toLowerCase();
      if (mode === 'wake') {
        const idx = lower.indexOf(phrase) >= 0 ? lower.indexOf(phrase) + phrase.length : lower.startsWith(name) ? name.length : -1;
        if (idx < 0) return false;
        later(() => {
          emit({ type: 'wake', score: 1, method: 'mock' });
          const rest = String(text).slice(idx).replace(/^[\s,.:;-]+/, '');
          pending = rest; // delivered once the assistant starts capturing (after its greeting)
        });
        return true;
      }
      emit({ type: 'speech_start' });
      later(() => emit({ type: 'transcript', text: String(text) }));
      return true;
    },
  };
}
