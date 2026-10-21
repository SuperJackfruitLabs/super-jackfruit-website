// The street plan.
//
// Streets are laid on a grid of KayKit City Builder road tiles (CC0, Kay
// Lousberg): straights, curved corners, T-splits and crossroads. A junction or
// a 90° corner is a single tile made to be one, so the kerbs and markings meet
// by construction. The old hand-swept ribbons with patched-in corners never
// quite did on a curving spine, and a wedge of grass showed through.
//
// Each street is still also a path (straight runs, rounded through corners),
// so everything placed "along the road" — houses, signs, lamps, flowers, the
// people walking — works from the same RoadSegment it always has.
import type * as T from 'three';
import type { Three } from './types';

export const Z_START = 36; // room for the turning circle behind the start
export const Z_END = -292;

/** metres per grid cell; one road tile */
export const TILE = 10;
/** the tiles are 2 units square in the kit */
const KIT_TILE = 2;
const TILE_Y = 0.02;
/** height of the tarmac inside a kit tile, in kit units */
const ASPHALT_KIT_Y = 0.07;
/** where the tile's kerb tops out once sunk, so a footpath meets it flush */
export const KERB_TOP = TILE_Y + (0.1 - ASPHALT_KIT_Y) * (TILE / KIT_TILE);
/** footpath width, metres */
export const FOOTPATH = 1.8;

type Cell = [number, number];

export interface StreetSpec {
  id: string;
  /** grid cells in driving order; a branch starts beside the junction cell on the spine */
  cells: Cell[];
  /** radius of the turning circle at the far end, 0 for none */
  culDeSac: number;
  /** radius of one before the first cell, 0 or absent for none */
  startCulDeSac?: number;
  /** a branch whose far end runs back into the spine instead of stopping */
  rejoins?: boolean;
}

export interface RoadSegment {
  id: string;
  curve: T.Curve<T.Vector3>;
  length: number;
  width: number;
  /** half-width of the asphalt itself, sidewalks excluded */
  halfAsphalt: number;
  perp(t: number): T.Vector3;
  /** far end, for cul-de-sacs and square placement */
  end: { x: number; z: number; r: number };
}

export interface Junction {
  id: string;
  /** where along the spine the branch leaves, 0..1 */
  t: number;
  /** which side of the spine: +1 along perp(t), −1 against it */
  side: 1 | -1;
}

export interface RoadNetwork {
  main: RoadSegment;
  branches: RoadSegment[];
  /** main first, then branches */
  all: RoadSegment[];
  junctions: Junction[];
  get(id: string): RoadSegment;
  /** distance to the nearest road centreline, across the whole network */
  distTo(x: number, z: number): number;
  /** true when the point is on a road tile (or a turning circle) */
  isPaved(x: number, z: number, margin?: number): boolean;
  /**
   * True when the point sits on any road tile, pavement included. Placement
   * guards use this so nothing lands in a street, including the next one over.
   */
  onRibbon(x: number, z: number, clearance?: number): boolean;
}

/** the four tile shapes, by which sides they open onto, before rotation */
const SHAPES: Array<{ model: string; dirs: Cell[] }> = [
  { model: 'kk-road-straight', dirs: [[0, -1], [0, 1]] },
  { model: 'kk-road-corner-curved', dirs: [[1, 0], [0, 1]] },
  { model: 'kk-road-tsplit', dirs: [[0, -1], [0, 1], [1, 0]] },
  { model: 'kk-road-junction', dirs: [[0, -1], [0, 1], [1, 0], [-1, 0]] },
];

/** rotating a model by k quarter-turns about +y moves +x toward −z */
const turn = ([x, z]: Cell, k: number): Cell => {
  let v: Cell = [x, z];
  for (let i = 0; i < k; i++) v = [v[1], -v[0]];
  return v;
};
const key = (x: number, z: number) => `${x},${z}`;

export async function createRoads(
  THREE: Three,
  scene: T.Scene,
  loadAsset: (name: string) => Promise<T.Group>,
  main: StreetSpec,
  branchSpecs: StreetSpec[],
  /** how a road tile is lit and shadowed; matches the rest of the scene */
  prepare: (o: T.Object3D) => void = () => {}
): Promise<RoadNetwork> {
  const centre = ([cx, cz]: Cell) => new THREE.Vector3(cx * TILE, 0, cz * TILE);

  // A street's path: straight across each cell, a bezier through a corner
  // cell, entering and leaving at the cell edges.
  function path(cells: Cell[], from?: Cell, to?: Cell): T.CurvePath<T.Vector3> {
    const p = new THREE.CurvePath<T.Vector3>();
    const seq = [...(from ? [from] : []), ...cells, ...(to ? [to] : [])];
    const start = from ? 1 : 0;
    for (let i = start; i < seq.length - (to ? 1 : 0); i++) {
      const c = centre(seq[i]);
      const prev = seq[i - 1];
      const next = seq[i + 1];
      const dirIn = prev ? centre(seq[i]).sub(centre(prev)).normalize() : centre(next).sub(c).normalize();
      const dirOut = next ? centre(next).sub(c).normalize() : dirIn.clone();
      const a = c.clone().addScaledVector(dirIn, -TILE / 2);
      const b = c.clone().addScaledVector(dirOut, TILE / 2);
      if (dirIn.dot(dirOut) > 0.99) p.add(new THREE.LineCurve3(a, b));
      else p.add(new THREE.QuadraticBezierCurve3(a, c, b));
    }
    return p;
  }

  function segment(id: string, curve: T.CurvePath<T.Vector3>, culDeSac: number): RoadSegment {
    const length = curve.getLength();
    const tip = curve.getPointAt(1);
    return {
      id,
      curve,
      length,
      width: TILE,
      halfAsphalt: TILE * 0.42,
      perp: (t: number) => {
        const tan = curve.getTangentAt(t);
        return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      },
      end: { x: tip.x, z: tip.z, r: culDeSac },
    };
  }

  // ---------- which sides each cell opens onto ----------
  const open = new Map<string, Set<string>>();
  const touch = (c: Cell) => {
    if (!open.has(key(...c))) open.set(key(...c), new Set());
  };
  const link = (a: Cell, b: Cell) => {
    touch(a);
    touch(b);
    open.get(key(...a))!.add(key(b[0] - a[0], b[1] - a[1]));
    open.get(key(...b))!.add(key(a[0] - b[0], a[1] - b[1]));
  };
  const chain = (cells: Cell[]) => {
    cells.forEach(touch);
    for (let i = 1; i < cells.length; i++) link(cells[i - 1], cells[i]);
  };

  chain(main.cells);
  const junctions: Junction[] = [];
  const mainSeg = segment('main', path(main.cells), main.culDeSac);
  const branches = branchSpecs.map((spec) => {
    const first = spec.cells[0];
    // the spine cell this street leaves from is its neighbour on the spine
    const near = (c: Cell) => (m: Cell) => Math.abs(m[0] - c[0]) + Math.abs(m[1] - c[1]) === 1;
    const from = main.cells.find(near(first))!;
    const last = spec.cells[spec.cells.length - 1];
    const to = spec.rejoins ? main.cells.find((m) => m !== from && near(last)(m)) : undefined;
    chain([from, ...spec.cells, ...(to ? [to] : [])]);
    const seg = segment(spec.id, path(spec.cells, from, to), spec.culDeSac);
    const idx = main.cells.indexOf(from);
    const t = Math.min(1, Math.max(0, ((idx + 0.5) * TILE) / mainSeg.length));
    const out = centre(first).sub(centre(from));
    junctions.push({ id: spec.id, t, side: mainSeg.perp(t).dot(out) >= 0 ? 1 : -1 });
    return seg;
  });
  // a street's ends are dead ends: the one open side carries straight on
  for (const cells of [main.cells, ...branchSpecs.map((b) => b.cells)]) {
    for (const end of [cells[0], cells[cells.length - 1]]) {
      const s = open.get(key(...end))!;
      if (s.size === 1) {
        const [dx, dz] = [...s][0].split(',').map(Number);
        s.add(key(-dx, -dz));
      }
    }
  }

  // ---------- lay the tiles ----------
  const protos = new Map<string, T.Group>();
  for (const sh of SHAPES) protos.set(sh.model, await loadAsset(sh.model));
  const scale = TILE / KIT_TILE;
  for (const [k, sides] of open) {
    const [cx, cz] = k.split(',').map(Number);
    const want = [...sides].sort().join('|');
    let placed = false;
    for (const sh of SHAPES) {
      if (placed || sh.dirs.length !== sides.size) continue;
      for (let q = 0; q < 4 && !placed; q++) {
        if (sh.dirs.map((d) => key(...turn(d, q))).sort().join('|') !== want) continue;
        const tile = protos.get(sh.model)!.clone();
        tile.scale.setScalar(scale);
        tile.rotation.y = (q * Math.PI) / 2;
        // in the kit the tarmac sits 0.07 units up the tile and the kerb 0.1;
        // sink the tile so the tarmac is just above the grass (the car drives
        // at y = 0) and the kerb stands a kerb's height proud of it
        tile.position.set(cx * TILE, TILE_Y - ASPHALT_KIT_Y * scale, cz * TILE);
        tile.traverse(prepare);
        scene.add(tile);
        placed = true;
      }
    }
  }

  // ---------- footpaths ----------
  // The kit's tiles carry only a kerb, so the pavement is ours: a strip along
  // every side of a tile that doesn't open onto more road, just outside the
  // tile, raised to the kerb's height. A strip runs on past its tile's corner
  // only where the next cell along isn't road (an outside corner), so at a
  // junction mouth the footpaths turn the corner instead of crossing the road.
  {
    const isRoad = (x: number, z: number) => open.has(key(x, z));
    const strips: Array<{ x: number; z: number; sx: number; sz: number }> = [];
    for (const [k, sides] of open) {
      const [cx, cz] = k.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (sides.has(key(dx, dz))) continue;
        // the edge runs along the other axis; extend at an end with no road beyond it
        const [ax, az] = [dz !== 0 ? 1 : 0, dx !== 0 ? 1 : 0];
        const lo = isRoad(cx - ax, cz - az) ? 0 : FOOTPATH;
        const hi = isRoad(cx + ax, cz + az) ? 0 : FOOTPATH;
        const len = TILE + lo + hi;
        const mid = (hi - lo) / 2;
        strips.push({
          x: cx * TILE + dx * (TILE / 2 + FOOTPATH / 2) + ax * mid,
          z: cz * TILE + dz * (TILE / 2 + FOOTPATH / 2) + az * mid,
          sx: ax ? len : FOOTPATH,
          sz: az ? len : FOOTPATH,
        });
      }
    }
    const h = KERB_TOP;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, h, 1),
      new THREE.MeshLambertMaterial({ color: 0xc9ccce }),
      strips.length
    );
    const m = new THREE.Matrix4();
    strips.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, h / 2, s.z), new THREE.Quaternion(), new THREE.Vector3(s.sx, 1, s.sz));
      mesh.setMatrixAt(i, m);
    });
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // turning circles at the far end of each branch, past the last tile
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x5b6066 });
  const kerb = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
  const circles: Array<{ x: number; z: number; r: number }> = [];
  // a turning circle just past a street's open end; `dir` points out of the street
  function turningCircle(tipX: number, tipZ: number, dir: T.Vector3, r: number) {
    const cx = tipX + dir.x * (r - 1);
    const cz = tipZ + dir.z * (r - 1);
    for (const [rr, mat, y] of [[r + 0.5, kerb, TILE_Y - 0.002], [r, asphalt, TILE_Y]] as const) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(rr, 48), mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(cx, y, cz);
      disc.receiveShadow = true;
      scene.add(disc);
    }
    // the footpath carried round the circle, open where the street comes in
    const back = Math.atan2(dir.z, -dir.x); // ring angles run in the disc's rotated plane
    const inner = r + 0.5;
    const gap = Math.asin(Math.min(1, (TILE / 2 + FOOTPATH) / inner));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, inner + FOOTPATH, 64, 1, back + gap, Math.PI * 2 - gap * 2),
      new THREE.MeshLambertMaterial({ color: 0xc9ccce })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, KERB_TOP, cz);
    ring.receiveShadow = true;
    scene.add(ring);
    circles.push({ x: cx, z: cz, r });
    return { x: cx, z: cz };
  }
  for (const seg of branches) {
    if (seg.end.r <= 0) continue;
    const c = turningCircle(seg.end.x, seg.end.z, seg.curve.getTangentAt(1), seg.end.r);
    seg.end = { x: c.x, z: c.z, r: seg.end.r };
  }
  if (main.startCulDeSac) {
    const p0 = mainSeg.curve.getPointAt(0);
    turningCircle(p0.x, p0.z, mainSeg.curve.getTangentAt(0).negate(), main.startCulDeSac);
  }

  // ---------- lookups ----------
  const cells = [...open.keys()].map((k) => k.split(',').map(Number) as Cell);
  const inCell = (x: number, z: number, pad: number) =>
    cells.some(([cx, cz]) => Math.abs(x - cx * TILE) <= TILE / 2 + pad && Math.abs(z - cz * TILE) <= TILE / 2 + pad);
  const inCircle = (x: number, z: number, pad: number) =>
    circles.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 <= (c.r + pad) ** 2);
  const all = [mainSeg, ...branches];
  const samples: Array<{ x: number; z: number }> = [];
  for (const seg of all) {
    const n = Math.max(60, Math.round(seg.length / 1.5));
    for (let i = 0; i <= n; i++) {
      const c = seg.curve.getPointAt(i / n);
      samples.push({ x: c.x, z: c.z });
    }
  }

  return {
    main: mainSeg,
    branches,
    all,
    junctions,
    get: (id: string) => all.find((s) => s.id === id) ?? mainSeg,
    distTo(x: number, z: number): number {
      let best = Infinity;
      for (const s of samples) best = Math.min(best, (x - s.x) ** 2 + (z - s.z) ** 2);
      return Math.sqrt(best);
    },
    isPaved: (x, z, margin = 0.6) => inCell(x, z, margin - 0.6) || inCircle(x, z, margin - 0.6),
    onRibbon: (x, z, clearance = 0) => inCell(x, z, clearance) || inCircle(x, z, clearance),
  };
}
