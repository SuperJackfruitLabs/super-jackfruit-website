import assert from 'node:assert/strict';
import test from 'node:test';
import { createCollisionGrid } from '../src/scripts/village/collision-grid.mjs';

function box(cx, cz, hx, hz, rotY = 0) {
  return { cx, cz, hx, hz, cos: Math.cos(rotY), sin: Math.sin(rotY) };
}

function gridFor(colliders, cellSize = 4) {
  const grid = createCollisionGrid(cellSize);
  for (const collider of colliders) grid.add(collider);
  return grid;
}

function resolve(candidatesAt, initial, radius) {
  const pos = { ...initial };
  const impact = { x: 0, z: 0, depth: 0 };
  for (let pass = 0; pass < 2; pass++) {
    const px = pos.x;
    const pz = pos.z;
    for (const c of candidatesAt(px, pz, radius)) {
      const wx = px - c.cx;
      const wz = pz - c.cz;
      const reach = c.hx + c.hz + 4;
      if (wx > reach || wx < -reach || wz > reach || wz < -reach) continue;
      const lx = wx * c.cos - wz * c.sin;
      const lz = wx * c.sin + wz * c.cos;
      const clx = Math.max(-c.hx, Math.min(c.hx, lx));
      const clz = Math.max(-c.hz, Math.min(c.hz, lz));
      let dxl = lx - clx;
      let dzl = lz - clz;
      const d2 = dxl * dxl + dzl * dzl;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          dxl *= push;
          dzl *= push;
          if (radius - d > impact.depth) impact.depth = radius - d;
        } else {
          const exits = [
            { d: lx + c.hx, x: -(lx + c.hx + radius), z: 0 },
            { d: c.hx - lx, x: c.hx - lx + radius, z: 0 },
            { d: lz + c.hz, x: 0, z: -(lz + c.hz + radius) },
            { d: c.hz - lz, x: 0, z: c.hz - lz + radius },
          ].sort((a, b) => a.d - b.d)[0];
          dxl = exits.x;
          dzl = exits.z;
          impact.depth = Math.max(impact.depth, radius);
        }
        const wpx = dxl * c.cos + dzl * c.sin;
        const wpz = -dxl * c.sin + dzl * c.cos;
        pos.x += wpx;
        pos.z += wpz;
        impact.x += wpx;
        impact.z += wpz;
      }
    }
  }
  return { pos, impact };
}

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('rotated and large boxes are found around every face across cell boundaries', () => {
  const collider = box(-3, 5, 11, 2, Math.PI / 4);
  const grid = gridFor([collider]);
  const localToWorld = (x, z) => ({
    x: collider.cx + x * collider.cos + z * collider.sin,
    z: collider.cz - x * collider.sin + z * collider.cos,
  });
  const points = [
    localToWorld(0, 0),
    localToWorld(collider.hx + 0.25, 0),
    localToWorld(-collider.hx - 0.25, 0),
    localToWorld(0, collider.hz + 0.25),
    localToWorld(0, -collider.hz - 0.25),
  ];
  for (const point of points) {
    assert.deepEqual(grid.query(point.x, point.z, 0.5), [collider]);
  }
  assert.deepEqual(grid.query(100, 100, 0.5), []);
});

test('multi-cell candidates are unique and retain insertion order', () => {
  const colliders = [
    box(0, 0, 20, 8, 0.3),
    box(1, 1, 2, 2, -0.8),
    box(-2, 3, 9, 1, 1.1),
  ];
  const grid = gridFor(colliders);
  assert.deepEqual(grid.query(0, 0, 12), colliders);
});

test('a centre inside a rotated box still exits through the nearest local face', () => {
  const collider = box(0, 0, 4, 2, 0);
  const grid = gridFor([collider]);
  const actual = resolve((x, z, radius) => grid.query(x, z, radius), { x: 0.5, z: 0.25 }, 0.5);
  assert.deepEqual(actual, {
    pos: { x: 0.5, z: 2.5 },
    impact: { x: 0, z: 2.25, depth: 0.5 },
  });

  const rotated = box(-8, -7, 5, 1, Math.PI / 3);
  const rotatedGrid = gridFor([rotated]);
  const brute = () => [rotated];
  const broadPhase = (x, z, radius) => rotatedGrid.query(x, z, radius);
  assert.deepEqual(
    resolve(broadPhase, { x: rotated.cx, z: rotated.cz }, 0.75),
    resolve(brute, { x: rotated.cx, z: rotated.cz }, 0.75)
  );
});

test('two-pass grid resolution is exactly equivalent to brute force', () => {
  const random = rng(42);
  const colliders = Array.from({ length: 60 }, () => box(
    (random() - 0.5) * 80,
    (random() - 0.5) * 80,
    0.25 + random() * 14,
    0.25 + random() * 8,
    random() * Math.PI * 2
  ));
  const grid = gridFor(colliders, 7);
  const brute = () => colliders;
  const broadPhase = (x, z, radius) => grid.query(x, z, radius);

  for (let i = 0; i < 250; i++) {
    const initial = { x: (random() - 0.5) * 100, z: (random() - 0.5) * 100 };
    const radius = 0.1 + random() * 3;
    assert.deepEqual(resolve(broadPhase, initial, radius), resolve(brute, initial, radius));
  }
});
