// Asset loading, placement, wind sway, and the collision world.
//
// Placement is INSTANCED. `place` only queues a transform; `commit` then builds
// one InstancedMesh per proto mesh, so five hundred trees, rocks and flowers
// cost a couple of dozen draw calls instead of five hundred.
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
export type Season = 'summer' | 'autumn';

export interface Props {
  loadAsset(name: string): Promise<T.Group>;
  /** queues a placement; nothing renders until `commit` */
  place(proto: T.Group, targetSize: number, x: number, z: number, rotY: number, solid?: Solid, sway?: number): void;
  placeSeasonalTree(summerProto: T.Group, autumnProto: T.Group, size: number, x: number, z: number, rotY: number): void;
  addOrientedCollider(x: number, z: number, hx: number, hz: number, rotY: number, localCx?: number, localCz?: number): void;
  /** builds the instanced meshes — call once, after everything is placed */
  commit(): void;
  /** how big a proto ends up once placed at `targetSize` */
  scaledSize(proto: T.Group, targetSize: number): { x: number; y: number; z: number };
  setSeason(season: Season): void;
  updateSway(t: number): void;
  /** resolves the player circle out of every solid; mutates `pos` */
  resolve(pos: T.Vector3, radius: number): Impact;
  colliderCount(): number;
  drawCallCount(): number;
}

interface Placement {
  matrix: T.Matrix4;
  sway: { phase: number; amp: number; rate: number } | null;
}

interface Queue {
  proto: T.Group;
  items: Placement[];
  season: Season | null;
  hasSway: boolean;
}

interface Metrics {
  maxDim: number;
  min: T.Vector3;
  max: T.Vector3;
  size: T.Vector3;
}

export function createProps(THREE: Three, scene: T.Scene, loader: GltfLoaderLike, rand: () => number): Props {
  const cache = new Map<string, T.Group>();
  const protoNames = new Map<T.Group, string>();
  const metricsCache = new Map<T.Group, Metrics>();
  const queues = new Map<string, Queue>();
  const colliders: ColliderBox[] = [];
  const seasonMeshes: Record<Season, T.Object3D[]> = { summer: [], autumn: [] };
  // one shared uniform object, referenced by every swaying material
  const swayTime = { value: 0 };
  let drawCalls = 0;

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
      protoNames.set(g, name);
    }
    return cache.get(name)!;
  }

  function metrics(proto: T.Group): Metrics {
    let m = metricsCache.get(proto);
    if (!m) {
      const box = new THREE.Box3().setFromObject(proto);
      const size = box.getSize(new THREE.Vector3());
      m = { maxDim: Math.max(size.x, size.z) || 1, min: box.min.clone(), max: box.max.clone(), size };
      metricsCache.set(proto, m);
    }
    return m;
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

  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  function queue(
    proto: T.Group, targetSize: number, x: number, z: number, rotY: number,
    solid: Solid, sway: number, season: Season | null
  ): void {
    const key = `${protoNames.get(proto) ?? 'anon'}|${season ?? ''}`;
    let q = queues.get(key);
    if (!q) {
      q = { proto, items: [], season, hasSway: false };
      queues.set(key, q);
    }

    const m = metrics(proto);
    const s = targetSize / m.maxDim;
    const matrix = new THREE.Matrix4().compose(
      tmpPos.set(x, -m.min.y * s, z),
      tmpQuat.setFromAxisAngle(yAxis, rotY),
      tmpScale.setScalar(s)
    );
    q.items.push({
      matrix,
      sway: sway > 0 ? { phase: rand() * 6.28, amp: sway, rate: 0.7 + rand() * 0.7 } : null,
    });
    if (sway > 0) q.hasSway = true;

    if (solid === 'box') {
      addOrientedCollider(
        x, z,
        (m.size.x * s) / 2, (m.size.z * s) / 2,
        rotY,
        ((m.min.x + m.max.x) / 2) * s,
        ((m.min.z + m.max.z) / 2) * s
      );
    } else if (solid === 'trunk') {
      addOrientedCollider(x, z, 0.45, 0.45, 0);
    }
  }

  // Sway used to be a per-object rotation.z on the instance root, pivoting at
  // the model's base. Instanced geometry is pre-baked into placement space, so
  // the same rotation about Z at the origin reproduces it exactly — in the
  // vertex shader, for free.
  function patchSway(mat: T.Material): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSwayTime = swayTime;
      shader.vertexShader =
        'attribute vec3 aSway;\nuniform float uSwayTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float swayAng = sin(uSwayTime * aSway.z + aSway.x) * aSway.y;
           float swayC = cos(swayAng);
           float swayS = sin(swayAng);
           transformed.xy = vec2(
             transformed.x * swayC - transformed.y * swayS,
             transformed.x * swayS + transformed.y * swayC
           );`
        );
    };
    mat.customProgramCacheKey = () => 'village-sway';
  }

  // Models ship meshopt-quantized, so their positions and normals arrive as
  // normalized Int16. Transforming those in place writes float results back
  // into an integer array, which truncates the mesh into rubble — rebuild
  // every attribute as float first. getX/getY/getZ denormalize for us and work
  // on interleaved buffers too.
  function bakeGeometry(mesh: T.Mesh): T.BufferGeometry {
    const src = mesh.geometry;
    const geo = new THREE.BufferGeometry();
    if (src.index) geo.setIndex(src.index.clone());
    for (const [name, attr] of Object.entries(src.attributes)) {
      const items = attr.itemSize;
      const out = new Float32Array(attr.count * items);
      for (let i = 0; i < attr.count; i++) {
        const o = i * items;
        out[o] = attr.getX(i);
        if (items > 1) out[o + 1] = attr.getY(i);
        if (items > 2) out[o + 2] = attr.getZ(i);
        if (items > 3) out[o + 3] = attr.getW(i);
      }
      geo.setAttribute(name, new THREE.BufferAttribute(out, items));
    }
    // bakes the mesh's place within the proto in, so the instance matrix is
    // exactly the placement and sway pivots at the model's base
    geo.applyMatrix4(mesh.matrixWorld);
    return geo;
  }

  function commit(): void {
    for (const q of queues.values()) {
      if (q.items.length === 0) continue;
      q.proto.updateMatrixWorld(true);

      const meshes: T.Mesh[] = [];
      q.proto.traverse((o) => {
        const mesh = o as T.Mesh;
        if (mesh.isMesh) meshes.push(mesh);
      });

      for (const mesh of meshes) {
        const geo = bakeGeometry(mesh);
        const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const mat = src.clone();

        const im = new THREE.InstancedMesh(geo, mat, q.items.length);
        im.castShadow = true;
        im.receiveShadow = true;
        for (let i = 0; i < q.items.length; i++) im.setMatrixAt(i, q.items[i].matrix);
        im.instanceMatrix.needsUpdate = true;

        if (q.hasSway) {
          const sway = new Float32Array(q.items.length * 3);
          for (let i = 0; i < q.items.length; i++) {
            const s = q.items[i].sway;
            sway[i * 3] = s ? s.phase : 0;
            sway[i * 3 + 1] = s ? s.amp : 0;
            sway[i * 3 + 2] = s ? s.rate : 0;
          }
          geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 3));
          patchSway(mat);
        }

        // the default bounding sphere covers one instance at the origin, which
        // would cull the whole field the moment that spot left frame
        im.computeBoundingSphere();
        scene.add(im);
        drawCalls++;
        if (q.season) {
          seasonMeshes[q.season].push(im);
          im.visible = q.season === 'summer';
        }
      }
    }
    queues.clear();
  }

  return {
    loadAsset,
    addOrientedCollider,
    commit,

    place(proto, targetSize, x, z, rotY, solid = false, sway = 0): void {
      queue(proto, targetSize, x, z, rotY, solid, sway, null);
    },

    // summer + autumn variants share a spot; exactly one set is visible
    placeSeasonalTree(summerProto, autumnProto, size, x, z, rotY): void {
      queue(summerProto, size, x, z, rotY, 'trunk', 0.01, 'summer');
      queue(autumnProto, size, x, z, rotY, false, 0.01, 'autumn');
    },

    scaledSize(proto, targetSize) {
      const m = metrics(proto);
      const s = targetSize / m.maxDim;
      return { x: m.size.x * s, y: m.size.y * s, z: m.size.z * s };
    },

    setSeason(season): void {
      for (const m of seasonMeshes.summer) m.visible = season === 'summer';
      for (const m of seasonMeshes.autumn) m.visible = season === 'autumn';
    },

    updateSway(t: number): void {
      swayTime.value = t;
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
    drawCallCount: () => drawCalls,
  };
}
