// How the village's drivers decide how hard to press: the Intelligent Driver
// Model (Treiber, Hennecke & Helbing, 2000), and the corner speed and junction
// curves that go with it.
//
// Adapted from slop-newyork (js/traffic.js: freeAcc, brake, stopAt, bendSpeed;
// js/road-network.js: makeCurve, curvePoint), https://github.com/mrdoob/slop-newyork
//
// MIT License
//
// Copyright (c) 2026 Mr.doob
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * A driver's temperament: max acceleration a and comfortable braking b (m/s²),
 * time headway T (s), standstill gap s0 (m), and the sideways acceleration aLat
 * (m/s²) they accept in a bend.
 * @typedef {{ a: number, b: number, T: number, s0: number, aLat: number }} Driver
 */

/** Acceleration on a free road, at `speed`, toward a wished-for speed `v0`. */
export function freeAcc(driver, speed, v0) {
  return driver.a * (1 - (speed / Math.max(v0, 0.1)) ** 4);
}

/**
 * The braking term for an obstacle `gap` metres ahead (bumper to bumper)
 * moving at `otherSpeed`. Always ≤ 0; add it to freeAcc.
 */
export function brake(driver, speed, gap, otherSpeed, s0 = driver.s0, T = driver.T) {
  const { a, b } = driver;
  const desired = s0 + Math.max(0, speed * T + (speed * (speed - otherSpeed)) / (2 * Math.sqrt(a * b)));
  return -a * (desired / Math.max(gap, 0.1)) ** 2;
}

/** ...and for a line `d` metres ahead to stop `s0` short of: no time gap to keep to a line. */
export function stopAt(driver, speed, d, s0 = 1) {
  return brake(driver, speed, d, 0, s0, 0);
}

/** The fastest a bend of curvature `curv` (1/radius) can be taken at. */
export function bendSpeed(driver, curv) {
  return Math.sqrt(driver.aLat / Math.max(curv, 1e-3));
}

/**
 * A cubic Bézier from (x0, z0), leaving along unit (dx0, dz0), to (x3, z3),
 * arriving along unit (dx3, dz3): a quarter-circle-like arc round a corner, an
 * S-bend for a sideways shift. Returns its control points.
 */
export function makeCurve(x0, z0, dx0, dz0, x3, z3, dx3, dz3) {
  const cross = dx0 * dz3 - dz0 * dx3;
  let k0;
  let k3;
  if (Math.abs(cross) < 0.5) {
    k0 = k3 = Math.hypot(x3 - x0, z3 - z0) / 3;
  } else {
    // where the two headings' lines meet; 0.552 of each leg rounds the corner like a circle
    const t = ((x3 - x0) * dz3 - (z3 - z0) * dx3) / cross;
    k0 = 0.552 * Math.abs(t);
    k3 = 0.552 * Math.hypot(x3 - (x0 + dx0 * t), z3 - (z0 + dz0 * t));
  }
  return { x0, z0, x1: x0 + dx0 * k0, z1: z0 + dz0 * k0, x2: x3 - dx3 * k3, z2: z3 - dz3 * k3, x3, z3 };
}

/** Point on a curve from makeCurve at parameter t, 0..1. */
export function curveAt(c, t, out = { x: 0, z: 0 }) {
  const u = 1 - t;
  out.x = u * u * u * c.x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x3;
  out.z = u * u * u * c.z0 + 3 * u * u * t * c.z1 + 3 * u * t * t * c.z2 + t * t * t * c.z3;
  return out;
}
