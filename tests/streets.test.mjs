import assert from 'node:assert/strict';
import test from 'node:test';
import { layStreets, route } from '../src/scripts/village/streets.mjs';

const run = (x0, z0, x1, z1) => {
  const out = [];
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= n; i++) out.push([x0 + Math.sign(x1 - x0) * i, z0 + Math.sign(z1 - z0) * i]);
  return out;
};
// a spine with one bend, as the village's is shaped, and a district street off it
const spine = [...run(0, 1, 0, -10), ...run(1, -10, 3, -10), ...run(3, -11, 3, -18)];
const alley = run(4, -13, 9, -13);
const options = {
  seed: 16,
  taken: [...spine, ...alley],
  regions: [
    { x0: -13, x1: -4, z0: 3, z1: -20, connect: [{ from: [0, -6], dir: [-1, 0] }] },
    { x0: 5, x1: 13, z0: 3, z1: -8, connect: [{ from: [3, -10], dir: [0, 1] }] },
  ],
};
const key = ([x, z]) => `${x},${z}`;

test('the same seed lays the same town', () => {
  assert.deepEqual(layStreets(options), layStreets(options));
  assert.notDeepEqual(layStreets(options), layStreets({ ...options, seed: 17 }));
});

test('a route leaves along its heading, jogs half way, and needs room for the S-bend', () => {
  assert.deepEqual(route([0, 0], [6, 0], [1, 0]), [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  const jog = route([0, 0], [6, 2], [1, 0]);
  assert.deepEqual(jog, [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [4, 2], [5, 2]]);
  assert.equal(route([0, 0], [3, 1], [1, 0]), null, 'too short to jog');
  assert.equal(route([0, 0], [-6, 0], [1, 0]), null, 'the wrong way');
});

test('every back street is reachable from the named streets', () => {
  const streets = layStreets(options);
  assert.ok(streets.length >= 6, `only ${streets.length} streets`);
  const named = new Set(options.taken.map(key));
  const reached = new Set(named);
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of streets) {
      const ends = [s.from, s.to ?? s.cells[s.cells.length - 1]].map(key);
      if (ends.some((k) => reached.has(k)) && !ends.every((k) => reached.has(k))) {
        ends.forEach((k) => reached.add(k));
        grew = true;
      }
    }
  }
  for (const s of streets) assert.ok(reached.has(key(s.from)), `${s.id} is cut off`);
});

// ground right up against the spine, and lattice lines close together, so the
// generator has to refuse streets that would run alongside one another
const crowded = {
  ...options,
  minStep: 3,
  maxStep: 3,
  regions: [{ x0: -7, x1: -1, z0: 1, z1: -12, connect: [{ from: [0, -4], dir: [-1, 0] }] }],
};

for (const [name, opts] of [['spread out', options], ['crowded', crowded]]) test(`${name}: streets never run alongside one another or cross a named street`, () => {
  const streets = layStreets(opts);
  const named = new Set(options.taken.map(key));
  const owner = new Map();
  // the crossings belong to the streets that meet there
  for (const s of streets) for (const c of [s.from, ...(s.to ? [s.to] : [])]) if (!named.has(key(c))) owner.set(key(c), `${s.id} crossing`);
  for (const s of streets) for (const c of s.cells) {
    assert.ok(!named.has(key(c)), `${s.id} runs over a named street at ${key(c)}`);
    assert.ok(!owner.has(key(c)) || owner.get(key(c)).endsWith('crossing'), `${s.id} and ${owner.get(key(c))} share ${key(c)}`);
    owner.set(key(c), s.id);
  }
  // a cell may only touch its own street, or the crossings at that street's ends
  for (const s of streets) {
    const own = new Set([...s.cells, s.from, ...(s.to ? [s.to] : [])].map(key));
    for (const [x, z] of s.cells) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = key([x + dx, z + dz]);
        if (own.has(n) || !(owner.has(n) || named.has(n))) continue;
        const nearEnd = [s.from, s.to].filter(Boolean).some((e) => Math.max(Math.abs(e[0] - x), Math.abs(e[1] - z)) <= 1);
        // the street leaving a named one may cross that street's verge on its way out
        if (named.has(n) && named.has(key(s.from)) && Math.max(Math.abs(s.from[0] - x), Math.abs(s.from[1] - z)) <= 2) continue;
        assert.ok(nearEnd, `${s.id} at ${x},${z} runs alongside ${owner.get(n) ?? 'a named street'}`);
      }
    }
  }
  // nor does a crossing sit beside a named street without joining it
  for (const s of streets) {
    for (const c of [s.from, ...(s.to ? [s.to] : [])]) {
      if (named.has(key(c))) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        assert.ok(!named.has(key([c[0] + dx, c[1] + dz])), `${s.id}'s crossing ${key(c)} sits beside a named street`);
      }
    }
  }
  assert.ok(streets.length > 0);
});

test('a loose end finishes in a turning circle', () => {
  for (const s of layStreets(options)) {
    if (!s.to) assert.equal(s.culDeSac, 9, `${s.id} just stops`);
  }
});
