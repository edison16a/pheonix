/**
 * Watch a client response for an early goodbye.
 *
 * Bound BEFORE the upstream request goes out, because most of the waiting
 * happens before any header comes back: a viewer who closes the tab while a
 * slow camera is still thinking would otherwise leave that request running with
 * nobody to receive it.
 *
 * @param {import('http').ServerResponse} res - The client response.
 * @returns {{signal: AbortSignal, closed: boolean}} `signal` cancels the
 *   upstream request; `closed` says the client left before the response ended.
 */
export function watchDownstreamClose(res) {
  const controller = new AbortController();
  const state = {
    signal: controller.signal,
    closed: false,
  };
  const onClose = () => {
    // A response that ended normally also emits close; only an early one counts.
    if (res.writableEnded) return;
    state.closed = true;
    controller.abort();
  };
  res.once?.('close', onClose);
  res.once?.('error', onClose);
  return state;
}
