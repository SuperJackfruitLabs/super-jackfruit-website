// The car, and everything that makes it feel like it has mass.
//
// "Low poly Japan Offroad Car" by Han66st (sketchfab, CC-BY-4.0). The file is
// a three-paint showroom of complete cars stacked at the origin, plus a baked
// ground decal per car — pick one body, leave the rest behind.
//
// Rig, outermost first:
//   root  — world position + heading yaw
//   body  — suspension: pitch, roll, and vertical travel
//   car   — the scaled model; wheels hang off its `variant` child
// Lights and exhaust ride on `body`, so braking really does throw the
// headlights down at the road.
import type * as T from 'three';
import type { Three } from './types';
import type { Impact, LoadedGltf } from './props';
import type { InputState } from './input';
import type { AudioBus } from './audio';

const MAX_SPEED = 11;
const NITRO_MAX = 18;
const MAX_REVERSE = 4;
const ACCEL = 9;
const NITRO_ACCEL = 17;
const BRAKE = 16;
const DRAG = 3.2;
const STEER_RATE = 1.9;

// Lateral acceleration the tyres hold before they start scrubbing, m/s². The
// arcade steering is tight enough that a full-lock corner at top speed pulls
// ~21 — set this so ordinary cornering stays quiet and only really leaning on
// it lays rubber.
const GRIP = 15;
/** suspension spring and damping — under-damped on purpose, so it settles with a bounce */
const BODY_K = 90;
const BODY_C = 13;

const MARKS = 160;
const MARK_LIFE = 9;
const MARK_HALF_W = 0.14;
const MARK_HALF_L = 0.26;
const DUST = 90;

export interface CarCtx {
  /** pushes the car out of anything solid; mutates the position */
  resolve(pos: T.Vector3, radius: number): Impact;
  offRoad(x: number, z: number): boolean;
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

export async function createCar(
  THREE: Three,
  load: (name: string) => Promise<LoadedGltf>,
  scene: T.Scene
): Promise<Car> {
  const gltf = await load('offroad-car');
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  let variant: T.Object3D | undefined;
  gltf.scene.traverse((o: T.Object3D) => {
    if (!variant && norm(o.name) === 'cube5') variant = o; // the olive-green paint
  });
  if (!variant) throw new Error('offroad-car: paint variant not found');
  variant.position.x = 0;
  variant.position.z = 0;

  const car = new THREE.Group();
  car.add(variant);
  car.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as T.MeshStandardMaterial;
      if ('metalness' in std) {
        std.metalness = 0;
        std.roughness = Math.max(0.85, std.roughness ?? 1);
      }
    }
  });

  // Wheels are the low cylinder groups; the spare on the tailgate rides high
  // and stays fixed. The nodes carry baked rotations, so steering yaw and axle
  // roll each get their own clean pivot instead of touching the node's Euler.
  const rollGroups: T.Object3D[] = [];
  const pivots: Array<{ pivot: T.Object3D; baseY: number; x: number; z: number }> = [];
  const frontPivots: T.Object3D[] = [];
  for (const child of [...variant.children]) {
    if (!/^Cylinder/.test(child.name) || child.position.y > -0.5) continue;
    const pivot = new THREE.Group();
    pivot.position.copy(child.position);
    const rollG = new THREE.Group();
    pivot.add(rollG);
    child.position.set(0, 0, 0);
    rollG.add(child);
    variant.add(pivot);
    rollGroups.push(rollG);
    pivots.push({ pivot, baseY: pivot.position.y, x: pivot.position.x, z: pivot.position.z });
    if (pivot.position.z > 0) frontPivots.push(pivot); // nose is +z
  }

  let carScale = 1;
  {
    const box = new THREE.Box3().setFromObject(car);
    const len = box.getSize(new THREE.Vector3()).z || 1;
    carScale = 2.9 / len; // a friendly toy-car length
    car.scale.setScalar(carScale);
    car.position.y = -box.min.y * carScale;
  }

  // rear axle in root-space, for where dust and rubber come off
  const rearOffsets = pivots
    .filter((p) => p.z <= 0)
    .map((p) => ({ x: p.x * carScale, z: p.z * carScale }));
  if (rearOffsets.length === 0) rearOffsets.push({ x: -0.45, z: -0.95 }, { x: 0.45, z: -0.95 });

  const body = new THREE.Group();
  body.add(car);
  const root = new THREE.Group();
  root.add(body);
  root.position.set(0, 0, 8);
  scene.add(root);

  // ---------- nitro exhaust ----------
  const flameTex = new THREE.CanvasTexture(
    softBlob(64, 'rgba(255,220,150,1)', 'rgba(255,80,30,0)')
  );
  flameTex.colorSpace = THREE.SRGBColorSpace;
  const nitroFlames: T.Sprite[] = [];
  for (const fx of [-0.32, 0.32]) {
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flameTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flame.position.set(fx, 0.35, -1.55);
    flame.scale.setScalar(0.5);
    body.add(flame);
    nitroFlames.push(flame);
  }

  // ---------- head- and taillights ----------
  const headlights: T.SpotLight[] = [];
  const lightSprites: T.Sprite[] = [];
  {
    const headTex = new THREE.CanvasTexture(softBlob(64, 'rgba(255,246,214,1)', 'rgba(255,246,214,0)'));
    for (const hx of [-0.42, 0.42]) {
      const spot = new THREE.SpotLight(0xfff2cc, 0, 24, 0.52, 0.4, 1.0);
      spot.position.set(hx, 1.0, 1.35);
      const tgt = new THREE.Object3D();
      tgt.position.set(hx * 0.6, -0.8, 8.5);
      body.add(tgt);
      spot.target = tgt;
      body.add(spot);
      headlights.push(spot);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true, opacity: 0, depthWrite: false }));
      glow.scale.setScalar(0.4);
      glow.position.set(hx, 0.55, 1.5);
      body.add(glow);
      lightSprites.push(glow);
    }
    for (const hx of [-0.42, 0.42]) {
      const tail = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3324, transparent: true, opacity: 0, depthWrite: false }));
      tail.scale.setScalar(0.14);
      tail.position.set(hx, 0.55, -1.42);
      body.add(tail);
      lightSprites.push(tail);
    }
  }

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

  const api: Car = {
    root,
    speed,
    heading,
    shake,

    teleport(x: number, z: number, h: number): void {
      root.position.set(x, 0, z);
      heading = h;
      speed = 0;
    },

    applyNight(nightFactor: number): void {
      const on = nightFactor > 0.25;
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

      const topSpeed = nitro ? NITRO_MAX : MAX_SPEED;
      if (speed > topSpeed + 0.01) {
        // over the current cap (boost just released) — bleed off smoothly
        speed = Math.max(topSpeed, speed - 14 * dt);
      } else if (throttle > 0.05) {
        speed = Math.min(topSpeed, speed + (nitro ? NITRO_ACCEL : ACCEL) * throttle * dt);
      } else if (throttle < -0.05) {
        speed += (speed > 0 ? -BRAKE : ACCEL * throttle) * dt;
      } else {
        speed -= Math.sign(speed) * Math.min(Math.abs(speed), DRAG * dt);
      }
      speed = Math.max(-MAX_REVERSE, speed);

      // steering authority grows with speed, flips in reverse
      const steerAuthority = Math.max(-1, Math.min(1, speed / 4));
      const yawRate = steer * STEER_RATE * steerAuthority;
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
        const force = Math.min(1, (Math.abs(speed) / MAX_SPEED) * alignment);
        if (force > 0.06 && t - lastImpactAt > 0.18) {
          lastImpactAt = t;
          audio.thud(force);
          shake = Math.min(1, shake + force);
          bobVel -= force * 3.2;
          pitchVel += force * 2.4 * Math.sign(speed || 1);
        }
        speed *= 1 - 0.85 * alignment;
      }

      // ---------- wheels ----------
      const roll_ = (speed * dt) / 0.3; // offroad wheel radius after scaling
      for (const w of rollGroups) w.rotation.x += roll_;
      for (const pv of frontPivots) pv.rotation.y = steer * 0.45 * Math.max(0, steerAuthority);

      // ---------- suspension ----------
      const accelLong = (speed - prevSpeed) / Math.max(dt, 1e-4);
      // braking pitches the nose down (+x rotation), accelerating squats the rear
      const targetPitch = Math.max(-0.10, Math.min(0.10, -accelLong * 0.010));
      // turning right leans the body left, and vice versa
      const targetRoll = Math.max(-0.13, Math.min(0.13, yawRate * speed * 0.010));
      pitchVel += ((targetPitch - pitch) * BODY_K - pitchVel * BODY_C) * dt;
      pitch += pitchVel * dt;
      rollVel += ((targetRoll - roll) * BODY_K - rollVel * BODY_C) * dt;
      roll += rollVel * dt;
      bobVel += ((0 - bob) * BODY_K - bobVel * BODY_C) * dt;
      bob += bobVel * dt;

      // rough ground shakes the whole car a little
      const offRoad = ctx.offRoad(root.position.x, root.position.z);
      if (offRoad && Math.abs(speed) > 1) {
        const rumble = Math.min(1, Math.abs(speed) / MAX_SPEED) * 0.012;
        pitch += Math.sin(t * 37) * rumble;
        roll += Math.sin(t * 29 + 1.7) * rumble;
      }

      body.rotation.x = pitch;
      body.rotation.z = roll;
      body.position.y = bob;
      // keep the contact patches on the ground while the body leans over them
      for (const p of pivots) p.pivot.position.y = p.baseY + pitch * p.z - roll * p.x;

      shake = Math.max(0, shake - dt * 2.4);
      api.shake = shake;

      // ---------- slip: how hard the tyres are complaining ----------
      const latA = Math.abs(yawRate * speed);
      let slip = Math.max(0, latA - GRIP) / GRIP;
      if (throttle < -0.3 && speed > 4) slip = Math.max(slip, (speed - 4) / MAX_SPEED);
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
