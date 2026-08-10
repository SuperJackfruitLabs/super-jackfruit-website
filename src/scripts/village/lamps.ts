// Street lamps. The supplied kit is a showroom of variants standing side by
// side, so this picks one, re-pivots it to its pole base, works out where the
// lantern actually hangs, and clones that along the kerb.
import type * as T from 'three';
import type { GltfLoaderLike, Three } from './types';
import type { Road } from './road';

const LAMP_HEIGHT = 4.2;
const KERB_OFFSET = 6.9;
const SPACING = 22;

export interface Blocker {
  x: number;
  z: number;
  r: number;
}

export interface Lamps {
  /** lights the lanterns and walks the light pool to whichever are nearest */
  update(nightFactor: number, px: number, pz: number): void;
}

export async function createLamps(
  THREE: Three,
  scene: T.Scene,
  loader: GltfLoaderLike,
  road: Road,
  blockers: Blocker[],
  addCollider: (x: number, z: number, hx: number, hz: number, rotY: number) => void
): Promise<Lamps> {
  const kit = await loader.loadAsync('/assets/village/street-lamp.glb');

  // descend past wrappers, anchor on the tallest slim node, and gather the
  // parts standing at its spot
  let root: T.Object3D = kit.scene;
  while (root.children.length === 1) root = root.children[0];
  const infos = root.children.map((ch) => {
    const b = new THREE.Box3().setFromObject(ch);
    return { obj: ch, size: b.getSize(new THREE.Vector3()), center: b.getCenter(new THREE.Vector3()), minY: b.min.y };
  });
  const slim = infos.filter((i) => i.size.y > Math.max(i.size.x, i.size.z) * 1.5);
  const anchorInfo = (slim.length ? slim : infos).sort((a, b) => b.size.y - a.size.y)[0];
  const members = infos.filter(
    (i) => Math.hypot(i.center.x - anchorInfo.center.x, i.center.z - anchorInfo.center.z) < 1.6
  );

  const proto = new THREE.Group();
  const inner = new THREE.Group();
  for (const m of members) inner.add(m.obj.clone(true));
  const groupBox = new THREE.Box3().setFromObject(inner);
  proto.add(inner);
  proto.updateMatrixWorld(true);

  const lantern = { arm: 0.9, height: 3.8 };
  {
    // pivot at the POLE BASE (bbox centre is skewed by the crook arm) and
    // point the arm toward +z so facing math can aim it over the road
    const h = groupBox.max.y - groupBox.min.y;
    const bottomY = groupBox.min.y + h * 0.15;
    const topY = groupBox.min.y + h * 0.72;
    let bx = 0, bz = 0, bn = 0;
    let tx = 0, tz = 0, tn = 0;
    const v = new THREE.Vector3();
    const sampleVerts = (fn: (v: T.Vector3) => void) => {
      inner.traverse((o) => {
        const mesh = o as T.Mesh;
        if (!mesh.isMesh) return;
        const posAttr = mesh.geometry.getAttribute('position');
        if (!posAttr) return;
        const stride = Math.max(1, Math.floor(posAttr.count / 600));
        for (let i = 0; i < posAttr.count; i += stride) {
          v.fromBufferAttribute(posAttr as T.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
          fn(v);
        }
      });
    };
    sampleVerts((p) => {
      if (p.y < bottomY) { bx += p.x; bz += p.z; bn++; }
      else if (p.y > topY) { tx += p.x; tz += p.z; tn++; }
    });
    if (bn > 0) { bx /= bn; bz /= bn; }
    if (tn > 0) { tx /= tn; tz /= tn; }
    const armX = tx - bx;
    const armZ = tz - bz;
    const rot = Math.hypot(armX, armZ) > 0.15 ? -Math.atan2(armX, armZ) : 0;
    inner.rotation.y = rot;
    const c2 = Math.cos(rot);
    const s2 = Math.sin(rot);
    inner.position.set(-(bx * c2 + bz * s2), -groupBox.min.y, -(-bx * s2 + bz * c2));

    // the LANTERN is the farthest-overhanging top vertex, relative to the pole
    let lanternDist = 0;
    let lanternY = groupBox.max.y;
    sampleVerts((p) => {
      if (p.y > topY) {
        const d = Math.hypot(p.x - bx, p.z - bz);
        if (d > lanternDist) {
          lanternDist = d;
          lanternY = p.y;
        }
      }
    });
    lantern.arm = lanternDist * 0.8;
    lantern.height = lanternY - groupBox.min.y;
  }

  proto.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as T.MeshStandardMaterial;
      if ('metalness' in std) {
        std.metalness = 0;
        std.roughness = Math.max(0.8, std.roughness ?? 1);
      }
    }
  });

  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,225,160,1)');
    grad.addColorStop(1, 'rgba(255,225,160,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const heads: Array<{ x: number; y: number; z: number }> = [];
  const glows: T.Object3D[] = [];

  const protoDims = new THREE.Box3().setFromObject(proto).getSize(new THREE.Vector3());
  const lampScale = LAMP_HEIGHT / (protoDims.y || 1);
  const step = SPACING / road.length;
  let li = 0;
  for (let t = 0.03; t < 0.985; t += step) {
    const c = road.curve.getPointAt(t);
    const n = road.perp(t).multiplyScalar(li % 2 === 0 ? 1 : -1);
    const lx = c.x + n.x * KERB_OFFSET;
    const lz = c.z + n.z * KERB_OFFSET;
    if (blockers.some((b) => Math.hypot(b.x - lx, b.z - lz) < b.r)) {
      li++;
      continue;
    }
    const inst = proto.clone(true);
    inst.scale.setScalar(lampScale);
    inst.position.set(lx, 0, lz);
    inst.rotation.y = Math.atan2(-n.x, -n.z);
    scene.add(inst);
    addCollider(lx, lz, 0.35, 0.35, 0);

    // the lantern hangs at the crook's end, out over the road
    const armW = lantern.arm * lampScale;
    const headY = lantern.height * lampScale;
    const hx = lx - n.x * armW;
    const hz = lz - n.z * armW;
    heads.push({ x: hx, y: headY, z: hz });

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.scale.setScalar(1.5);
    glow.position.set(hx, headY, hz);
    scene.add(glow);
    glows.push(glow);

    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5),
      new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffca7a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(hx, 0.055, hz);
    scene.add(pool);
    glows.push(pool);
    li++;
  }

  // five real lights, walked to whichever lanterns are nearest the car
  const lightPool: T.PointLight[] = [];
  for (let i = 0; i < 5; i++) {
    const pl = new THREE.PointLight(0xffd9a0, 0, 15, 1.6);
    scene.add(pl);
    lightPool.push(pl);
  }

  // reused each frame instead of sorting a fresh copy of every lantern
  const nearest: Array<{ head: { x: number; y: number; z: number }; d: number }> = [];

  return {
    update(nightFactor: number, px: number, pz: number): void {
      for (const g of glows) {
        (g as T.Sprite).material.opacity = nightFactor * 0.8;
      }
      if (nightFactor <= 0.05 || heads.length === 0) {
        for (const pl of lightPool) pl.intensity = 0;
        return;
      }
      // partial selection: keep only the closest few, no full sort
      nearest.length = 0;
      for (const head of heads) {
        const d = (head.x - px) * (head.x - px) + (head.z - pz) * (head.z - pz);
        if (nearest.length < lightPool.length) {
          nearest.push({ head, d });
          nearest.sort((a, b) => a.d - b.d);
        } else if (d < nearest[nearest.length - 1].d) {
          nearest[nearest.length - 1] = { head, d };
          nearest.sort((a, b) => a.d - b.d);
        }
      }
      lightPool.forEach((pl, i) => {
        const hit = nearest[i];
        if (hit) {
          pl.position.set(hit.head.x, hit.head.y, hit.head.z);
          pl.intensity = nightFactor * 26;
        } else {
          pl.intensity = 0;
        }
      });
    },
  };
}
