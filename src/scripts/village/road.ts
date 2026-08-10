// The winding country road: one Catmull-Rom spine, one textured ribbon.
// Sidewalks, curbs and centre dashes are painted into the texture, so nothing
// can fold across the asphalt at a bend.
import type * as T from 'three';
import type { Three } from './types';

export const Z_START = 14;
export const Z_END = -292;

const WIDTH = 11.2;
const SIDEWALK_FRACTION = 0.15;

export interface Road {
  curve: T.CatmullRomCurve3;
  length: number;
  perp(t: number): T.Vector3;
  /** distance from a point to the road spine (sampled) */
  distTo(x: number, z: number): number;
  /** half-width of the asphalt itself, sidewalks excluded */
  halfAsphalt: number;
  mesh: T.Mesh;
  mat: T.MeshLambertMaterial;
}

function makeRoadTexture(THREE: Three, maxAniso: number): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const W = 256;
  // cross-section: |sidewalk|curb|asphalt+dash|curb|sidewalk|
  const sw = Math.round(W * SIDEWALK_FRACTION);
  ctx.fillStyle = '#efe8da';
  ctx.fillRect(0, 0, W, 128);
  ctx.fillStyle = '#cdd4e2';
  ctx.fillRect(sw, 0, W - sw * 2, 128);
  ctx.fillStyle = '#aeb7c9';
  ctx.fillRect(sw - 3, 0, 3, 128);
  ctx.fillRect(W - sw, 0, 3, 128);
  // centre dash: painted along v, 40% duty
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(W / 2 - 3, 10, 6, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createRoad(THREE: Three, scene: T.Scene, maxAniso: number): Road {
  const curve = new THREE.CatmullRomCurve3(
    [
      [0, 12], [3, -12], [-9, -42], [5, -74], [-12, -108],
      [-2, -140], [11, -172], [-5, -206], [0, -244],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z))
  );
  const length = curve.getLength();
  const perp = (t: number): T.Vector3 => {
    const tan = curve.getTangentAt(t);
    return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
  };

  const SEG = 300;
  const pos: number[] = [];
  const uv: number[] = [];
  const norm: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const c = curve.getPointAt(t);
    const n = perp(t);
    pos.push(c.x + n.x * (WIDTH / 2), 0.02, c.z + n.z * (WIDTH / 2));
    pos.push(c.x - n.x * (WIDTH / 2), 0.02, c.z - n.z * (WIDTH / 2));
    const v = (t * length) / 6; // dash cadence
    uv.push(0, v, 1, v);
    norm.push(0, 1, 0, 0, 1, 0);
    if (i < SEG) {
      const a = i * 2;
      // wound to face UP — face-down winding made DoubleSide flip the
      // normals, so the road was lit as if facing into the ground
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
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

  const samples: Array<[number, number]> = [];
  for (let i = 0; i <= 120; i++) {
    const c = curve.getPointAt(i / 120);
    samples.push([c.x, c.z]);
  }
  const distTo = (x: number, z: number): number => {
    let best = Infinity;
    for (const [rx, rz] of samples) {
      const d = (x - rx) * (x - rx) + (z - rz) * (z - rz);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  return {
    curve,
    length,
    perp,
    distTo,
    halfAsphalt: (WIDTH / 2) * (1 - SIDEWALK_FRACTION * 2),
    mesh,
    mat,
  };
}
