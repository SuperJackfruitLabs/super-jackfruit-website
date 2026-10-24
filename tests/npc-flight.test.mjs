import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NPC_DESCENT_TIME,
  NPC_FLIGHT_HEIGHT,
  NPC_FLIGHT_TIME,
  NPC_LAUNCH_TIME,
  chooseLanding,
  createFlight,
  sampleFlight,
  sweptContact,
} from '../src/scripts/village/npc-flight.mjs';

test('a fast vehicle cannot tunnel through an NPC between frames', () => {
  assert.equal(sweptContact(0, 0, 30, 0, 15, 0.5, 1.4), true);
  assert.equal(sweptContact(0, 0, 30, 0, 15, 2, 1.4), false);
  assert.equal(sweptContact(2, 2, 2, 2, 2.5, 2, 1), true);
});

test('safe landing prefers home, then a nearby clear candidate', () => {
  const home = { x: 1, z: 2, y: 0.15 };
  assert.deepEqual(chooseLanding({ x: 0, z: 0, home }, () => true), home);
  const landing = chooseLanding({ x: 10, z: 20, home }, (x, z) => x > 10 && z === 20, 0);
  assert.ok(landing);
  assert.equal(landing.z, 20);
  assert.ok(landing.x >= 12);
  assert.equal(landing.y, 0);
  assert.equal(chooseLanding({ x: 0, z: 0 }, () => false), null);
});

test('flight launches high, opens its canopy, and lands exactly on target', () => {
  const flight = createFlight({ x: 0, z: 0, y: 0.15 }, { x: 3, z: -2, y: 0 });
  const launch = sampleFlight(flight, NPC_LAUNCH_TIME);
  assert.equal(launch.phase, 'parachute');
  assert.ok(Math.abs(launch.y - (0.15 + NPC_FLIGHT_HEIGHT)) < 1e-9);
  assert.equal(launch.canopy, 0);

  const opened = sampleFlight(flight, 0.35);
  assert.equal(opened.canopy, 1);
  assert.ok(opened.y < launch.y && opened.y > launch.y - 0.2);
  let previousY = opened.y;
  while (flight.elapsed < NPC_FLIGHT_TIME) {
    const point = sampleFlight(flight, 0.1);
    assert.ok(point.y <= previousY + 1e-9);
    previousY = point.y;
  }
  const landed = sampleFlight(flight, 0);
  assert.equal(landed.phase, 'landed');
  assert.equal(landed.landed, true);
  assert.equal(landed.canopy, 0);
  assert.equal(landed.x, 3);
  assert.equal(landed.z, -2);
  assert.equal(landed.y, 0);
  assert.equal(flight.elapsed, NPC_FLIGHT_TIME);
  assert.equal(NPC_DESCENT_TIME > NPC_LAUNCH_TIME, true);
});
