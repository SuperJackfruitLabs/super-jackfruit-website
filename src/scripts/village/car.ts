// The car, and everything that makes it feel like it has mass.
//
// Which car, and how it handles, comes from cars.ts.
//
// Rig, outermost first:
//   root  — world position + heading yaw
//   body  — suspension: pitch, roll, and vertical travel
//   car   — the scaled model, swapped out whole when another car is picked;
//           its wheels hang off pivots built in rig()
// Lights and exhaust ride on `body`, so braking really does throw the
// headlights down at the road.
import type * as T from 'three';
import type { Three } from './types';
import type { Impact, LoadedGltf } from './props';
import type { InputState } from './input';
import type { AudioBus } from './audio';
import { carById, type CarChoice, type CarSpec, type Handling } from './cars';
import { createLatestChoice } from './latest-choice.mjs';
import { finishVehicle, type CarEnvironment } from './car-finish';

// Handling lives per car in cars.ts; only reverse is the same for all.
const MAX_REVERSE = 4;

const MARKS = 160;
const MARK_LIFE = 9;
const MARK_HALF_W = 0.14;
const MARK_HALF_L = 0.26;
const DUST = 90;

export interface CarCtx {
  /** pushes the car out of anything solid; mutates the position */
  resolve(pos: T.Vector3, radius: number): Impact;
  offRoad(x: number, z: number): boolean;
  reducedMotion: boolean;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface Car {
  root: T.Group;
  speed: number;
  heading: number;
  /** 0..1, decays after a knock — the camera borrows this */
  shake: number;
  update(dt: number, t: number, input: InputState, ctx: CarCtx, audio: AudioBus): void;
  applyNight(nightFactor: number): void;
  teleport(x: number, z: number, heading: number): void;
  /** the car being driven */
  readonly spec: CarSpec;
  /** swap to another car or paint where the current one stands */
  choose(choice: CarChoice): Promise<void>;
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

interface Wheel {
  pivot: T.Object3D;
  roll: T.Object3D;
  baseY: number;
  x: number;
  z: number;
  front: boolean;
}

/** One car model, rigged: its scaled body, its wheels and its paint. */
interface Model {
  car: T.Group;
  wheels: Wheel[];
  /** the paint, kept with its daylight colour, so it can be lifted after dark */
  paint: Array<{ mat: T.MeshStandardMaterial; base: T.Color }>;
  /** the materials the picker repaints; empty for a car that comes as it is */
  paintMats: T.MeshStandardMaterial[];
  /** cloned by rig(); geometry and textures remain owned by the loader cache */
  materials: T.Material[];
  headlights: T.MeshStandardMaterial[];
  brakeLights: T.MeshStandardMaterial[];
  policeRed: T.MeshStandardMaterial[];
  policeBlue: T.MeshStandardMaterial[];
  wheelRadius: number;
  /** root-space extents, for where the lights and exhaust go */
  halfW: number;
  front: number;
  rear: number;
  height: number;
}

const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

/** Rig a freshly cloned model with four independently pivoted wheel nodes. */
function rig(THREE: Three, spec: CarSpec, gltf: LoadedGltf, env: CarEnvironment): Model {
  const src = gltf.scene.clone(true);
  let variant: T.Object3D = src;
  if (spec.id === 'offroad') {
    let found: T.Object3D | undefined;
    src.traverse((o: T.Object3D) => {
      if (!found && norm(o.name) === 'cube5') found = o;
    });
    if (!found) throw new Error('offroad-car: paint variant not found');
    found.position.x = 0;
    found.position.z = 0;
    variant = found;
  }

  const car = new THREE.Group();
  car.add(variant);
  finishVehicle(THREE, car, env);
  const paint: Model['paint'] = [];
  const paintMats: T.MeshStandardMaterial[] = [];
  const materials: T.Material[] = [];
  const headlights: T.MeshStandardMaterial[] = [];
  const brakeLights: T.MeshStandardMaterial[] = [];
  const policeRed: T.MeshStandardMaterial[] = [];
  const policeBlue: T.MeshStandardMaterial[] = [];
  car.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.push(...mats);
    for (const m of mats) {
      const std = m as T.MeshStandardMaterial;
      if (!('emissive' in std)) continue;
      const role = std.userData.carRole;
      if (role === 'paint') paint.push({ mat: std, base: std.color.clone() });
      if (role === 'headlight') headlights.push(std);
      if (role === 'taillight') brakeLights.push(std);
      if (role === 'police-red') policeRed.push(std);
      if (role === 'police-blue') policeBlue.push(std);
      if (spec.paints.length && norm(std.name) === 'material') paintMats.push(std);
    }
  });

  // Steering yaw and axle roll each get their own clean pivot instead of
  // touching the node's Euler, since the nodes carry baked rotations.
  const wheels: Wheel[] = [];
  const parent = variant;
  for (const child of [...parent.children]) {
    const kenney = /^wheel/i.test(child.name);
    // the off-roader's spare on the tailgate rides high and stays fixed
    const offroad = /^Cylinder/.test(child.name) && child.position.y <= -0.5;
    if (!kenney && !offroad) continue;
    const pivot = new THREE.Group();
    pivot.position.copy(child.position);
    const roll = new THREE.Group();
    pivot.add(roll);
    child.position.set(0, 0, 0);
    roll.add(child);
    parent.add(pivot);
    const front = kenney ? /front/i.test(child.name) : pivot.position.z > 0; // nose is +z
    wheels.push({ pivot, roll, baseY: pivot.position.y, x: pivot.position.x, z: pivot.position.z, front });
  }

  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const scale = spec.length / (size.z || 1);
  car.scale.setScalar(scale);
  car.position.y = -box.min.y * scale;

  let wheelRadius = 0.3;
  if (wheels.length) {
    const wb = new THREE.Box3().setFromObject(wheels[0].roll);
    wheelRadius = (wb.getSize(new THREE.Vector3()).y / 2) * scale || 0.3;
  }

  return {
    car,
    wheels,
    paint,
    paintMats,
    materials,
    headlights,
    brakeLights,
    policeRed,
    policeBlue,
    wheelRadius,
    halfW: (size.x / 2) * scale,
    front: box.max.z * scale,
    rear: box.min.z * scale,
    height: size.y * scale,
  };
}

export async function createCar(
  THREE: Three,
  load: (name: string) => Promise<LoadedGltf>,
  scene: T.Scene,
  choice: CarChoice,
  env: CarEnvironment
): Promise<Car> {
  let spec = carById(choice.car);
  let h: Handling = spec.handling;
  let model = rig(THREE, spec, await load(spec.model), env);

  const body = new THREE.Group();
  body.add(model.car);
  const root = new THREE.Group();
  root.add(body);
  root.position.set(0, 0, 8);
  scene.add(root);

  const contactTexture = new THREE.CanvasTexture(softBlob(64, 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'));
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  contactShadow.position.y = 0.035;
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  // ---------- nitro exhaust ----------
  const flameTex = new THREE.CanvasTexture(
    softBlob(64, 'rgba(255,220,150,1)', 'rgba(255,80,30,0)')
  );
  flameTex.colorSpace = THREE.SRGBColorSpace;
  const nitroFlames: T.Sprite[] = [];
  for (let i = 0; i < 2; i++) {
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flameTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flame.scale.setScalar(0.5);
    body.add(flame);
    nitroFlames.push(flame);
  }

  // ---------- head- and taillights ----------
  const headlights: T.SpotLight[] = [];
  const headGlows: T.Sprite[] = [];
  const tails: T.Sprite[] = [];
  const lightSprites: T.Sprite[] = [];
  {
    const headTex = new THREE.CanvasTexture(softBlob(64, 'rgba(255,246,214,1)', 'rgba(255,246,214,0)'));
    for (let i = 0; i < 2; i++) {
      const spot = new THREE.SpotLight(0xfff2cc, 0, 24, 0.52, 0.4, 1.0);
      spot.target = new THREE.Object3D();
      body.add(spot.target);
      body.add(spot);
      headlights.push(spot);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true, opacity: 0, depthWrite: false }));
      glow.scale.setScalar(0.4);
      body.add(glow);
      headGlows.push(glow);
      lightSprites.push(glow);
    }
    for (let i = 0; i < 2; i++) {
      const tail = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3324, transparent: true, opacity: 0, depthWrite: false }));
      tail.scale.setScalar(0.14);
      body.add(tail);
      tails.push(tail);
      lightSprites.push(tail);
    }
  }

  // rear axle in root-space, for where dust and rubber come off
  let rearOffsets: Array<{ x: number; z: number }> = [];

  /** hang the lights, exhaust and tyre marks off the current model's shape */
  function fit(): void {
    const m = model;
    const s = m.car.scale.x;
    contactShadow.scale.set(m.halfW * 2 + 0.5, 1, m.front - m.rear + 0.55);
    rearOffsets = m.wheels.filter((w) => !w.front).map((w) => ({ x: w.x * s, z: w.z * s }));
    if (rearOffsets.length === 0) rearOffsets.push({ x: -0.45, z: -0.95 }, { x: 0.45, z: -0.95 });
    const lx = m.halfW * 0.62;
    const lampY = Math.min(0.62, m.height * 0.38);
    [-lx, lx].forEach((x, i) => {
      headlights[i].position.set(x, Math.min(1.0, m.height * 0.6), m.front - 0.1);
      headlights[i].target.position.set(x * 0.6, -0.8, m.front + 7.2);
      headGlows[i].position.set(x, lampY, m.front + 0.05);
      tails[i].position.set(x, lampY, m.rear - 0.03);
      nitroFlames[i].position.set(x * 0.55, 0.35, m.rear - 0.12);
    });
  }
  fit();

  function repaint(paintIdx: number): void {
    const hex = spec.paints[paintIdx];
    if (!hex) return;
    for (const mat of model.paintMats) {
      mat.color.set(hex);
      const p = model.paint.find((q) => q.mat === mat);
      if (p) p.base.copy(mat.color);
    }
  }
  repaint(choice.paint);
  let lastNight = 0;

  // ---------- skid marks: one mesh, one draw call, quads built in world space ----------
  const markPos = new Float32Array(MARKS * 4 * 3);
  const markAlpha = new Float32Array(MARKS * 4);
  const markLife = new Float32Array(MARKS);
  const markBase = new Float32Array(MARKS);
  const markIdx = new Uint16Array(MARKS * 6);
  for (let i = 0; i < MARKS; i++) {
    const a = i * 4;
    markIdx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
  }
  const markGeo = new THREE.BufferGeometry();
  const markPosAttr = new THREE.BufferAttribute(markPos, 3);
  const markAlphaAttr = new THREE.BufferAttribute(markAlpha, 1);
  markPosAttr.setUsage(THREE.DynamicDrawUsage);
  markAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  markGeo.setAttribute('position', markPosAttr);
  markGeo.setAttribute('aAlpha', markAlphaAttr);
  markGeo.setIndex(new THREE.BufferAttribute(markIdx, 1));
  const markMesh = new THREE.Mesh(
    markGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.001) discard;
          gl_FragColor = vec4(0.10, 0.09, 0.08, vAlpha);
        }
      `,
    })
  );
  markMesh.frustumCulled = false; // quads move; the bounding sphere would be a lie
  markMesh.renderOrder = 1;
  scene.add(markMesh);
  let markCursor = 0;
  let sinceMark = 0;

  // ---------- dust: one Points cloud, per-particle size and fade ----------
  const dustPos = new Float32Array(DUST * 3);
  const dustVel = new Float32Array(DUST * 3);
  const dustAlpha = new Float32Array(DUST);
  const dustSize = new Float32Array(DUST);
  const dustGeo = new THREE.BufferGeometry();
  const dustPosAttr = new THREE.BufferAttribute(dustPos, 3);
  const dustAlphaAttr = new THREE.BufferAttribute(dustAlpha, 1);
  const dustSizeAttr = new THREE.BufferAttribute(dustSize, 1);
  for (const a of [dustPosAttr, dustAlphaAttr, dustSizeAttr]) a.setUsage(THREE.DynamicDrawUsage);
  dustGeo.setAttribute('position', dustPosAttr);
  dustGeo.setAttribute('aAlpha', dustAlphaAttr);
  dustGeo.setAttribute('aSize', dustSizeAttr);
  const dustTex = new THREE.CanvasTexture(softBlob(64, 'rgba(214,196,160,0.9)', 'rgba(214,196,160,0)'));
  const dustPoints = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: dustTex } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (320.0 / max(-mv.z, 0.1));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.001) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(tex.rgb, tex.a * vAlpha);
        }
      `,
    })
  );
  dustPoints.frustumCulled = false;
  scene.add(dustPoints);
  let dustCursor = 0;
  let sinceDust = 0;

  // ---------- state ----------
  let heading = Math.PI; // car noses toward the street (model faces +z)
  let speed = 0; // signed: + forward, − reverse
  let pitch = 0;
  let pitchVel = 0;
  let roll = 0;
  let rollVel = 0;
  let bob = 0;
  let bobVel = 0;
  let shake = 0;
  let lastImpactAt = -10;

  const choices = createLatestChoice();
  const api: Car = {
    root,
    speed,
    heading,
    shake,
    get spec() {
      return spec;
    },

    async choose(next: CarChoice): Promise<void> {
      const nextSpec = carById(next.car);
      const ticket = choices.begin();
      if (nextSpec.id === spec.id) {
        repaint(next.paint);
        return;
      }
      const gltf = await load(nextSpec.model);
      if (!choices.isLatest(ticket)) return;
      const nextModel = rig(THREE, nextSpec, gltf, env);
      const previous = model;
      body.remove(previous.car);
      for (const material of previous.materials) material.dispose();
      spec = nextSpec;
      h = spec.handling;
      model = nextModel;
      body.add(model.car);
      fit();
      repaint(next.paint);
      api.applyNight(lastNight);
    },

    teleport(x: number, z: number, h: number): void {
      root.position.set(x, 0, z);
      heading = h;
      speed = 0;
    },

    applyNight(nightFactor: number): void {
      lastNight = nightFactor;
      const on = nightFactor > 0.25;
      // a touch of its own colour back into the paint, so the car stays legible
      // against a dark road without looking lit from nowhere
      for (const p of model.paint) p.mat.emissive.copy(p.base).multiplyScalar(0.18 * nightFactor);
      for (const lamp of model.headlights) lamp.emissiveIntensity = 0.35 + nightFactor * 2.2;
      for (const lamp of model.brakeLights) lamp.emissiveIntensity = 0.35 + nightFactor * 1.2;
      for (const h of headlights) h.intensity = nightFactor * 120;
      lightSprites.forEach((sp, i) => {
        sp.material.opacity = on ? (i < 2 ? 0.85 : 0.7) * nightFactor : 0;
      });
    },

    update(dt: number, t: number, input: InputState, ctx: CarCtx, audio: AudioBus): void {
      const throttle = -input.iz; // up = forward
      const steer = -input.ix; // right key steers right (heading decreases visually)
      const nitro = input.nitro && throttle > 0.05;
      const prevSpeed = speed;
      const braking = (throttle < -0.05 && speed > 0.2) || (throttle > 0.05 && speed < -0.2);
      for (const lamp of model.brakeLights) lamp.emissiveIntensity = braking ? 3.2 : 0.35 + lastNight * 1.2;
      const redOn = ctx.reducedMotion || Math.sin(t * 5) > 0;
      for (const lamp of model.policeRed) lamp.emissiveIntensity = redOn ? 2.4 : 0.25;
      for (const lamp of model.policeBlue) lamp.emissiveIntensity = redOn ? 0.25 : 2.4;

      const topSpeed = nitro ? h.nitroMax : h.maxSpeed;
      if (speed > topSpeed + 0.01) {
        // over the current cap (boost just released) — bleed off smoothly
        speed = Math.max(topSpeed, speed - 14 * dt);
      } else if (throttle > 0.05) {
        speed = Math.min(topSpeed, speed + (nitro ? h.nitroAccel : h.accel) * throttle * dt);
      } else if (throttle < -0.05) {
        speed += (speed > 0 ? -h.brake : h.accel * throttle) * dt;
      } else {
        speed -= Math.sign(speed) * Math.min(Math.abs(speed), h.drag * dt);
      }
      speed = Math.max(-MAX_REVERSE, speed);

      // steering authority grows with speed, flips in reverse
      const steerAuthority = Math.max(-1, Math.min(1, speed / 4));
      const yawRate = steer * h.steer * steerAuthority;
      heading += yawRate * dt;

      const fwdX = Math.sin(heading);
      const fwdZ = Math.cos(heading);
      root.rotation.y = heading;
      root.position.x += fwdX * speed * dt;
      root.position.z += fwdZ * speed * dt;

      root.position.x = Math.max(ctx.bounds.minX, Math.min(ctx.bounds.maxX, root.position.x));
      root.position.z = Math.max(ctx.bounds.minZ, Math.min(ctx.bounds.maxZ, root.position.z));

      // ---------- solid world ----------
      const impact = ctx.resolve(root.position, 1.05);
      if (impact.depth > 0.015) {
        const pushLen = Math.hypot(impact.x, impact.z) || 1;
        // how head-on the hit was: a graze barely costs anything, a wall stops you
        const alignment = Math.max(0, -((impact.x / pushLen) * fwdX + (impact.z / pushLen) * fwdZ) * Math.sign(speed || 1));
        const force = Math.min(1, (Math.abs(speed) / h.maxSpeed) * alignment);
        if (force > 0.06 && t - lastImpactAt > 0.18) {
          lastImpactAt = t;
          audio.thud(force);
          shake = Math.min(1, shake + force * h.knock);
          bobVel -= force * 3.2 * h.knock;
          pitchVel += force * 2.4 * h.knock * Math.sign(speed || 1);
        }
        speed *= 1 - 0.85 * alignment;
      }

      // ---------- wheels ----------
      const roll_ = (speed * dt) / model.wheelRadius;
      for (const w of model.wheels) {
        w.roll.rotation.x += roll_;
        if (w.front) w.pivot.rotation.y = steer * 0.45 * Math.max(0, steerAuthority);
      }

      // ---------- suspension ----------
      const accelLong = (speed - prevSpeed) / Math.max(dt, 1e-4);
      // braking pitches the nose down (+x rotation), accelerating squats the rear
      const targetPitch = Math.max(-0.10, Math.min(0.10, -accelLong * 0.010));
      // turning right leans the body left, and vice versa
      const targetRoll = Math.max(-0.13, Math.min(0.13, yawRate * speed * 0.010));
      pitchVel += ((targetPitch - pitch) * h.bodyK - pitchVel * h.bodyC) * dt;
      pitch += pitchVel * dt;
      rollVel += ((targetRoll - roll) * h.bodyK - rollVel * h.bodyC) * dt;
      roll += rollVel * dt;
      bobVel += ((0 - bob) * h.bodyK - bobVel * h.bodyC) * dt;
      bob += bobVel * dt;

      // rough ground shakes the whole car a little
      const offRoad = ctx.offRoad(root.position.x, root.position.z);
      if (offRoad && Math.abs(speed) > 1) {
        const rumble = Math.min(1, Math.abs(speed) / h.maxSpeed) * 0.012;
        pitch += Math.sin(t * 37) * rumble;
        roll += Math.sin(t * 29 + 1.7) * rumble;
      }

      body.rotation.x = pitch;
      body.rotation.z = roll;
      body.position.y = bob;
      // keep the contact patches on the ground while the body leans over them
      for (const p of model.wheels) p.pivot.position.y = p.baseY + pitch * p.z - roll * p.x;

      shake = Math.max(0, shake - dt * 2.4);
      api.shake = shake;

      // ---------- slip: how hard the tyres are complaining ----------
      const latA = Math.abs(yawRate * speed);
      let slip = Math.max(0, latA - h.grip) / h.grip;
      if (throttle < -0.3 && speed > 4) slip = Math.max(slip, (speed - 4) / h.maxSpeed);
      if (nitro && speed < 5 && throttle > 0.5) slip = Math.max(slip, 0.55);
      slip = Math.min(1, slip);
      audio.skid(offRoad ? slip * 0.5 : slip);

      const travelled = Math.abs(speed) * dt;
      const rightX = fwdZ;
      const rightZ = -fwdX;

      // ---------- lay rubber ----------
      sinceMark += travelled;
      if (slip > 0.12 && Math.abs(speed) > 1.5 && sinceMark > 0.35 && !offRoad) {
        sinceMark = 0;
        for (const off of rearOffsets) {
          const wx = root.position.x + rightX * off.x + fwdX * off.z;
          const wz = root.position.z + rightZ * off.x + fwdZ * off.z;
          const i = markCursor;
          markCursor = (markCursor + 1) % MARKS;
          markLife[i] = MARK_LIFE;
          const a = i * 4 * 3;
          const corner = (sx: number, sz: number, o: number) => {
            markPos[a + o] = wx + rightX * MARK_HALF_W * sx + fwdX * MARK_HALF_L * sz;
            markPos[a + o + 1] = 0.07; // clear of the road, plaza and light pools
            markPos[a + o + 2] = wz + rightZ * MARK_HALF_W * sx + fwdZ * MARK_HALF_L * sz;
          };
          corner(-1, -1, 0);
          corner(1, -1, 3);
          corner(-1, 1, 6);
          corner(1, 1, 9);
          markBase[i] = 0.3 + slip * 0.4;
          for (let v = 0; v < 4; v++) markAlpha[i * 4 + v] = markBase[i];
        }
        markPosAttr.needsUpdate = true;
      }
      // marks hold, then fade over the last third of their life — recomputed
      // from remaining life each frame, so the rate can't drift with framerate
      for (let i = 0; i < MARKS; i++) {
        if (markLife[i] <= 0) continue;
        markLife[i] = Math.max(0, markLife[i] - dt);
        const k = markLife[i] / MARK_LIFE;
        const a = k <= 0 ? 0 : markBase[i] * Math.min(1, k / 0.35);
        for (let v = 0; v < 4; v++) markAlpha[i * 4 + v] = a;
      }
      markAlphaAttr.needsUpdate = true;

      // ---------- kick up dust ----------
      sinceDust += travelled;
      const dusty = (offRoad && Math.abs(speed) > 2) || slip > 0.3;
      if (dusty && sinceDust > 0.32) {
        sinceDust = 0;
        for (const off of rearOffsets) {
          const i = dustCursor;
          dustCursor = (dustCursor + 1) % DUST;
          dustPos[i * 3] = root.position.x + rightX * off.x + fwdX * off.z;
          dustPos[i * 3 + 1] = 0.22;
          dustPos[i * 3 + 2] = root.position.z + rightZ * off.x + fwdZ * off.z;
          dustVel[i * 3] = -fwdX * 0.9 + (Math.random() - 0.5) * 1.1;
          dustVel[i * 3 + 1] = 0.7 + Math.random() * 0.7;
          dustVel[i * 3 + 2] = -fwdZ * 0.9 + (Math.random() - 0.5) * 1.1;
          dustAlpha[i] = offRoad ? 0.65 : 0.36;
          dustSize[i] = 0.75 + Math.random() * 0.5;
        }
      }
      for (let i = 0; i < DUST; i++) {
        if (dustAlpha[i] <= 0) continue;
        dustPos[i * 3] += dustVel[i * 3] * dt;
        dustPos[i * 3 + 1] += dustVel[i * 3 + 1] * dt;
        dustPos[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
        dustVel[i * 3] *= 1 - 1.6 * dt;
        dustVel[i * 3 + 1] *= 1 - 0.9 * dt;
        dustVel[i * 3 + 2] *= 1 - 1.6 * dt;
        dustSize[i] += dt * 1.5; // a plume spreads as it rises
        dustAlpha[i] = Math.max(0, dustAlpha[i] - dt * 0.36);
      }
      dustPosAttr.needsUpdate = true;
      dustAlphaAttr.needsUpdate = true;
      dustSizeAttr.needsUpdate = true;

      // ---------- nitro juice ----------
      for (const flame of nitroFlames) {
        const m = flame.material;
        const targetO = nitro ? 0.85 + Math.sin(t * 47 + flame.position.x * 9) * 0.15 : 0;
        m.opacity += (targetO - m.opacity) * Math.min(1, dt * 14);
        flame.scale.setScalar(0.4 + (nitro ? 0.25 + Math.sin(t * 39 + flame.position.x * 7) * 0.1 : 0));
      }

      api.speed = speed;
      api.heading = heading;
    },
  };

  return api;
}
