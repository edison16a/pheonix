/*
 * AudioWorkletProcessor: downmix to mono, resample to 16 kHz, post Int16 frames of 1280 samples (80 ms).
 * 80 ms is the frame size the wake word model reads, and 16 kHz is what whisper expects.
 */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0;
    this.out = new Int16Array(1280);
    this.n = 0;
    this.last = 0;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      // linear-interpolated decimation
      while (this.pos < 1) {
        const s = this.last + (ch[i] - this.last) * this.pos;
        this.out[this.n++] = Math.max(-1, Math.min(1, s)) * 32767;
        if (this.n === this.out.length) {
          const copy = this.out.slice().buffer;
          this.port.postMessage(copy, [copy]);
          this.n = 0;
        }
        this.pos += this.ratio;
      }
      this.pos -= 1;
      this.last = ch[i];
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
