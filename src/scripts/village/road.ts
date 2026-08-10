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
/**
 * How far into a branch the kerbs and pavement fade in, in metres. The
 * cross-section is painted into the texture, so at a junction the branch's own
 * pavement stripe ran straight across the main road's asphalt — a footpath
 * down the middle of the road. Near the mouth we sample a slice of plain
 * asphalt across the full width instead, so the branch reads as tarmac merging
 * into tarmac, and the pavement starts once it is clear of the junction.
 */
const APRON_LENGTH = 13;
/** a u inside the asphalt band: no kerb, no centre dash */
const APRON_U = 0.32;
/**
 * The same problem in the other direction: the SPINE's pavement is a
 * continuous stripe down each edge, so it ran straight across the mouth of
 * every side street. Near a junction the spine drops its kerb on the side the
 * branch leaves, which is what opens the turning.
 */
const MOUTH_LENGTH = 9;
/** how far back along each road a kerb return starts */
const RETURN_BACK = 7;
/** width of the pavement carried around a corner */
const KERB_W = 1.5;
const JUNCTION_Y = 0.0206;
const KERB_Y = 0.0209;

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
  /**
   * True when the point sits on the visible ribbon of ANY street — pavement
   * included, not just the asphalt. Placement guards use this: a lamp or a
   * signboard put "beside this lane" can easily land in the middle of the next
   * one where two streets meet.
   */
  onRibbon(x: number, z: number, clearance?: number): boolean;
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
  // where each branch leaves the spine, and on which side
  const junctions = branchSpecs.map((sp) => ({ t: sp.t, side: sp.side }));

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
      // The cross-section is painted into the texture, so wherever two streets
      // meet, one's kerb and pavement would run across the other's tarmac.
      // Both sides fade to plain asphalt around a junction instead.
      // u0 is the +perpendicular edge, u1 the −perpendicular one.
      let u0 = 0;
      let u1 = 1;
      if (seg.id === 'main') {
        for (const j of junctions) {
          const dist = Math.abs(t - j.t) * seg.length;
          if (dist >= MOUTH_LENGTH) continue;
          const k = dist / MOUTH_LENGTH;
          if (j.side === 1) u0 = APRON_U + (u0 - APRON_U) * k;
          else u1 = APRON_U + (u1 - APRON_U) * k;
        }
      } else {
        const apron = Math.min(1, (t * seg.length) / APRON_LENGTH);
        u0 = APRON_U + (u0 - APRON_U) * apron;
        u1 = APRON_U + (u1 - APRON_U) * apron;
      }
      uv.push(u0, v, u1, v);
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

  // ---------- junction corners ----------
  // A swept ribbon can't express a junction: it only knows how to be a strip,
  // which is why fading its painted kerb left the corner a ragged V with the
  // pavement stopping in mid-air. A junction is a shape — the two kerb lines
  // curving into one another — so each corner gets built: a tarmac fillet
  // where the roadways meet, and the pavement carried round the outside of it.
  {
    const line = (px: number, pz: number, dx: number, dz: number, qx: number, qz: number, ex: number, ez: number) => {
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-4) return null;
      const t = ((qx - px) * ez - (qz - pz) * ex) / den;
      return { x: px + dx * t, z: pz + dz * t };
    };

    const fillPos: number[] = [];
    const kerbPos: number[] = [];

    branchSpecs.forEach((spec, bi) => {
      const branch = branches[bi];
      const j = main.curve.getPointAt(spec.t);
      const sTan = main.curve.getTangentAt(spec.t);
      const sPerp = main.perp(spec.t);
      const bTan = branch.curve.getTangentAt(0);
      const bPerp = branch.perp(0);
      const rS = main.width / 2;
      const rB = branch.width / 2;

      for (const c of [1, -1]) {
        // the spine's edge on the branch's side, a little either way of the mouth
        const eSx = j.x + sTan.x * RETURN_BACK * c + sPerp.x * spec.side * rS;
        const eSz = j.z + sTan.z * RETURN_BACK * c + sPerp.z * spec.side * rS;
        // ...and the branch edge that leans the same way
        const lean = bPerp.x * sTan.x + bPerp.z * sTan.z;
        const eSign = lean * c >= 0 ? 1 : -1;
        const bp = branch.curve.getPointAt(Math.min(1, RETURN_BACK / branch.length));
        const eBx = bp.x + bPerp.x * eSign * rB;
        const eBz = bp.z + bPerp.z * eSign * rB;

        // the sharp corner the two edges would make; the kerb rounds it off
        const corner =
          line(eSx, eSz, sTan.x, sTan.z, eBx, eBz, bTan.x, bTan.z) ??
          { x: (eSx + eBx) / 2, z: (eSz + eBz) / 2 };

        const STEPS = 10;
        const arc: Array<{ x: number; z: number }> = [];
        for (let i = 0; i <= STEPS; i++) {
          const u = i / STEPS;
          const iu = 1 - u;
          arc.push({
            x: iu * iu * eSx + 2 * iu * u * corner.x + u * u * eBx,
            z: iu * iu * eSz + 2 * iu * u * corner.z + u * u * eBz,
          });
        }

        // tarmac fillet: a fan from the junction out to the kerb line
        for (let i = 0; i < STEPS; i++) {
          const a = arc[i];
          const b = arc[i + 1];
          fillPos.push(j.x, JUNCTION_Y, j.z, a.x, JUNCTION_Y, a.z, b.x, JUNCTION_Y, b.z);
        }

        // pavement carried around the outside of that kerb
        for (let i = 0; i < STEPS; i++) {
          const a = arc[i];
          const b = arc[i + 1];
          const na = Math.hypot(a.x - j.x, a.z - j.z) || 1;
          const nb = Math.hypot(b.x - j.x, b.z - j.z) || 1;
          const ao = { x: a.x + ((a.x - j.x) / na) * KERB_W, z: a.z + ((a.z - j.z) / na) * KERB_W };
          const bo = { x: b.x + ((b.x - j.x) / nb) * KERB_W, z: b.z + ((b.z - j.z) / nb) * KERB_W };
          kerbPos.push(a.x, KERB_Y, a.z, ao.x, KERB_Y, ao.z, b.x, KERB_Y, b.z);
          kerbPos.push(b.x, KERB_Y, b.z, ao.x, KERB_Y, ao.z, bo.x, KERB_Y, bo.z);
        }
      }
    });

    const patch = (verts: number[], colour: number, y: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      scene.add(m);
    };
    if (fillPos.length) patch(fillPos, 0xcdd4e2, JUNCTION_Y);
    if (kerbPos.length) patch(kerbPos, 0xefe8da, KERB_Y);
  }

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
  const samples: Array<{ x: number; z: number; half: number; ribbon: number }> = [];
  for (const seg of all) {
    const n = Math.max(60, Math.round(seg.length / 1.5));
    for (let i = 0; i <= n; i++) {
      const c = seg.curve.getPointAt(i / n);
      samples.push({ x: c.x, z: c.z, half: seg.halfAsphalt, ribbon: seg.width / 2 });
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

    onRibbon(x: number, z: number, clearance = 0): boolean {
      for (const s of samples) {
        const reach = s.ribbon + clearance;
        const dx = x - s.x;
        const dz = z - s.z;
        if (dx * dx + dz * dz <= reach * reach) return true;
      }
      for (const c of circles) {
        const reach = c.r + clearance;
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz <= reach * reach) return true;
      }
      return false;
    },
  };
}
