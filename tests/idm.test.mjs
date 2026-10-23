import assert from 'node:assert/strict';
import test from 'node:test';
import { freeAcc, brake, stopAt, bendSpeed, makeCurve, curveAt } from '../src/scripts/village/idm.mjs';

const driver = { a: 1.6, b: 3, T: 1.3, s0: 2.5, aLat: 2.8 };

/** drive a follower behind a leader standing still `start` metres ahead; returns the closest gap */
function queueBehindStoppedCar(start, speed) {
  let gap = start;
  let v = speed;
  let closest = gap;
  for (let i = 0; i < 60 * 30; i++) {
    const dt = 1 / 60;
    const acc = Math.max(-9, freeAcc(driver, v, 7) + brake(driver, v, gap, 0));
    v = Math.max(0, v + acc * dt);
    gap -= v * dt;
    closest = Math.min(closest, gap);
  }
  return { closest, v };
}

test('a free road brings a driver up to the speed they want and no further', () => {
  let v = 0;
  for (let i = 0; i < 60 * 60; i++) v += freeAcc(driver, v, 7) / 60;
  assert.ok(Math.abs(v - 7) < 0.05, `settled at ${v}`);
  assert.ok(freeAcc(driver, 8, 7) < 0, 'over the limit it eases off');
});

test('a driver queues behind a stopped car, standing about s0 short of it', () => {
  for (const [start, speed] of [[60, 7], [25, 7], [12, 3]]) {
    const { closest, v } = queueBehindStoppedCar(start, speed);
    assert.ok(closest > 0.5, `from ${start} m at ${speed} m/s it closed to ${closest.toFixed(2)} m`);
    assert.ok(closest < driver.s0 + 1, `it stopped ${closest.toFixed(2)} m short, too far back`);
    assert.ok(v < 0.05, 'and stays stopped');
  }
});

test('braking is always a brake, and a line is stopped for', () => {
  assert.ok(brake(driver, 5, 30, 5) <= 0);
  assert.ok(brake(driver, 5, 5, 0) < brake(driver, 5, 20, 0), 'nearer is harder');
  assert.ok(stopAt(driver, 6, 3) < -driver.b, 'a line 3 m off at 6 m/s needs hard braking');
});

test('tighter bends are taken slower', () => {
  assert.ok(bendSpeed(driver, 1 / 3) < bendSpeed(driver, 1 / 8));
  assert.ok(Math.abs(bendSpeed(driver, 1 / 5) - Math.sqrt(2.8 * 5)) < 1e-9);
});

test('a corner curve leaves and arrives along the given headings', () => {
  // heading south, turning to head east round a 5 m corner
  const c = makeCurve(0, 0, 0, -1, 5, -5, 1, 0);
  const a = curveAt(c, 0);
  const b = curveAt(c, 1);
  assert.deepEqual([a.x, a.z], [0, 0]);
  assert.deepEqual([b.x, b.z], [5, -5]);
  // control points sit along each heading, so the ends are tangent to them
  assert.ok(c.x1 === 0 && c.z1 < 0);
  assert.ok(c.z2 === -5 && c.x2 < 5);
  // the middle bulges toward the inside corner like a quarter circle (radius 5 → 1.46 m in)
  const m = curveAt(c, 0.5);
  assert.ok(Math.abs(Math.hypot(m.x - 5, m.z) - 5) < 0.1, `mid-point ${m.x.toFixed(2)},${m.z.toFixed(2)}`);
});
