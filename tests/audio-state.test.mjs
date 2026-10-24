import assert from 'node:assert/strict';
import test from 'node:test';
import { musicMuted } from '../src/scripts/village/audio-state.mjs';

test('music is audible only when globally unmuted and explicitly enabled', () => {
  assert.equal(musicMuted(false, true), false);
  assert.equal(musicMuted(true, true), true);
  assert.equal(musicMuted(false, false), true);
  assert.equal(musicMuted(true, false), true);
});

test('unmuting globally does not re-enable disabled music', () => {
  const musicOn = false;
  assert.equal(musicMuted(true, musicOn), true);
  assert.equal(musicMuted(false, musicOn), true);
});
