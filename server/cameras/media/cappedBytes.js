/** Read a snapshot incrementally, retaining at most maxBytes of owned chunks. */
export async function readCappedResponseBytes(upstream, maxBytes) {
  const declared = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    try {
      await upstream.body?.cancel();
    } catch {
      /* no-op */
    }
    return null;
  }
  if (!upstream.body) return null;
  const chunks = [];
  let total = 0;
  // Every retained chunk is an OWNED copy: a chunk can be a small view over a
  // much larger backing ArrayBuffer, and keeping the view would retain that
  // whole allocation while the byte accounting only counted the view.
  const keep = (chunk) => {
    total += chunk.byteLength;
    if (total > maxBytes) return false;
    chunks.push(Buffer.from(chunk));
    return true;
  };
  if (typeof upstream.body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of upstream.body) {
      if (!keep(chunk)) {
        try {
          await upstream.body.cancel();
        } catch {
          /* no-op */
        }
        return null;
      }
    }
    return Buffer.concat(chunks, total);
  }
  // No async iterator: stream through a reader so the cap still applies while
  // reading. A body that cannot be streamed at all is refused rather than
  // buffered uncapped, because the helper's whole contract is the cap.
  const reader =
    typeof upstream.body.getReader === 'function'
      ? upstream.body.getReader()
      : null;
  if (!reader) return null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!keep(value)) {
        try {
          await reader.cancel();
        } catch {
          /* already closed */
        }
        return null;
      }
    }
    return Buffer.concat(chunks, total);
  } finally {
    reader.releaseLock();
  }
}
