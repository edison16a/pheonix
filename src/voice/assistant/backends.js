/**
 * Loading the pieces the assistant talks through: the config from the local service, and the
 * client (real service, mock, or injected) and speaker. The real client and speaker are imported
 * on demand so the mic and audio code is never loaded for someone who keeps voice off.
 */
import { loadVoiceConfig } from './config.js';
import { lsGet, MOCK_KEY } from './localPrefs.js';

/** Ask the service for its config. Falls back to defaults (and online:false) if it is down. */
export function loadInitialConfig(s) {
  return s.deps.loadConfig ? s.deps.loadConfig() : loadVoiceConfig({ overrides: s.configOverride ?? {} });
}

/** Real service client by default; the fake dev client when `?voice=mock` or the pref asks for it. */
export async function makeClient(s) {
  const { deps, config, base, online } = s;
  const wantMock = deps.mock ?? (config.mock || /[?&]voice=mock\b/.test(globalThis.location?.search ?? '') || lsGet(MOCK_KEY) === '1');
  if (deps.createClient) return deps.createClient({ base, config, online });
  if (wantMock) {
    const { createMockClient } = await import('../service/mockService.js');
    return createMockClient({ config });
  }
  const { createServiceClient } = await import('../service/serviceClient.js');
  return createServiceClient({ base });
}

/** Service TTS only when the service is up and has the voice model, otherwise browser speech. */
export async function makeSpeaker(s) {
  const { deps, config, base, kind, online } = s;
  if (deps.createSpeaker) return deps.createSpeaker({ base, config, kind, online });
  const { createSpeaker } = await import('../service/speech.js');
  const ttsOk = kind === 'service' && online && config.models?.tts?.ok !== false;
  return createSpeaker({ base, voice: config.voice, useService: ttsOk });
}

/** Stop listening to the client and close it (releases the microphone). Safe to call twice. */
export function teardownClient(s) {
  s.offClient?.(); s.offClient = null;
  try { s.client?.close(); } catch { /* already closed */ }
  s.client = null;
}
