import { PROXY_USER_AGENT } from '../shared/upstream.js';
import { NSW_IMAGE_ORIGIN, NSW_IMAGE_USER_AGENT } from '../providers/nsw.js';

/**
 * Image hosts that only serve frames to browser-identified clients, keyed by
 * exact hostname. Every other upstream sees the proxy's own identifying
 * User-Agent. Keyed on host, not on a URL substring, so a look-alike host or a
 * path that merely mentions the host never inherits the header.
 */
const CCTV_IMAGE_USER_AGENT_BY_HOST = Object.freeze({
  [new URL(NSW_IMAGE_ORIGIN).hostname]: NSW_IMAGE_USER_AGENT,
});

/**
 * User-Agent for one upstream frame request.
 *
 * @param {string} url
 * @returns {string}
 */
export function cctvUpstreamUserAgent(url) {
  try {
    return (
      CCTV_IMAGE_USER_AGENT_BY_HOST[new URL(url).hostname] || PROXY_USER_AGENT
    );
  } catch {
    return PROXY_USER_AGENT;
  }
}
