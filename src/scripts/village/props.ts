// Asset loading, placement, wind sway, and the collision world.
//
// Colliders are ORIENTED boxes: axis-aligned AABBs bloat diagonally on rotated
// houses, which is what used to create invisible walls beside the road.
import type * as T from 'three';
import type { GltfLoaderLike, Three } from './types';

export interface ColliderBox {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  cos: number;
  sin: number;
}

/** What a collision pass pushed the player out by, this frame. */
export interface Impact {
  /** world-space push applied, in metres */
  x: number;
  z: number;
  /** deepest penetration resolved, in metres */
  depth: number;
}

export type Solid = 'box' | 'trunk' | false;

export interface Props {
  loadAsset(name: string): Promise<T.Group>;
  place(proto: T.Group, targetSize: number, x: number, z: number, rotY: number, solid?: Solid, sway?: number): T.Object3D;
  addOrientedCollider(x: number, z: number, hx: number, hz: number, rotY: number, localCx?: number, localCz?: number): void;
  placeSeasonalTree(summerProto: T.Group, autumnProto: T.Group, size: number, x: number, z: number, rotY: number): void;
  setSeason(season: 'summer' | 'autumn'): void;
  updateSway(t: number): void;
  /** resolves the player circle out of every solid; mutates `pos` */
  resolve(pos: T.Vector3, radius: number): Impact;
  colliderCount(): number;
}

export function createProps(THREE: Three, scene: T.Scene, loader: GltfLoaderLike, rand: () => number): Props {
  const cache = new Map<string, T.Group>();
  const colliders: ColliderBox[] = [];
  const swayers: Array<{ obj: T.Object3D; phase: number; amp: number; rate: number }> = [];
  const seasonPairs: Array<{ summer: T.Object3D; autumn: T.Object3D }> = [];

  async function loadAsset(name: string): Promise<T.Group> {
    if (!cache.has(name)) {
      const gltf = await loader.loadAsync(`/assets/village/${name}.glb`);
      const g = gltf.scene;
      g.traverse((o) => {
        const mesh = o as T.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // glTF defaults metallicFactor to 1; with no env map that renders
          // black. This art style has no metal — force dielectric.
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const std = m as T.MeshStandardMaterial;
            if ('metalness' in std) {
              std.metalness = 0;
              std.roughness = Math.max(0.85, std.roughness ?? 1);
            }
          }
        }
      });
      cache.set(name, g);
    }
    return cache.get(name)!;
  }

  function addOrientedCollider(
    x: number, z: number, hx: number, hz: number, rotY: number, localCx = 0, localCz = 0
  ): void {
    const c = Math.cos(rotY);
    const sn = Math.sin(rotY);
    colliders.push({
      cx: x + localCx * c + localCz * sn,
      cz: z - localCx * sn + localCz * c,
      hx,
      hz,
      cos: c,
      sin: sn,
    });
  }

  function place(
    proto: T.Group, targetSize: number, x: number, z: number, rotY: number, solid: Solid = false, sway = 0
  ): T.Object3D {
    const inst = proto.clone(true);
    const box = new THREE.Box3().setFromObject(inst);
    const dims = box.getSize(new THREE.Vector3());
    const current = Math.max(dims.x, dims.z) || 1;
    const s = targetSize / current;
    inst.scale.setScalar(s);
    inst.position.set(x, -box.min.y * s, z);
    inst.rotation.y = rotY;
    scene.add(inst);
    if (solid === 'box') {
      addOrientedCollider(
        x, z,
        (dims.x * s) / 2, (dims.z * s) / 2,
        rotY,
        ((box.min.x + box.max.x) / 2) * s,
        ((box.min.z + box.max.z) / 2) * s
      );
    } else if (solid === 'trunk') {
      addOrientedCollider(x, z, 0.45, 0.45, 0);
    }
    if (sway > 0) {
      swayers.push({ obj: inst, phase: rand() * 6.28, amp: sway, rate: 0.7 + rand() * 0.7 });
    }
    return inst;
  }

  return {
    loadAsset,
    place,
    addOrientedCollider,

    // summer + autumn variants share a spot; exactly one is visible
    placeSeasonalTree(summerProto, autumnProto, size, x, z, rotY): void {
      const su = place(summerProto, size, x, z, rotY, 'trunk', 0.01);
      const au = place(autumnProto, size, x, z, rotY, false, 0.01);
      au.visible = false;
      seasonPairs.push({ summer: su, autumn: au });
    },

    setSeason(season): void {
      for (const pr of seasonPairs) {
        pr.summer.visible = season === 'summer';
        pr.autumn.visible = season === 'autumn';
      }
    },

    updateSway(t: number): void {
      for (const s of swayers) s.obj.rotation.z = Math.sin(t * s.rate + s.phase) * s.amp;
    },

    resolve(pos: T.Vector3, radius: number): Impact {
      const impact: Impact = { x: 0, z: 0, depth: 0 };
      for (let pass = 0; pass < 2; pass++) {
        const px = pos.x;
        const pz = pos.z;
        for (const c of colliders) {
          const wx = px - c.cx;
          const wz = pz - c.cz;
          const reach = c.hx + c.hz + 4;
          if (wx > reach || wx < -reach || wz > reach || wz < -reach) continue;
          // world → box-local
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
              // centre inside: exit through the nearest local face
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
            // local → world
            const wpx = dxl * c.cos + dzl * c.sin;
            const wpz = -dxl * c.sin + dzl * c.cos;
            pos.x += wpx;
            pos.z += wpz;
            impact.x += wpx;
            impact.z += wpz;
          }
        }
      }
      return impact;
    },

    colliderCount: () => colliders.length,
  };
}
