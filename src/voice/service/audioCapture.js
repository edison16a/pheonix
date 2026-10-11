/**
 * Microphone capture through getUserMedia and an AudioWorklet. Hands `onFrame` 16 kHz mono Int16
 * frames, the format the voice service expects. The worklet does the resampling off the main thread.
 */
export async function createMicCapture({ onFrame }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const e = new Error('getUserMedia unavailable (needs https or localhost)');
    e.name = 'NotSupportedError';
    throw e;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    await ctx.audioWorklet.addModule(new URL('./micWorklet.js', import.meta.url));
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'pcm-capture', { numberOfInputs: 1, numberOfOutputs: 0 });
    node.port.onmessage = (e) => onFrame(e.data);
    src.connect(node);
    if (ctx.state === 'suspended') await ctx.resume();
    return {
      stop() {
        try { node.port.onmessage = null; src.disconnect(); } catch {}
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      },
    };
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    throw err;
  }
}
