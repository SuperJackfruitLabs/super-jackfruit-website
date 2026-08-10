// The street plan.
//
// A winding main road from the edge of the map to the town square, with three
// district streets branching off it — one per district in the project data, so
// each becomes a neighbourhood you turn off for rather than a gate you drive
// past.
//
// Every street is one textured ribbon: sidewalks, kerbs and centre dashes are
// painted into the texture, so nothing can fold across the asphalt at a bend.
// All ribbons live in a single merged geometry, so the whole network is one
// draw call. Branches sit a few millimetres BELOW the main road, so the overlap
// at a junction reads as a T rather than z-fighting.
import type * as T from 'three';
import type { Three } from './types';

export const Z_START = 14;
export const Z_END = -292;

const MAIN_WIDTH = 11.2;
const SIDEWALK_FRACTION = 0.15;
const MAIN_Y = 0.02;
const BRANCH_Y = 0.015;

/** the spine: unchanged, because the drive along it already feels right */
const MAIN_POINTS: Array<[number, number]> = [
  [0, 12], [3, -12], [-9, -42], [5, -74], [-12, -108],
  [-2, -140], [11, -172], [-5, -206], [0, -244],
];

export interface BranchSpec {
  id: string;
  /** where along the main road it leaves, 0..1 */
  t: number;
  side: 1 | -1;
  width: number;
  /** [outward, along] offsets from the junction, in metres */
  shape: Array<[number, number]>;
  /** radius of the turning circle at the far end */
  culDeSac: number;
}

export interface RoadSegment {
  id: string;
  curve: T.CatmullRomCurve3;
  length: number;
  width: number;
  /** half-width of the asphalt itself, sidewalks excluded */
  halfAsphalt: number;
  perp(t: number): T.Vector3;
  /** far end, for cul-de-sacs and square placement */
  end: { x: number; z: number; r: number };
}

export interface RoadNetwork {
  main: RoadSegment;
  branches: RoadSegment[];
  /** main first, then branches */
  all: RoadSegment[];
  get(id: string): RoadSegment;
  /** distance to the nearest road centreline, across the whole network */
  distTo(x: number, z: number): number;
  /** true when the point is on asphalt (or a turning circle) anywhere */
  isPaved(x: number, z: number, margin?: number): boolean;
  mesh: T.Mesh;
}

function makeRoadTexture(THREE: Three, maxAniso: number): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const W = 256;
  // cross-section: |sidewalk|kerb|asphalt+dash|kerb|sidewalk|
  const sw = Math.round(W * SIDEWALK_FRACTION);
  ctx.fillStyle = '#efe8da';
  ctx.fillRect(0, 0, W, 128);
  ctx.fillStyle = '#cdd4e2';
  ctx.fillRect(sw, 0, W - sw * 2, 128);
  ctx.fillStyle = '#aeb7c9';
  ctx.fillRect(sw - 3, 0, 3, 128);
  ctx.fillRect(W - sw, 0, 3, 128);
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(W / 2 - 3, 10, 6, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createRoads(
  THREE: Three,
  scene: T.Scene,
  maxAniso: number,
  branchSpecs: BranchSpec[]
): RoadNetwork {
  function segment(
    id: string, pts: Array<[number, number]>, width: number, culDeSac: number
  ): RoadSegment {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const length = curve.getLength();
    const perp = (t: number): T.Vector3 => {
      const tan = curve.getTangentAt(t);
      return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    };
    const tip = curve.getPointAt(1);
    return {
      id,
      curve,
      length,
      width,
      halfAsphalt: (width / 2) * (1 - SIDEWALK_FRACTION * 2),
      perp,
      end: { x: tip.x, z: tip.z, r: culDeSac },
    };
  }

  const main = segment('main', MAIN_POINTS, MAIN_WIDTH, 0);

  // Branch geometry is derived from the main road, so a junction always meets
  // the spine exactly however the spine is retuned.
  const branches = branchSpecs.map((spec) => {
    const j = main.curve.getPointAt(spec.t);
    const tan = main.curve.getTangentAt(spec.t);
    const n = main.perp(spec.t).multiplyScalar(spec.side);
    const pts = spec.shape.map(([out, along]): [number, number] => [
      j.x + n.x * out + tan.x * along,
      j.z + n.z * out + tan.z * along,
    ]);
    return segment(spec.id, pts, spec.width, spec.culDeSac);
  });

  const all = [main, ...branches];

  // ---------- one merged ribbon for the whole network ----------
  const pos: number[] = [];
  const uv: number[] = [];
  const norm: number[] = [];
  const idx: number[] = [];
  for (const seg of all) {
    const y = seg.id === 'main' ? MAIN_Y : BRANCH_Y;
    const steps = Math.max(40, Math.round(seg.length / 1.2));
    const base = pos.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = seg.curve.getPointAt(t);
      const n = seg.perp(t);
      pos.push(c.x + n.x * (seg.width / 2), y, c.z + n.z * (seg.width / 2));
      pos.push(c.x - n.x * (seg.width / 2), y, c.z - n.z * (seg.width / 2));
      const v = (t * seg.length) / 6; // dash cadence
      uv.push(0, v, 1, v);
      norm.push(0, 1, 0, 0, 1, 0);
      if (i < steps) {
        const a = base + i * 2;
        // wound to face UP — face-down winding made DoubleSide flip the
        // normals, so the road was lit as if facing into the ground
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(norm), 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ map: makeRoadTexture(THREE, maxAniso), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // turning circles at the far end of each branch
  const asphalt = new THREE.MeshLambertMaterial({ color: 0xcdd4e2 });
  for (const seg of branches) {
    if (seg.end.r <= 0) continue;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(seg.end.r, 28), asphalt);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(seg.end.x, BRANCH_Y, seg.end.z);
    disc.receiveShadow = true;
    scene.add(disc);
  }

  // ---------- sampled distance field ----------
  const samples: Array<{ x: number; z: number; half: number }> = [];
  for (const seg of all) {
    const n = Math.max(40, Math.round(seg.length / 2));
    for (let i = 0; i <= n; i++) {
      const c = seg.curve.getPointAt(i / n);
      samples.push({ x: c.x, z: c.z, half: seg.halfAsphalt });
    }
  }
  const circles = branches
    .filter((s) => s.end.r > 0)
    .map((s) => ({ x: s.end.x, z: s.end.z, r: s.end.r }));

  return {
    main,
    branches,
    all,
    get: (id: string) => all.find((s) => s.id === id) ?? main,
    mesh,

    distTo(x: number, z: number): number {
      let best = Infinity;
      for (const s of samples) {
        const d = (x - s.x) * (x - s.x) + (z - s.z) * (z - s.z);
        if (d < best) best = d;
      }
      return Math.sqrt(best);
    },

    isPaved(x: number, z: number, margin = 0.6): boolean {
      for (const s of samples) {
        const reach = s.half + margin;
        const dx = x - s.x;
        const dz = z - s.z;
        if (dx * dx + dz * dz <= reach * reach) return true;
      }
      for (const c of circles) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz <= c.r * c.r) return true;
      }
      return false;
    },
  };
}
