/**
 * Speaker: Kokoro via POST /voice/tts when the local service has the model, otherwise the
 * browser's own SpeechSynthesis (clearly a fallback). Sentence-chunked with next-chunk prefetch
 * and an in-memory phrase cache. speak() resolves when playback has really finished.
 */
/**
 * Split a reply into sentences, and cut very long ones at a comma or space. Short chunks mean
 * playback can start after the first one while the next is still being fetched.
 * server/voice/phrases.py has the same logic, keep the two in step.
 */
export function splitSentences(text, maxLen = 220) {
  const parts = String(text).trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const out = [];
  for (let p of parts) {
    while (p.length > maxLen) {
      let cut = p.lastIndexOf(',', maxLen);
      if (cut < 40) cut = p.lastIndexOf(' ', maxLen);
      if (cut <= 0) cut = maxLen;
      out.push(p.slice(0, cut + 1).trim());
      p = p.slice(cut + 1).trim();
    }
    if (p) out.push(p);
  }
  return out;
}

/** Returns { speak, cancel, prime, isSpeaking, usingService }. */
export function createSpeaker({ base = '', voice = 'bm_george', useService = true, fetchImpl = globalThis.fetch, synth = globalThis.speechSynthesis } = {}) {
  const cache = new Map(); // maps a sentence to its Promise of audio, so repeats and prefetches share one request
  let serviceOk = useService;
  let current = null; // { stop() }
  let speaking = false;

  const fetchChunk = (text) => {
    if (!cache.has(text)) {
      const p = fetchImpl(`${base}/voice/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }) })
        .then((r) => { if (!r.ok) throw new Error(`tts ${r.status}`); return r.blob(); });
      p.catch(() => cache.delete(text));
      cache.set(text, p);
      if (cache.size > 60) cache.delete(cache.keys().next().value);
    }
    return cache.get(text);
  };

  const playBlob = (blob) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    let done = false;
    const finish = (err) => { if (done) return; done = true; URL.revokeObjectURL(url); current = null; err ? reject(err) : resolve(); };
    current = { stop: () => { audio.pause(); finish(); } };
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error('audio playback failed'));
    audio.play().catch(finish);
  });

  const browserSpeak = (text) => new Promise((resolve) => {
    if (!synth) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices?.() ?? [];
    u.voice = voices.find((v) => /en-GB/i.test(v.lang) && /daniel|male|george|arthur/i.test(v.name)) || voices.find((v) => /en-GB/i.test(v.lang)) || null;
    u.lang = u.voice?.lang || 'en-GB';
    u.rate = 1.02;
    u.onend = u.onerror = () => { current = null; resolve(); };
    current = { stop: () => { synth.cancel(); } };
    synth.speak(u);
  });

  return {
    get usingService() { return serviceOk; },
    isSpeaking: () => speaking,
    cancel() { speaking = false; current?.stop(); synth?.cancel?.(); },
    prime(phrases) { if (serviceOk) phrases.forEach((p) => fetchChunk(p).catch(() => {})); },
    async speak(text) {
      const chunks = splitSentences(text);
      speaking = true;
      try {
        if (serviceOk) {
          try {
            let next = chunks.length ? fetchChunk(chunks[0]) : null;
            for (let i = 0; i < chunks.length; i++) {
              const blob = await next;
              next = i + 1 < chunks.length ? fetchChunk(chunks[i + 1]) : null; // prefetch
              if (!speaking) return;
              await playBlob(blob);
            }
            return;
          } catch (err) {
            serviceOk = false; // model missing or service down: degrade for this session
            console.warn('[voice] service TTS unavailable, using browser speech', err?.message);
          }
        }
        await browserSpeak(text);
      } finally {
        speaking = false;
      }
    },
  };
}
