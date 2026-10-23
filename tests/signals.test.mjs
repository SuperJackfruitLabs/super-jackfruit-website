import assert from 'node:assert/strict';
import test from 'node:test';
import { signalPhase, CYCLE } from '../src/scripts/village/signals.mjs';

test('the through road and the side street are never both allowed to go', () => {
  for (let t = 0; t < CYCLE * 2; t += 0.1) {
    const main = signalPhase(t, true);
    const side = signalPhase(t, false);
    assert.ok(main === 'red' || side === 'red', `at ${t.toFixed(1)} s main is ${main} and side is ${side}`);
  }
});

test('each approach gets green, then amber, then red, every cycle', () => {
  for (const main of [true, false]) {
    const seen = [];
    for (let t = 0; t < CYCLE; t += 0.25) {
      const p = signalPhase(t, main);
      if (seen[seen.length - 1] !== p) seen.push(p);
    }
    const order = seen.join(' ');
    assert.ok(/green amber red/.test(order), `${main ? 'main' : 'side'}: ${order}`);
  }
});

test('an offset shifts the cycle, and any time of day works', () => {
  assert.equal(signalPhase(5, true, 0), signalPhase(5 + CYCLE * 1000, true, 0));
  assert.equal(signalPhase(5, true, 14), signalPhase(19, true, 0));
  assert.equal(signalPhase(-3, true), signalPhase(CYCLE - 3, true));
});
