// The other cars on the road.
//
// A handful of Kenney cars (CC0, the same kit as the garage) keep to the right
// of every street, follow the car ahead with the Intelligent Driver Model
// (idm.mjs), slow into bends, turn into and out of the side streets, go round
// the turning circles at the dead ends, and queue behind you. They never drive
// through the visitor: you count as a car ahead to brake for, and a car you
// shove into pushes back (resolve()).
//
// The lanes are the RoadNetwork's own centrelines, offset to the right. Where
// streets meet, every lane that arrives is joined to every lane that leaves by
// a Bézier connector; at a dead end, a lane runs on round the turning circle
// into its own reverse.
//
// The cars are a fixed pool (pool.ts): built once, recycled out of sight, the
// count set by the quality tier. Each has a soft contact shadow under it and,
// after dark, head- and taillight sprites — no extra real lights.
//
// The player-relative braking (relateToPlayer, playerGap) is adapted from
// slop-newyork's js/traffic.js, https://github.com/mrdoob/slop-newyork
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
import type * as T from 'three';
import type { Three } from './types';
import type { LoadedGltf, Impact } from './props';
import type { RoadNetwork, RoadSegment } from './road';
import { TILE } from './road';
import { createPool, type ActorPool, type PoolActor, type SpawnRules } from './pool';
import { freeAcc, brake, stopAt, bendSpeed, makeCurve, curveAt } from './idm.mjs';
import { signalPhase } from './signals.mjs';

/** the Kenney cars that live here; the first `count` of them are used */
export const TRAFFIC_MODELS = ['car-sedan', 'car-taxi', 'car-van', 'car-truck', 'car-sports', 'car-sedan', 'car-taxi', 'car-van', 'car-sedan', 'car-taxi'];

/** lane centre, metres right of the street's centreline */
const LANE = 2.1;
/** how far ahead a driver looks for cars, corners and lines */
const LOOKAHEAD = 40;
/** a village driver: gentle, keeps a good gap, takes corners slowly */
const DRIVER = { a: 1.6, b: 3.0, T: 1.3, s0: 2.5, aLat: 2.8 };
/** the speed they'd like, m/s, give or take a little per driver */
const CRUISE = 7;
/** past this, and out of view, a car is recycled */
const RETIRE = 130;
const SPAWN_MIN = 55;
const SPAWN_MAX = 125;
/** the visitor's car, as the drivers see it */
const PLAYER_HALF_W = 0.95;
const PLAYER_HALF_L = 1.6;
/** how far ahead, along its own path, a driver watches for anything in the way */
const SWEEP = 16;
/** how long a driver waits to pull out before they stop minding approaching cars */
const PATIENCE = 7;

/** a polyline sampled about every metre, with arc length and curvature at each sample */
interface Path {
  xs: Float32Array;
  zs: Float32Array;
  ss: Float32Array;
  /** the fastest a driver takes the path at each sample */
  vmax: Float32Array;
  len: number;
}

interface Lane {
  id: string;
  seg: RoadSegment;
  dir: 1 | -1;
  path: Path;
  /** the ways off this lane, by where along it they leave; the last group is the lane's end */
  groups: Array<{ at: number; moves: Move[]; end: boolean }>;
  /** signal stop lines along it, in order */
  stops: Array<{ s: number; signal: Signal; main: boolean }>;
}

/** a junction with traffic lights; its phase is signalPhase(clock, approach, offset) */
interface Signal {
  x: number;
  z: number;
  offset: number;
  /** the lamps of every head facing each approach, so they light together */
  lamps: Record<'main' | 'side', Record<'red' | 'amber' | 'green', T.MeshBasicMaterial>>;
}

interface Move {
  from: Lane;
  at: number;
  path: Path;
  to: Lane;
  toS: number;
  /** a turn out of a side street, or across the oncoming lane: give way first */
  yields: boolean;
  /** the junction it crosses, for giving way; null for a turning circle */
  junction: { x: number; z: number } | null;
}

interface AiCar extends PoolActor {
  id: number;
  root: T.Group;
  wheels: T.Object3D[];
  wheelRadius: number;
  blob: T.Mesh;
  lights: { heads: T.Sprite[]; tails: T.Sprite[]; pool: T.Mesh };
  half: number;
  halfW: number;
  lane: Lane;
  s: number;
  move: Move | null;
  cs: number;
  next: Move | null;
  speed: number;
  v0: number;
  heading: number;
  /** how long it has stood at a give-way line */
  waited: number;
  /** what it is braking for, for the debug hook */
  why: string;
  /** the road just ahead, from sweep() */
  sweepX: Float32Array;
  sweepZ: Float32Array;
}

export interface TrafficPlayer {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface Traffic {
  update(dt: number, player: TrafficPlayer, inView: SpawnRules['inView'], slow: boolean): void;
  applyNight(nightFactor: number): void;
  /** pushes the visitor's car out of any AI car; mutates `pos` */
  resolve(pos: T.Vector3, radius: number): Impact;
  reseed(): void;
  /** for the engine sounds: where each car is, and how fast it goes */
  cars(): ReadonlyArray<{ id: number; x: number; z: number; speed: number; active: boolean }>;
  debug(): { lanes: number; moves: number; signals: Array<{ x: number; z: number; main: string; side: string; stops: number }>; cars: Array<{ x: number; z: number; speed: number; lane: string; why: string }>; pool: { placed: number; reseeds: number } };
}

function softBlob(size: number, inner: string, outer: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * A contact shadow: a rounded box, darkest under the body and soft at its
 * edges, baked into a canvas once. The blur does what an SDF falloff would in
 * a shader, so it works on any WebGL renderer.
 */
function contactShadow(): HTMLCanvasElement {
  const w = 128;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.filter = 'blur(14px)';
  g.fillStyle = 'rgba(0,0,0,1)';
  g.beginPath();
  g.roundRect(30, 34, w - 60, h - 68, 22);
  g.fill();
  return c;
}

export async function createTraffic(
  THREE: Three,
  scene: T.Scene,
  load: (name: string) => Promise<LoadedGltf>,
  road: RoadNetwork,
  count: number,
  shadows: boolean,
  /** junction middles that get traffic lights */
  signalAt: Array<{ x: number; z: number }>,
  addCollider: (x: number, z: number, hx: number, hz: number, rotY: number) => void
): Promise<Traffic> {
  // ---------- paths ----------
  function pathFrom(pts: Array<{ x: number; z: number }>, aLat = DRIVER.aLat): Path {
    const n = pts.length;
    const xs = new Float32Array(n);
    const zs = new Float32Array(n);
    const ss = new Float32Array(n);
    const vmax = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = pts[i].x;
      zs[i] = pts[i].z;
      if (i > 0) ss[i] = ss[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    }
    // curvature from the turn between neighbouring chords, over the distance it took
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      if (b - a < 2) {
        vmax[i] = Infinity;
        continue;
      }
      const h1 = Math.atan2(xs[i] - xs[a], zs[i] - zs[a]);
      const h2 = Math.atan2(xs[b] - xs[i], zs[b] - zs[i]);
      let turn = h2 - h1;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const curv = Math.abs(turn) / Math.max(0.05, (ss[b] - ss[a]) / 2);
      vmax[i] = bendSpeed({ ...DRIVER, aLat }, curv);
    }
    return { xs, zs, ss, vmax, len: ss[n - 1] };
  }

  /** position and heading at arc length s along a path */
  const at = { x: 0, z: 0, h: 0 };
  function pathPoint(p: Path, s: number): typeof at {
    const n = p.ss.length;
    let lo = 0;
    let hi = n - 1;
    if (s <= 0) hi = 1;
    else if (s >= p.len) lo = n - 2;
    else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (p.ss[mid] <= s) lo = mid;
        else hi = mid;
      }
    }
    const span = p.ss[hi] - p.ss[lo] || 1;
    const k = Math.min(1, Math.max(0, (s - p.ss[lo]) / span));
    at.x = p.xs[lo] + (p.xs[hi] - p.xs[lo]) * k;
    at.z = p.zs[lo] + (p.zs[hi] - p.zs[lo]) * k;
    at.h = Math.atan2(p.xs[hi] - p.xs[lo], p.zs[hi] - p.zs[lo]);
    return at;
  }

  /** the slowest the path ahead allows from s, with room to brake down to each bend */
  function bendCap(p: Path, s: number, reach: number, offset = 0): number {
    let cap = Infinity;
    let i = 0;
    while (i < p.ss.length && p.ss[i] < s) i++;
    for (; i < p.ss.length; i++) {
      const d = p.ss[i] - s + offset;
      if (d > reach) break;
      if (p.vmax[i] === Infinity) continue;
      cap = Math.min(cap, Math.sqrt(p.vmax[i] * p.vmax[i] + 2 * DRIVER.b * 0.8 * Math.max(0, d)));
    }
    return cap;
  }

  function bezierPath(x0: number, z0: number, h0: number, x3: number, z3: number, h3: number): Array<{ x: number; z: number }> {
    const c = makeCurve(x0, z0, Math.sin(h0), Math.cos(h0), x3, z3, Math.sin(h3), Math.cos(h3));
    const approx = Math.hypot(x3 - x0, z3 - z0) * 1.3;
    const n = Math.max(8, Math.ceil(approx));
    return Array.from({ length: n + 1 }, (_, i) => ({ ...curveAt(c, i / n) }));
  }

  // ---------- lanes ----------
  const lanes: Lane[] = [];
  const probe = new THREE.Vector3();
  for (const seg of road.all) {
    for (const dir of [1, -1] as const) {
      const n = Math.max(8, Math.ceil(seg.length));
      const pts = Array.from({ length: n + 1 }, (_, i) => {
        const t = dir > 0 ? i / n : 1 - i / n;
        seg.curve.getPointAt(t, probe);
        const p = seg.perp(t);
        return { x: probe.x + p.x * LANE * dir, z: probe.z + p.z * LANE * dir };
      });
      lanes.push({ id: `${seg.id}${dir > 0 ? '+' : '-'}`, seg, dir, path: pathFrom(pts), groups: [], stops: [] });
    }
  }
  const reverseOf = (l: Lane) => lanes.find((o) => o.seg === l.seg && o.dir !== l.dir)!;

  // ---------- junctions: every lane in, joined to every lane out ----------
  // A side street begins (and the one that rejoins also ends) at the edge of a
  // spine cell; that cell is the junction, a tile square.
  const junctions: Array<{ x: number; z: number }> = [];
  for (const b of road.branches) {
    for (const end of [0, 1] as const) {
      if (end === 1 && b.end.r > 0) continue; // a dead end, not a junction
      const p = b.curve.getPointAt(end);
      const tan = b.curve.getTangentAt(end);
      const k = end === 0 ? -TILE / 2 : TILE / 2;
      const j = { x: p.x + tan.x * k, z: p.z + tan.z * k };
      // a crossing of several back streets is one junction, however many end there
      if (!junctions.some((o) => Math.hypot(o.x - j.x, o.z - j.z) < 1)) junctions.push(j);
    }
  }
  // ---------- traffic lights ----------
  const signals: Signal[] = [];
  const iron = new THREE.MeshLambertMaterial({ color: 0x2d2f33 });
  const housing = new THREE.MeshLambertMaterial({ color: 0x1d1f22 });
  const LAMP_ON = { red: 0xff3b2f, amber: 0xffb020, green: 0x37d67a } as const;
  const dim = (hex: number) => new THREE.Color(hex).multiplyScalar(0.16);
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.08, 3.1, 8);
  const headGeo = new THREE.BoxGeometry(0.42, 1.12, 0.3);
  const lampGeo = new THREE.CircleGeometry(0.12, 14);
  function buildSignal(j: { x: number; z: number }, offset: number): Signal {
    const set = () => ({
      red: new THREE.MeshBasicMaterial({ color: dim(LAMP_ON.red) }),
      amber: new THREE.MeshBasicMaterial({ color: dim(LAMP_ON.amber) }),
      green: new THREE.MeshBasicMaterial({ color: dim(LAMP_ON.green) }),
    });
    return { x: j.x, z: j.z, offset, lamps: { main: set(), side: set() } };
  }
  function signalHead(sig: Signal, main: boolean, x: number, z: number, facing: number): void {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, iron);
    pole.position.y = 1.55;
    const head = new THREE.Mesh(headGeo, housing);
    head.position.y = 3.1 + 0.5;
    g.add(pole, head);
    const lamps = sig.lamps[main ? 'main' : 'side'];
    (['red', 'amber', 'green'] as const).forEach((k, i) => {
      const lamp = new THREE.Mesh(lampGeo, lamps[k]);
      lamp.position.set(0, 3.6 + 0.34 - i * 0.34, 0.152);
      g.add(lamp);
    });
    g.position.set(x, 0, z);
    g.rotation.y = facing;
    g.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = shadows; });
    scene.add(g);
    addCollider(x, z, 0.2, 0.2, 0);
  }
  /** the wall clock, so every visitor's lights agree */
  const clock = () => Date.now() / 1000;
  function lightSignals(): void {
    const now = clock();
    for (const sig of signals) {
      for (const approach of ['main', 'side'] as const) {
        const phase = signalPhase(now, approach === 'main', sig.offset);
        for (const k of ['red', 'amber', 'green'] as const) {
          sig.lamps[approach][k].color.set(k === phase ? LAMP_ON[k] : dim(LAMP_ON[k]).getHex());
        }
      }
    }
  }

  const moves: Move[] = [];
  const inBox = (j: { x: number; z: number }, x: number, z: number) =>
    Math.abs(x - j.x) <= TILE / 2 + 0.3 && Math.abs(z - j.z) <= TILE / 2 + 0.3;
  for (const j of junctions) {
    const arrive: Array<{ lane: Lane; s: number }> = [];
    const leave: Array<{ lane: Lane; s: number }> = [];
    for (const l of lanes) {
      const p = l.path;
      let i0 = -1;
      let i1 = -1;
      for (let i = 0; i < p.ss.length; i++) {
        if (!inBox(j, p.xs[i], p.zs[i])) continue;
        if (i0 < 0) i0 = i;
        i1 = i;
      }
      if (i0 < 0) continue;
      if (i0 > 0) arrive.push({ lane: l, s: p.ss[i0] });
      if (i1 < p.ss.length - 1) leave.push({ lane: l, s: p.ss[i1] });
    }
    const lit = signalAt.find((q) => Math.hypot(q.x - j.x, q.z - j.z) < TILE / 2);
    if (lit) {
      const signal = buildSignal(j, signals.length * 11);
      signals.push(signal);
      for (const a of arrive) {
        const main = a.lane.seg === road.main;
        a.lane.stops.push({ s: a.s - 0.6, signal, main });
        a.lane.stops.sort((p, q) => p.s - q.s);
        // a head on the kerb at the stop line, facing the drivers it stops
        const p = pathPoint(a.lane.path, a.s - 1);
        const hx = Math.sin(p.h), hz = Math.cos(p.h);
        const kerb = TILE / 2 - LANE + 1.1; // from the lane's middle out past the kerb
        signalHead(signal, main, p.x - hz * kerb, p.z + hx * kerb, p.h + Math.PI);
      }
    }
    for (const a of arrive) {
      for (const b of leave) {
        if (a.lane.seg === b.lane.seg) continue; // carrying on, or a U-turn in the junction
        const p0 = pathPoint(a.lane.path, a.s);
        const x0 = p0.x, z0 = p0.z, h0 = p0.h;
        const p3 = pathPoint(b.lane.path, b.s);
        const pts = bezierPath(x0, z0, h0, p3.x, p3.z, p3.h);
        // left of the way in is (cos h, −sin h): a turn that ends up there crosses the oncoming lane
        const left = (p3.x - x0) * Math.cos(h0) - (p3.z - z0) * Math.sin(h0);
        const fromSide = a.lane.seg !== road.main;
        moves.push({
          from: a.lane, at: a.s, path: pathFrom(pts), to: b.lane, toS: b.s,
          yields: fromSide || left > 1, junction: j,
        });
      }
    }
  }

  // ---------- dead ends: on round the turning circle, into the lane back ----------
  {
    const p0 = road.main.curve.getPointAt(0);
    const t0 = road.main.curve.getTangentAt(0);
    const r = 9; // the start's turning circle: the spine's startCulDeSac in village-scene.ts
    const back = Math.sqrt(r * r - (TILE / 2) ** 2);
    const circles = new Map<string, { x: number; z: number; r: number }>([
      ['main-', { x: p0.x - t0.x * back, z: p0.z - t0.z * back, r }],
    ]);
    for (const seg of road.all) if (seg.end.r > 0) circles.set(`${seg.id}+`, seg.end);
    for (const l of lanes) {
      const c = circles.get(l.id);
      if (!c) continue;
      const end = pathPoint(l.path, l.path.len);
      const ex = end.x, ez = end.z, eh = end.h;
      const fx = Math.sin(eh), fz = Math.cos(eh);
      // right of travel is (−fz, fx)
      const rx = -fz, rz = fx;
      // keep clear of the middle (the square's monument) and the kerb ring
      const rho = c.r >= 12 ? c.r - 4.4 : c.r - 2.6;
      const pts: Array<{ x: number; z: number }> = [];
      // ease out to the circle, half way round anticlockwise (the middle on the left), and back in
      const entry = { x: c.x + rx * rho, z: c.z + rz * rho };
      pts.push(...bezierPath(ex, ez, eh, entry.x, entry.z, eh).slice(0, -1));
      const steps = Math.ceil(Math.PI * rho);
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI;
        pts.push({ x: c.x + (rx * Math.cos(a) + fx * Math.sin(a)) * rho, z: c.z + (rz * Math.cos(a) + fz * Math.sin(a)) * rho });
      }
      const rev = reverseOf(l);
      const start = pathPoint(rev.path, 0);
      const exit = { x: c.x - rx * rho, z: c.z - rz * rho };
      pts.push(...bezierPath(exit.x, exit.z, eh + Math.PI, start.x, start.z, start.h).slice(1));
      moves.push({ from: l, at: l.path.len, path: pathFrom(pts), to: rev, toS: 0, yields: false, junction: null });
    }
  }

  // group each lane's ways off by where they leave
  for (const l of lanes) {
    const mine = moves.filter((m) => m.from === l).sort((a, b) => a.at - b.at);
    for (const m of mine) {
      const g = l.groups.find((q) => Math.abs(q.at - m.at) < 0.01);
      if (g) g.moves.push(m);
      else l.groups.push({ at: m.at, moves: [m], end: m.at >= l.path.len - 0.01 });
    }
  }

  /** the next way off the lane: at each junction ahead a one-in-three chance of turning; the lane's end must be taken */
  function plan(c: AiCar): void {
    c.next = null;
    for (const g of c.lane.groups) {
      if (g.at < c.s - 0.01) continue;
      if (g.end || Math.random() < 0.34) {
        c.next = g.moves[Math.floor(Math.random() * g.moves.length)];
        return;
      }
    }
  }

  // ---------- the cars ----------
  const n = Math.min(count, TRAFFIC_MODELS.length);
  const models = await Promise.all(TRAFFIC_MODELS.slice(0, n).map(load));
  const shadowTex = new THREE.CanvasTexture(contactShadow());
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const headTex = new THREE.CanvasTexture(softBlob(64, 'rgba(255,246,214,1)', 'rgba(255,246,214,0)'));
  const tailTex = new THREE.CanvasTexture(softBlob(32, 'rgba(255,60,40,1)', 'rgba(255,60,40,0)'));
  const beamTex = new THREE.CanvasTexture(softBlob(64, 'rgba(255,240,200,0.9)', 'rgba(255,240,200,0)'));
  const headMat = new THREE.SpriteMaterial({ map: headTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const tailMat = new THREE.SpriteMaterial({ map: tailTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  // a pool of light thrown on the road ahead, so a car's headlights read without a real light
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  const cars: AiCar[] = models.map((gltf, id) => {
    const model = gltf.scene.clone(true);
    model.traverse((o) => {
      const m = o as T.Mesh;
      if (m.isMesh) {
        m.castShadow = shadows;
        m.receiveShadow = false;
      }
    });
    // each wheel turns about its own axle on a clean pivot (the nodes carry baked rotations)
    const wheels: T.Object3D[] = [];
    for (const child of [...model.children]) {
      if (!/^wheel/i.test(child.name)) continue;
      const roll = new THREE.Group();
      roll.position.copy(child.position);
      child.position.set(0, 0, 0);
      roll.add(child);
      model.add(roll);
      wheels.push(roll);
    }
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const length = /truck|van/.test(TRAFFIC_MODELS[id]) ? 3.4 : 3.0;
    const scale = length / (size.z || 1);
    model.scale.setScalar(scale);
    model.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
    let wheelRadius = 0.3;
    if (wheels.length) {
      const wb = new THREE.Box3().setFromObject(wheels[0]);
      wheelRadius = (wb.getSize(new THREE.Vector3()).y / 2) * scale || 0.3;
    }
    const halfW = (size.x / 2) * scale;
    const half = length / 2;

    const root = new THREE.Group();
    root.add(model);
    const blob = new THREE.Mesh(plane, shadowMat);
    blob.scale.set(halfW * 2 + 0.7, 1, length + 0.8);
    blob.position.y = 0.06;
    blob.renderOrder = 1;
    root.add(blob);
    const heads: T.Sprite[] = [];
    const tails: T.Sprite[] = [];
    const lampY = Math.min(0.6, size.y * scale * 0.38);
    for (const sx of [-1, 1]) {
      const h = new THREE.Sprite(headMat);
      h.scale.setScalar(0.55);
      h.position.set(sx * halfW * 0.62, lampY, half + 0.05);
      const t = new THREE.Sprite(tailMat);
      t.scale.setScalar(0.32);
      t.position.set(sx * halfW * 0.62, lampY, -half - 0.03);
      root.add(h, t);
      heads.push(h);
      tails.push(t);
    }
    const pool = new THREE.Mesh(plane, beamMat);
    pool.scale.set(3.4, 1, 6);
    pool.position.set(0, 0.07, half + 3.6);
    pool.renderOrder = 2;
    root.add(pool);
    root.visible = false;
    scene.add(root);

    return {
      id, root, wheels, wheelRadius, blob, lights: { heads, tails, pool }, half, halfW,
      active: false, x: 0, z: 0,
      lane: lanes[0], s: 0, move: null, cs: 0, next: null,
      speed: 0, v0: CRUISE * (0.85 + Math.random() * 0.25), heading: 0, waited: 0, why: '',
      sweepX: new Float32Array(SWEEP + 1), sweepZ: new Float32Array(SWEEP + 1),
    };
  });

  // ---------- placing ----------
  const totalLength = lanes.reduce((sum, l) => sum + l.path.len, 0);
  function place(c: AiCar, rules: SpawnRules): boolean {
    let behind: { lane: Lane; s: number; x: number; z: number; h: number } | null = null;
    const take = (spot: NonNullable<typeof behind>) => {
      c.lane = spot.lane;
      c.s = spot.s;
      c.move = null;
      c.cs = 0;
      c.speed = c.v0 * 0.7;
      c.waited = 0;
      c.x = spot.x;
      c.z = spot.z;
      c.heading = spot.h;
      plan(c);
      c.root.visible = true;
      return true;
    };
    for (let attempt = 0; attempt < 10; attempt++) {
      let pick = Math.random() * totalLength;
      let lane = lanes[0];
      for (const l of lanes) {
        lane = l;
        if ((pick -= l.path.len) <= 0) break;
      }
      if (lane.path.len < 16) continue;
      const s = 6 + Math.random() * (lane.path.len - 12);
      const p = pathPoint(lane.path, s);
      const x = p.x, z = p.z, h = p.h;
      const d = Math.hypot(x - rules.focusX, z - rules.focusZ);
      if (d < rules.minDist || d > rules.maxDist) continue;
      if (!rules.mayBeSeen && d < rules.farView && rules.inView(x, z, 3)) continue;
      // not in a junction, and well clear of every other car
      if (junctions.some((j) => Math.hypot(j.x - x, j.z - z) < TILE)) continue;
      if (cars.some((o) => o !== c && o.active && Math.hypot(o.x - x, o.z - z) < 16)) continue;
      const spot = { lane, s, x, z, h };
      if ((x - rules.focusX) * rules.headX + (z - rules.focusZ) * rules.headZ > 0) return take(spot);
      behind ??= spot;
    }
    return behind ? take(behind) : false;
  }
  const pool: ActorPool<AiCar> = createPool({
    actors: cars,
    retireRadius: RETIRE,
    spawnMin: SPAWN_MIN,
    spawnMax: SPAWN_MAX,
    budget: 1,
    jumpDistance: 40,
    farView: 105,
    place,
  });

  // ---------- driving ----------
  /** where each car sits on each lane this frame, connectors projected onto the lane they join */
  const occupancy = new Map<Lane, Array<{ s: number; c: AiCar }>>();
  function occupy(l: Lane, s: number, c: AiCar) {
    let list = occupancy.get(l);
    if (!list) occupancy.set(l, (list = []));
    list.push({ s, c });
  }
  function buildOccupancy(): void {
    for (const list of occupancy.values()) list.length = 0;
    for (const c of cars) {
      if (!c.active) continue;
      if (c.move) {
        occupy(c.move.to, c.move.toS - (c.move.path.len - c.cs), c);
        // still in the mouth of the lane it left, for whoever follows it in
        if (c.cs < 6) occupy(c.move.from, c.move.at + c.cs, c);
      } else {
        occupy(c.lane, c.s, c);
      }
    }
  }
  /** the nearest car ahead on lane l past position s, within reach; gap is centre to centre */
  function leader(l: Lane, s: number, me: AiCar, reach: number): { d: number; c: AiCar } | null {
    let best: { d: number; c: AiCar } | null = null;
    for (const o of occupancy.get(l) ?? []) {
      if (o.c === me) continue;
      const d = o.s - s;
      if (d <= 0 || d > reach) continue;
      if (!best || d < best.d) best = { d, c: o.c };
    }
    return best;
  }

  /** the road a car will cover in the next SWEEP metres, a point a metre, along its lane, turn and next lane */
  function sweep(c: AiCar): void {
    for (let k = 0; k <= SWEEP; k++) {
      let p: typeof at;
      if (c.move) {
        const s = c.cs + k;
        p = s <= c.move.path.len ? pathPoint(c.move.path, s) : pathPoint(c.move.to.path, c.move.toS + s - c.move.path.len);
      } else {
        const s = c.s + k;
        const m = c.next;
        if (!m || s <= m.at) p = pathPoint(c.lane.path, s);
        else if (s - m.at <= m.path.len) p = pathPoint(m.path, s - m.at);
        else p = pathPoint(m.to.path, m.toS + s - m.at - m.path.len);
      }
      c.sweepX[k] = p.x;
      c.sweepZ[k] = p.z;
    }
  }
  /** how many metres along c's sweep something of half-width w at (x, z) stands; 0 if it is clear of it */
  function inSweep(c: AiCar, x: number, z: number, w: number): number {
    const r = c.halfW + w + 0.15;
    for (let k = 1; k <= SWEEP; k++) {
      const dx = x - c.sweepX[k];
      const dz = z - c.sweepZ[k];
      if (dx * dx + dz * dz < r * r) return k;
    }
    return 0;
  }

  /** is anything coming that a driver pulling out at junction j should wait for? */
  function conflict(c: AiCar, j: { x: number; z: number }, player: TrafficPlayer): boolean {
    const near = (x: number, z: number) => Math.hypot(x - j.x, z - j.z);
    const pd = near(player.x, player.z);
    if (pd < 7) return true;
    if (pd < 16 && Math.abs(player.speed) > 0.5) {
      const towards = Math.sin(player.heading) * (j.x - player.x) + Math.cos(player.heading) * (j.z - player.z);
      if (towards * Math.sign(player.speed) > 0) return true;
    }
    for (const o of cars) {
      if (o === c || !o.active) continue;
      const d = near(o.x, o.z);
      if (d > 16) continue;
      if (o.move && o.move.junction === j) return true; // someone is already crossing
      if (c.waited > PATIENCE) continue;
      // queued behind me on my own lane doesn't count
      if (!o.move && o.lane === c.lane && o.s < c.s) continue;
      const towards = Math.sin(o.heading) * (j.x - o.x) + Math.cos(o.heading) * (j.z - o.z);
      if (o.speed > 0.4 && towards > 0 && d > 4) return true;
    }
    return false;
  }

  function drive(c: AiCar, dt: number, player: TrafficPlayer, slow: boolean): void {
    const v0 = slow ? Math.min(c.v0, 1.6) : c.v0;
    let worst = 0;
    let cap = Infinity;
    c.why = '';
    const note = (acc: number, why: string) => {
      if (acc < worst) {
        worst = acc;
        c.why = why;
      }
    };

    if (!c.move) {
      // the car ahead on this lane, and past the next turn on the lane it leads to
      const lead = leader(c.lane, c.s, c, LOOKAHEAD);
      if (lead) note(brake(DRIVER, c.speed, lead.d - c.half - lead.c.half, lead.c.speed), 'car');
      cap = bendCap(c.lane.path, c.s, 30);
      // the next signal ahead on this lane: stop for red, and for amber if there's room to
      for (const stop of c.lane.stops) {
        const d = stop.s - c.s - c.half;
        if (d < -0.5) continue;
        if (d > LOOKAHEAD) break;
        const phase = signalPhase(clock(), stop.main, stop.signal.offset);
        const hold = stopAt(DRIVER, c.speed, Math.max(0.1, d), 0.6);
        if (phase === 'red' || (phase === 'amber' && freeAcc(DRIVER, c.speed, v0) + hold > -DRIVER.b)) note(hold, 'red light');
        break;
      }
      const m = c.next;
      if (m) {
        const toTurn = m.at - c.s;
        if (toTurn < LOOKAHEAD) {
          for (const o of occupancy.get(m.to) ?? []) {
            // anyone on the lane it turns into, from where the turn would put this car onwards
            if (o.c === c || o.s < m.toS - m.path.len) continue;
            const d = toTurn + m.path.len + (o.s - m.toS);
            if (d > 0 && d < LOOKAHEAD) note(brake(DRIVER, c.speed, d - c.half - o.c.half, o.c.speed), 'car');
          }
          cap = Math.min(cap, bendCap(m.path, 0, 30, toTurn));
          if (m.yields && m.junction) {
            if (conflict(c, m.junction, player)) {
              note(stopAt(DRIVER, c.speed, toTurn - c.half, 0.8), 'giving way');
              if (c.speed < 0.3 && toTurn - c.half < 3) c.waited += dt;
            }
          }
        }
      }
    } else {
      const m = c.move;
      for (const o of occupancy.get(m.to) ?? []) {
        if (o.c === c) continue;
        const d = (o.s - m.toS) + (m.path.len - c.cs);
        if (d > 0 && d < LOOKAHEAD) note(brake(DRIVER, c.speed, d - c.half - o.c.half, o.c.speed), 'car');
      }
      cap = bendCap(m.path, c.cs, 30);
    }

    // whatever is physically in the way, swept along the road this car is about to take:
    // the visitor, and anyone crossing or pulling out in front
    {
      const k = inSweep(c, player.x, player.z, PLAYER_HALF_W);
      if (k > 0) {
        const dh = player.heading - c.heading;
        const along = Math.max(0, player.speed * Math.cos(dh));
        const gap = k - c.half - (Math.abs(Math.cos(dh)) * PLAYER_HALF_L + Math.abs(Math.sin(dh)) * PLAYER_HALF_W);
        note(brake(DRIVER, c.speed, gap, along), 'you');
        if (gap < 0.6) c.speed = Math.min(c.speed, along);
      }
    }
    for (const o of cars) {
      if (o === c || !o.active || Math.abs(o.x - c.x) > SWEEP + 4 || Math.abs(o.z - c.z) > SWEEP + 4) continue;
      const k = inSweep(c, o.x, o.z, o.halfW);
      if (k <= 0) continue;
      // two cars each in the other's way (merging, crossing): the one on its own lane goes first
      if (inSweep(o, c.x, c.z, c.halfW) > 0) {
        const mine = c.move ? 1 : 0;
        const theirs = o.move ? 1 : 0;
        if (mine < theirs || (mine === theirs && c.id < o.id)) continue;
      }
      const dh = o.heading - c.heading;
      const along = Math.max(0, o.speed * Math.cos(dh));
      const ext = Math.abs(Math.cos(dh)) * o.half + Math.abs(Math.sin(dh)) * o.halfW;
      note(brake(DRIVER, c.speed, k - c.half - ext, along), 'car');
    }

    if (c.why !== 'giving way') c.waited = 0;
    const acc = Math.min(freeAcc(DRIVER, c.speed, v0) + worst, (cap - c.speed) * 2);
    c.speed = Math.max(0, c.speed + Math.max(-9, Math.min(DRIVER.a, acc)) * dt);
    const step = c.speed * dt;

    // ---------- move along the lane, onto a connector, onto the next lane ----------
    if (!c.move) {
      c.s += step;
      if (c.next && c.s >= c.next.at) {
        c.move = c.next;
        c.cs = c.s - c.next.at;
        c.next = null;
      } else if (c.s > c.lane.path.len) {
        c.s = c.lane.path.len; // nowhere to go: stand at the end
        c.speed = 0;
      }
    } else {
      c.cs += step;
    }
    if (c.move && c.cs >= c.move.path.len) {
      const m = c.move;
      c.lane = m.to;
      c.s = m.toS + (c.cs - m.path.len);
      c.move = null;
      plan(c);
    }
    const p = c.move ? pathPoint(c.move.path, c.cs) : pathPoint(c.lane.path, c.s);
    c.x = p.x;
    c.z = p.z;
    // turn smoothly through the joins between paths
    let dh = p.h - c.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    c.heading += dh * Math.min(1, dt * 12);
    c.root.position.set(c.x, 0, c.z);
    c.root.rotation.y = c.heading;
    for (const w of c.wheels) w.rotation.x += step / c.wheelRadius;
  }

  let night = -1;
  return {
    update(dt, player, inView, slow): void {
      lightSignals();
      pool.update(player.x, player.z, player.heading, inView);
      buildOccupancy();
      for (const c of cars) if (c.active) sweep(c);
      for (const c of cars) if (c.active) drive(c, dt, player, slow);
    },

    applyNight(nightFactor: number): void {
      if (Math.abs(nightFactor - night) < 0.002) return;
      night = nightFactor;
      const on = nightFactor > 0.25 ? nightFactor : 0;
      headMat.opacity = on * 0.9;
      tailMat.opacity = on * 0.8;
      beamMat.opacity = on * 0.32;
      // by day the lamps are off and cost no draw calls
      for (const c of cars) {
        for (const sp of [...c.lights.heads, ...c.lights.tails, c.lights.pool]) sp.visible = on > 0;
      }
    },

    resolve(pos, radius): Impact {
      const impact: Impact = { x: 0, z: 0, depth: 0 };
      for (const c of cars) {
        if (!c.active) continue;
        const wx = pos.x - c.x;
        const wz = pos.z - c.z;
        if (Math.abs(wx) > 6 || Math.abs(wz) > 6) continue;
        // world → the car's own frame (x right, z forward)
        const cos = Math.cos(c.heading);
        const sin = Math.sin(c.heading);
        const lx = wx * cos - wz * sin;
        const lz = wx * sin + wz * cos;
        const cx = Math.max(-c.halfW, Math.min(c.halfW, lx));
        const cz = Math.max(-c.half, Math.min(c.half, lz));
        let dx = lx - cx;
        let dz = lz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const k = (radius - d) / d;
          dx *= k;
          dz *= k;
          impact.depth = Math.max(impact.depth, radius - d);
        } else {
          // centre inside: out through the nearer side
          dx = lx >= 0 ? c.halfW - lx + radius : -(lx + c.halfW + radius);
          dz = 0;
          impact.depth = Math.max(impact.depth, radius);
        }
        const px = dx * cos + dz * sin;
        const pz = -dx * sin + dz * cos;
        pos.x += px;
        pos.z += pz;
        impact.x += px;
        impact.z += pz;
      }
      return impact;
    },

    reseed: () => pool.reseed(),

    cars: () => cars,

    debug: () => ({
      lanes: lanes.length,
      moves: moves.length,
      signals: signals.map((g) => ({
        x: +g.x.toFixed(1), z: +g.z.toFixed(1),
        main: signalPhase(clock(), true, g.offset), side: signalPhase(clock(), false, g.offset),
        stops: lanes.reduce((n, l) => n + l.stops.filter((q) => q.signal === g).length, 0),
      })),
      cars: cars.filter((c) => c.active).map((c) => ({
        x: +c.x.toFixed(1), z: +c.z.toFixed(1), speed: +c.speed.toFixed(2),
        lane: c.move ? `${c.move.from.id}→${c.move.to.id}` : c.lane.id, why: c.why,
      })),
      pool: pool.takeStats(),
    }),
  };
}
