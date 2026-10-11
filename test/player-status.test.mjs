import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduce, kindForFeed, STALL_MS, CONNECT_TIMEOUT_MS } from '../src/player/status/index.js';

test('kindForFeed', () => {
  assert.equal(kindForFeed('hls'), 'video');
  assert.equal(kindForFeed('mp4'), 'video');
  assert.equal(kindForFeed('image'), 'snapshot');
  assert.equal(kindForFeed('mjpeg'), 'snapshot');
  assert.equal(kindForFeed('embed'), 'embed');
  assert.equal(kindForFeed('whatever'), 'embed');
});

test('video is never LIVE from a single timeupdate or from playing alone', () => {
  let s = initialState('video', 0);
  assert.equal(s.status, 'connecting');
  s = reduce(s, { type: 'timeupdate', currentTime: 0, now: 100 });
  assert.equal(s.status, 'connecting');
  s = reduce(s, { type: 'timeupdate', currentTime: 0, now: 200 });
  assert.equal(s.status, 'connecting');
});

test('video becomes LIVE only when currentTime advances', () => {
  let s = initialState('video', 0);
  s = reduce(s, { type: 'timeupdate', currentTime: 1, now: 100 });
  s = reduce(s, { type: 'timeupdate', currentTime: 1.5, now: 600 });
  assert.equal(s.status, 'live');
});

test('live video that stops advancing goes OFFLINE after the stall window', () => {
  let s = initialState('video', 0);
  s = reduce(s, { type: 'timeupdate', currentTime: 1, now: 100 });
  s = reduce(s, { type: 'timeupdate', currentTime: 2, now: 1100 });
  s = reduce(s, { type: 'tick', now: 1100 + STALL_MS - 1 });
  assert.equal(s.status, 'live');
  s = reduce(s, { type: 'tick', now: 1100 + STALL_MS + 1 });
  assert.equal(s.status, 'offline');
  assert.equal(s.reason, 'stalled');
  // recovers if playback resumes
  s = reduce(s, { type: 'timeupdate', currentTime: 3, now: 20000 });
  assert.equal(s.status, 'live');
});

test('video that never starts times out OFFLINE; fatal error is OFFLINE', () => {
  let s = initialState('video', 0);
  s = reduce(s, { type: 'tick', now: CONNECT_TIMEOUT_MS + 1 });
  assert.deepEqual([s.status, s.reason], ['offline', 'timeout']);
  const e = reduce(initialState('video', 0), { type: 'error', reason: 'hls-fatal' });
  assert.equal(e.status, 'offline');
});

test('snapshot: SNAPSHOT after a frame, OFFLINE after two failures, recovers', () => {
  let s = initialState('snapshot', 0);
  assert.equal(s.status, 'connecting');
  s = reduce(s, { type: 'frame-ok', now: 10 });
  assert.equal(s.status, 'snapshot');
  s = reduce(s, { type: 'frame-fail', code: 502 });
  assert.equal(s.status, 'snapshot');
  s = reduce(s, { type: 'frame-fail', code: 502 });
  assert.deepEqual([s.status, s.reason], ['offline', 'http-502']);
  s = reduce(s, { type: 'frame-ok', now: 99 });
  assert.equal(s.status, 'snapshot');
  assert.equal(s.failures, 0);
});

test('snapshot goes OFFLINE when frames go stale', () => {
  let s = reduce(initialState('snapshot', 0), { type: 'frame-ok', now: 0 });
  s = reduce(s, { type: 'tick', now: 20000, staleMs: 40000 });
  assert.equal(s.status, 'snapshot');
  s = reduce(s, { type: 'tick', now: 40001, staleMs: 40000 });
  assert.equal(s.status, 'offline');
});

test('restricted providers are UNAVAILABLE, never OFFLINE or LIVE', () => {
  const s = reduce(initialState('snapshot', 0), { type: 'frame-fail', code: 403 });
  assert.equal(s.status, 'unavailable');
  const e = initialState('embed', 0);
  assert.equal(e.status, 'unavailable');
  assert.equal(reduce(e, { type: 'timeupdate', currentTime: 5, now: 1 }).status, 'unavailable');
});
