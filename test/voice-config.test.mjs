import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVoiceConfig, normaliseConfig, greeting, partOfDay, DEFAULT_VOICE_CONFIG } from '../src/voice/assistant/config.js';

const ok = (json) => async () => ({ ok: true, json: async () => json });

test('service config is normalised and online', async () => {
  const r = await loadVoiceConfig({ fetchImpl: ok({ assistantName: 'Jarvis', userName: 'Edison', followUpTimeoutS: 20, wakeFallback: true, wakeNotice: 'x' }), candidates: [''] });
  assert.equal(r.online, true);
  assert.equal(r.config.userName, 'Edison');
  assert.equal(r.config.followUpTimeoutS, 20);
  assert.equal(r.config.wakeFallback, true);
});

test('service down gives defaults, online:false, never throws', async () => {
  const r = await loadVoiceConfig({ fetchImpl: async () => { throw new TypeError('fetch failed'); }, candidates: ['', 'http://127.0.0.1:8791'] });
  assert.equal(r.online, false);
  assert.deepEqual({ ...r.config, models: {} }, { ...DEFAULT_VOICE_CONFIG, models: {} });
});

test('falls through to next candidate', async () => {
  const seen = [];
  const f = async (url) => { seen.push(url); if (!url.startsWith('http://')) throw new Error('no'); return { ok: true, json: async () => ({ voice: 'bm_lewis' }) }; };
  const r = await loadVoiceConfig({ fetchImpl: f, candidates: ['', 'http://127.0.0.1:8791'] });
  assert.equal(r.online, true);
  assert.equal(r.base, 'http://127.0.0.1:8791');
  assert.equal(r.config.voice, 'bm_lewis');
  assert.equal(seen.length, 2);
});

test('HTTP error and junk JSON fall back', async () => {
  assert.equal((await loadVoiceConfig({ fetchImpl: async () => ({ ok: false }), candidates: [''] })).online, false);
  assert.equal((await loadVoiceConfig({ fetchImpl: ok('nope'), candidates: [''] })).online, false);
});

test('bad values are replaced by defaults', () => {
  const c = normaliseConfig({ followUpTimeoutS: 'abc', listenTimeoutS: -4, assistantName: '  ', wakeMode: 'weird' });
  assert.equal(c.followUpTimeoutS, 12);
  assert.equal(c.listenTimeoutS, 8);
  assert.equal(c.assistantName, 'Pheonix');
  assert.equal(c.wakeMode, 'model');
});

test('greeting is time-aware and uses the user name', () => {
  const at = (h) => new Date(2026, 0, 1, h, 0);
  assert.equal(partOfDay(at(8)), 'morning');
  assert.equal(partOfDay(at(14)), 'afternoon');
  assert.equal(partOfDay(at(21)), 'evening');
  assert.equal(partOfDay(at(2)), 'evening');
  assert.equal(greeting({ userName: 'Edison', addressAs: 'sir' }, at(21)), 'Good evening, Edison. How may I assist you?');
  assert.equal(greeting({ userName: '', addressAs: 'sir' }, at(9)), 'Good morning, sir. How may I assist you?');
});
