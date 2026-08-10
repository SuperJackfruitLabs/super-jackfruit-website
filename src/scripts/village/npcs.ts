// The people who live here.
//
// Kenney's Blocky Characters (CC0) are node-animated rather than skinned — the
// legs, arms, torso and head are plain meshes with transform tracks — so a
// crowd of them costs an AnimationMixer each and no skinning at all.
//
// Walkers pace the pavement along the road spine and stand aside when the car
// comes past; idlers wait in their front gardens. Mixers only tick for the
// villagers near enough to see moving.
import type * as T from 'three';
import type { Three } from './types';
import type { LoadedGltf } from './props';
import type { Road } from './road';

/** villager height in village units — a shade under half the car's length */
const HEIGHT = 1.4;
/** the pavement sits just outside the asphalt */
const PAVEMENT_OFFSET = 4.8;
const WALK_SPEED = 1.15;
/** how close the car gets before a walker stops to let it by */
const YIELD_RADIUS = 5.5;
/** past this, a villager keeps its place but stops animating */
const ANIMATE_RADIUS = 70;

export { NPC_MODELS } from '../../data/village-models';
import { NPC_MODELS } from '../../data/village-models';

export interface IdleSpot {
  x: number;
  z: number;
  facing: number;
}

export interface NpcCounts {
  walkers: number;
  idlers: number;
}

export interface Npcs {
  update(dt: number, carX: number, carZ: number): void;
  count(): number;
  /** where everyone is and what they're doing — for the debug hook */
  list(): Array<{ x: number; z: number; walker: boolean; yielding: boolean; clock: number }>;
}

interface Villager {
  root: T.Object3D;
  mixer: T.AnimationMixer;
  idle: T.AnimationAction;
  walk: T.AnimationAction | null;
  /** walkers only */
  t: number;
  dir: 1 | -1;
  side: 1 | -1;
  speed: number;
  yielding: boolean;
  isWalker: boolean;
}

export async function createNpcs(
  THREE: Three,
  scene: T.Scene,
  load: (name: string) => Promise<LoadedGltf>,
  road: Road,
  idleSpots: IdleSpot[],
  counts: NpcCounts,
  rand: () => number
): Promise<Npcs> {
  const wanted = counts.walkers + counts.idlers;
  if (wanted === 0) return { update: () => {}, count: () => 0, list: () => [] };

  const loaded = await Promise.all(
    NPC_MODELS.map(async (name) => {
      const gltf = await load(name);
      const group = gltf.scene;
      group.traverse((o) => {
        const mesh = o as T.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as T.MeshStandardMaterial;
          if ('metalness' in std) {
            std.metalness = 0;
            std.roughness = Math.max(0.85, std.roughness ?? 1);
          }
        }
      });
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      return {
        group,
        clips: gltf.animations,
        scale: HEIGHT / (size.y || 1),
        footY: box.min.y,
      };
    })
  );

  const villagers: Villager[] = [];

  function spawn(isWalker: boolean, index: number): Villager {
    const proto = loaded[index % loaded.length];
    const root = proto.group.clone(true);
    root.scale.setScalar(proto.scale);
    root.position.y = -proto.footY * proto.scale;

    // a wrapper carries position and facing, so the model's own offset stays put
    const holder = new THREE.Group();
    holder.add(root);
    scene.add(holder);

    const mixer = new THREE.AnimationMixer(root);
    const find = (name: string) => proto.clips.find((c) => c.name === name) ?? null;
    const idleClip = find('idle');
    const walkClip = find('walk');
    if (!idleClip) throw new Error(`${NPC_MODELS[index % NPC_MODELS.length]}: no idle clip`);

    const idle = mixer.clipAction(idleClip);
    const walk = walkClip ? mixer.clipAction(walkClip) : null;
    idle.play();
    if (walk && isWalker) {
      walk.play();
      idle.setEffectiveWeight(0);
      walk.setEffectiveWeight(1);
    }
    // stagger the loop, so a row of villagers doesn't march in lockstep
    mixer.setTime(rand() * 2);

    return {
      root: holder,
      mixer,
      idle,
      walk,
      t: 0,
      dir: 1,
      side: 1,
      speed: WALK_SPEED * (0.82 + rand() * 0.36),
      yielding: false,
      isWalker,
    };
  }

  for (let i = 0; i < counts.walkers; i++) {
    const v = spawn(true, i);
    v.t = 0.06 + (i / Math.max(1, counts.walkers)) * 0.86 + rand() * 0.03;
    v.dir = rand() < 0.5 ? 1 : -1;
    v.side = i % 2 === 0 ? 1 : -1;
    villagers.push(v);
  }

  const spots = [...idleSpots];
  for (let i = 0; i < counts.idlers && spots.length > 0; i++) {
    const v = spawn(false, i + counts.walkers);
    const spot = spots.splice(Math.floor(rand() * spots.length), 1)[0];
    v.root.position.set(spot.x, 0, spot.z);
    v.root.rotation.y = spot.facing;
    villagers.push(v);
  }

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  return {
    count: () => villagers.length,

    list: () =>
      villagers.map((v) => ({
        x: +v.root.position.x.toFixed(2),
        z: +v.root.position.z.toFixed(2),
        walker: v.isWalker,
        yielding: v.yielding,
        clock: +v.mixer.time.toFixed(2),
      })),

    update(dt, carX, carZ): void {
      for (const v of villagers) {
        if (v.isWalker) {
          const near = Math.hypot(v.root.position.x - carX, v.root.position.z - carZ) < YIELD_RADIUS;
          if (near !== v.yielding) {
            v.yielding = near;
            if (v.walk) {
              // half a second is long enough to read as stopping, short enough
              // not to look like a stutter at speed
              v.walk.crossFadeTo(v.idle, 0.35, false);
              if (!near) v.idle.crossFadeTo(v.walk, 0.35, false);
            }
          }
          if (!v.yielding) {
            v.t += (v.dir * v.speed * dt) / road.length;
            if (v.t > 0.97) {
              v.t = 0.97;
              v.dir = -1;
            } else if (v.t < 0.03) {
              v.t = 0.03;
              v.dir = 1;
            }
          }
          road.curve.getPointAt(v.t, point);
          const n = road.perp(v.t);
          v.root.position.set(
            point.x + n.x * PAVEMENT_OFFSET * v.side,
            0,
            point.z + n.z * PAVEMENT_OFFSET * v.side
          );
          road.curve.getTangentAt(v.t, tangent);
          v.root.rotation.y = Math.atan2(tangent.x * v.dir, tangent.z * v.dir);
        }

        if (Math.hypot(v.root.position.x - carX, v.root.position.z - carZ) < ANIMATE_RADIUS) {
          v.mixer.update(dt);
        }
      }
    },
  };
}
