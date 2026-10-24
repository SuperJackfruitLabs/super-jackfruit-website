// The people who live here.
//
// Kenney's Blocky Characters (CC0) are node-animated rather than skinned — the
// legs, arms, torso and head are plain meshes with transform tracks — so a
// crowd of them costs an AnimationMixer each and no skinning at all.
//
// Walkers pace the pavement along the road spine and stand aside when the car
// comes past; idlers wait in their front gardens. Mixers only tick for the
// villagers near enough to see moving.
//
// The walkers are a fixed pool (pool.ts) that follows the visitor: one left far
// behind, out of sight, is moved to a pavement somewhere ahead, so a small
// crowd always seems to be about wherever you drive.
//
// Neighbours who pass close enough sometimes stop for a chat: the pair turn to
// face each other and stand a few seconds, then go their ways and don't chat
// again for a while. The meeting rules (a chance on meeting, a few seconds'
// talk, a longer social cooldown) follow slop-newyork's js/traffic.js meet();
// the behaviour is re-written here for the village's own villagers.
import type * as T from 'three';
import type { Three } from './types';
import type { LoadedGltf } from './props';
import type { RoadSegment } from './road';
import { createPool, type ActorPool, type PoolActor, type SpawnRules } from './pool';

/** villager height in village units — a shade under half the car's length */
const HEIGHT = 1.4;
const WALK_SPEED = 1.15;
/** how close the car gets before a walker stops to let it by */
const YIELD_RADIUS = 5.5;
/** past this, a villager keeps its place but stops animating */
const ANIMATE_RADIUS = 70;
/** closer than this and a villager hops out of the car's way */
const DODGE_RADIUS = 2.6;
/** how far they hop, and how long the hop lasts */
const DODGE_STEP = 2;
const HOP_TIME = 0.4;
/** walkers left further behind than this, out of view, are recycled */
const WALKER_RETIRE = 95;
/** how close two villagers come before they may stop to talk: on the same pavement, and across a front garden */
const MEET_WALKERS = 2.6;
const MEET_GARDEN = 4.8;
/** the chance a meeting turns into a chat; a missed one isn't rolled for again soon */
const CHAT_CHANCE = 0.55;
const CHAT_MIN = 6;
const CHAT_MAX = 12;
const COOLDOWN_MIN = 30;
const COOLDOWN_MAX = 90;
/** and land this far from the visitor */
const WALKER_SPAWN_MIN = 30;
const WALKER_SPAWN_MAX = 85;

export { NPC_MODELS } from '../../data/village-models';
import { NPC_MODELS } from '../../data/village-models';
import { FOOTPATH, KERB_TOP } from './road';

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
  /** `inView` is the camera's frustum test, so recycling happens off-screen */
  update(dt: number, carX: number, carZ: number, carHeading: number, inView: SpawnRules['inView'], reduced?: boolean): void;
  /** the car was teleported: place the walkers round its new spot */
  reseed(): void;
  /** recycling activity since the last call */
  poolStats(): { placed: number; reseeds: number };
  /** the pairs chatting right now, for the murmur: where they stand and who is speaking */
  conversations(): Array<{ id: number; x: number; z: number; started: number }>;
  count(): number;
  /** where everyone is and what they're doing — for the debug hook */
  list(): Array<{ x: number; z: number; walker: boolean; yielding: boolean; talking: boolean; clock: number }>;
}

interface Villager extends PoolActor {
  root: T.Object3D;
  mixer: T.AnimationMixer;
  idle: T.AnimationAction;
  walk: T.AnimationAction | null;
  /** walkers only */
  seg: RoadSegment;
  t: number;
  dir: 1 | -1;
  side: 1 | -1;
  speed: number;
  yielding: boolean;
  isWalker: boolean;
  /** where an idler stands; walkers take theirs from the road */
  home: { x: number; y: number; z: number };
  /** which way an idler faces when nobody is talking to it */
  facing: number;
  /** stopped, for the car or for a chat; the walk and idle clips follow this */
  stopped: boolean;
  /** the chat this villager is in, and when it may next start one */
  chat: { with: Villager; until: number; id: number; started: number } | null;
  sociable: number;
  /** the sidestep from the car, eased in and back out, and the hop that goes with it */
  dodge: { x: number; z: number; tx: number; tz: number; hop: number };
}

export async function createNpcs(
  THREE: Three,
  scene: T.Scene,
  load: (name: string) => Promise<LoadedGltf>,
  segments: RoadSegment[],
  idleSpots: IdleSpot[],
  counts: NpcCounts,
  rand: () => number
): Promise<Npcs> {
  const wanted = counts.walkers + counts.idlers;
  if (wanted === 0) {
    return { update: () => {}, reseed: () => {}, poolStats: () => ({ placed: 0, reseeds: 0 }), conversations: () => [], count: () => 0, list: () => [] };
  }

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
      active: !isWalker, // walkers wait for the pool to place them
      x: 0,
      z: 0,
      root: holder,
      mixer,
      idle,
      walk,
      seg: segments[0],
      t: 0,
      dir: 1,
      side: 1,
      speed: WALK_SPEED * (0.82 + rand() * 0.36),
      yielding: false,
      isWalker,
      home: { x: 0, y: 0, z: 0 },
      facing: 0,
      stopped: false,
      chat: null,
      sociable: rand() * 20,
      dodge: { x: 0, z: 0, tx: 0, tz: 0, hop: 0 },
    };
  }

  const walkers: Villager[] = [];
  for (let i = 0; i < counts.walkers; i++) {
    const v = spawn(true, i);
    v.side = i % 2 === 0 ? 1 : -1;
    v.root.visible = false;
    villagers.push(v);
    walkers.push(v);
    // the walkers used to draw their places from the layout's seeded sequence; keep
    // drawing them, so the idlers and chimneys after them stand where they always have
    rand();
    rand();
  }

  // a side street has no pavement across its junction apron, so walkers keep off its first stretch
  const tMinOf = (seg: RoadSegment) => (seg.id === 'main' ? 0.03 : Math.min(0.4, 16 / seg.length));
  const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
  const probe = new THREE.Vector3();
  /**
   * A pavement spot the rules allow: a few random tries, longer streets more
   * often, and the first one ahead of the car wins. One behind is kept only
   * when nothing ahead turned up.
   */
  function placeWalker(v: Villager, rules: SpawnRules): boolean {
    let behind: { seg: RoadSegment; t: number; side: 1 | -1; x: number; z: number } | null = null;
    const take = (c: NonNullable<typeof behind>) => {
      v.seg = c.seg;
      v.t = c.t;
      v.side = c.side;
      v.dir = Math.random() < 0.5 ? 1 : -1;
      v.x = c.x;
      v.z = c.z;
      v.dodge = { x: 0, z: 0, tx: 0, tz: 0, hop: 0 };
      v.root.visible = true;
      return true;
    };
    for (let attempt = 0; attempt < 8; attempt++) {
      let pick = Math.random() * totalLength;
      let seg = segments[0];
      for (const s of segments) {
        seg = s;
        if ((pick -= s.length) <= 0) break;
      }
      const tMin = tMinOf(seg) + 0.01;
      const t = tMin + Math.random() * (0.96 - tMin);
      const side: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      seg.curve.getPointAt(t, probe);
      const n = seg.perp(t);
      const pavement = seg.width / 2 + FOOTPATH / 2;
      const x = probe.x + n.x * pavement * side;
      const z = probe.z + n.z * pavement * side;
      const d = Math.hypot(x - rules.focusX, z - rules.focusZ);
      if (d < rules.minDist || d > rules.maxDist) continue;
      if (!rules.mayBeSeen && d < rules.farView && rules.inView(x, z, 2)) continue;
      const spot = { seg, t, side, x, z };
      if ((x - rules.focusX) * rules.headX + (z - rules.focusZ) * rules.headZ > 0) return take(spot);
      behind ??= spot;
    }
    return behind ? take(behind) : false;
  }
  const pool: ActorPool<Villager> = createPool({
    actors: walkers,
    retireRadius: WALKER_RETIRE,
    spawnMin: WALKER_SPAWN_MIN,
    spawnMax: WALKER_SPAWN_MAX,
    budget: 1,
    farView: 70,
    place: placeWalker,
  });

  const spots = [...idleSpots];
  for (let i = 0; i < counts.idlers && spots.length > 0; i++) {
    const v = spawn(false, i + counts.walkers);
    const spot = spots.splice(Math.floor(rand() * spots.length), 1)[0];
    v.root.position.set(spot.x, 0, spot.z);
    v.home = { x: spot.x, y: 0, z: spot.z };
    v.root.rotation.y = spot.facing;
    v.facing = spot.facing;
    v.x = spot.x;
    v.z = spot.z;
    villagers.push(v);
  }

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  let clock = 0;
  let chats = 0;

  /** pairs who meet may stop to talk; checked a few times a second, not every frame */
  let sinceMeet = 0;
  function meet(carX: number, carZ: number): void {
    for (const a of villagers) {
      if (!a.active || !a.isWalker || a.chat || a.yielding || clock < a.sociable) continue;
      for (const b of villagers) {
        if (b === a || !b.active || b.chat || clock < b.sociable) continue;
        const reach = b.isWalker ? MEET_WALKERS : MEET_GARDEN;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > reach || d < 0.6) continue;
        // never right by the car, where everyone is busy getting out of its way
        if (Math.hypot(a.x - carX, a.z - carZ) < YIELD_RADIUS * 1.5) continue;
        if (Math.random() > CHAT_CHANCE) {
          a.sociable = clock + 8; // walked on by; ask again further along
          break;
        }
        const until = clock + CHAT_MIN + Math.random() * (CHAT_MAX - CHAT_MIN);
        const id = ++chats;
        a.chat = { with: b, until, id, started: clock };
        b.chat = { with: a, until, id, started: clock };
        break;
      }
    }
  }
  function endChat(v: Villager): void {
    const other = v.chat?.with;
    for (const p of other ? [v, other] : [v]) {
      p.chat = null;
      p.sociable = clock + COOLDOWN_MIN + Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN);
    }
  }
  /** turn smoothly toward an angle, the short way round */
  const turnTo = (v: Villager, target: number, dt: number) => {
    let d = target - v.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.root.rotation.y += d * Math.min(1, dt * 5);
  };

  return {
    count: () => villagers.length,
    reseed: () => pool.reseed(),
    poolStats: () => pool.takeStats(),

    conversations: () => {
      const out = new Map<number, { id: number; x: number; z: number; started: number }>();
      for (const v of villagers) {
        if (!v.chat || out.has(v.chat.id)) continue;
        out.set(v.chat.id, { id: v.chat.id, x: (v.x + v.chat.with.x) / 2, z: (v.z + v.chat.with.z) / 2, started: v.chat.started });
      }
      return [...out.values()];
    },

    list: () =>
      villagers.map((v) => ({
        x: +v.root.position.x.toFixed(2),
        z: +v.root.position.z.toFixed(2),
        walker: v.isWalker,
        yielding: v.yielding,
        talking: !!v.chat,
        clock: +v.mixer.time.toFixed(2),
      })),

    update(dt, carX, carZ, carHeading, inView, reduced = false): void {
      const autonomousDt = reduced ? 0 : dt;
      clock += autonomousDt;
      pool.update(carX, carZ, carHeading, inView);
      sinceMeet += autonomousDt;
      if (sinceMeet > 0.25) {
        sinceMeet = 0;
        meet(carX, carZ);
      }
      for (const v of villagers) {
        // a chat ends on time, when the car comes, or when the other one was recycled away
        if (v.chat) {
          const o = v.chat.with;
          const carNear = Math.hypot(v.x - carX, v.z - carZ) < YIELD_RADIUS;
          if (clock > v.chat.until || carNear || !o.active || o.chat?.id !== v.chat.id || Math.hypot(o.x - v.x, o.z - v.z) > MEET_GARDEN + 1.5) endChat(v);
        }
        if (!v.active) continue;
        if (v.isWalker) {
          const near = Math.hypot(v.root.position.x - carX, v.root.position.z - carZ) < YIELD_RADIUS;
          v.yielding = near;
          const stop = near || !!v.chat;
          if (stop !== v.stopped) {
            v.stopped = stop;
            if (v.walk) {
              // half a second is long enough to read as stopping, short enough
              // not to look like a stutter at speed. Fade one way only, and wake the
              // action being faded in: fading both ways at once could leave the walk
              // at zero weight while the walker kept moving, so it glided.
              const [from, to] = stop ? [v.walk, v.idle] : [v.idle, v.walk];
              to.enabled = true;
              to.setEffectiveTimeScale(1);
              to.setEffectiveWeight(1);
              from.crossFadeTo(to, 0.35, false);
            }
          }
          if (!v.stopped) {
            v.t += (v.dir * v.speed * autonomousDt) / v.seg.length;
            // turn walkers round before they end up strolling down the tarmac
            const tMin = tMinOf(v.seg);
            if (v.t > 0.97) {
              v.t = 0.97;
              v.dir = -1;
            } else if (v.t < tMin) {
              v.t = tMin;
              v.dir = 1;
            }
          }
          v.seg.curve.getPointAt(v.t, point);
          const n = v.seg.perp(v.t);
          // the middle of the footpath, standing on it rather than in the road
          const pavement = v.seg.width / 2 + FOOTPATH / 2;
          v.home = { x: point.x + n.x * pavement * v.side, y: KERB_TOP, z: point.z + n.z * pavement * v.side };
          v.seg.curve.getTangentAt(v.t, tangent);
          if (!v.chat) turnTo(v, Math.atan2(tangent.x * v.dir, tangent.z * v.dir), autonomousDt * 3);
        } else if (!v.chat) {
          turnTo(v, v.facing, autonomousDt);
        }
        // in a chat: face the other one
        if (v.chat) turnTo(v, Math.atan2(v.chat.with.x - v.x, v.chat.with.z - v.z), autonomousDt);

        // in the car's way: hop aside, away from it, then drift home once it has gone
        const d = v.dodge;
        const ax = v.home.x + d.x - carX, az = v.home.z + d.z - carZ;
        const dist = Math.hypot(ax, az);
        if (dist < DODGE_RADIUS && d.hop <= 0) {
          const k = DODGE_STEP / Math.max(dist, 0.01);
          d.tx = d.x + ax * k;
          d.tz = d.z + az * k;
          d.hop = HOP_TIME;
        } else if (dist > DODGE_RADIUS * 2.5) {
          d.tx = 0;
          d.tz = 0;
        }
        const ease = Math.min(1, dt * (d.hop > 0 ? 14 : 1.5));
        d.x += (d.tx - d.x) * ease;
        d.z += (d.tz - d.z) * ease;
        d.hop = Math.max(0, d.hop - dt);
        const lift = d.hop > 0 ? Math.sin((1 - d.hop / HOP_TIME) * Math.PI) * 0.45 : 0;
        v.root.position.set(v.home.x + d.x, v.home.y + lift, v.home.z + d.z);
        v.x = v.root.position.x;
        v.z = v.root.position.z;

        if (Math.hypot(v.root.position.x - carX, v.root.position.z - carZ) < ANIMATE_RADIUS) {
          v.mixer.update(autonomousDt);
        }
      }
    },
  };
}
