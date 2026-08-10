// Signs of life that aren't people: smoke from the chimneys and birds working
// the thermals. Both are single draw calls — a Points cloud each — because the
// village has a frame budget and this is background texture, not the subject.
import type * as T from 'three';
import type { Three } from './types';

// Enough puffs, big enough, rising slowly enough that they overlap into a
// plume — spread them thinner and it reads as a dotted line, not smoke.
const SMOKE_PER_CHIMNEY = 22;
const SMOKE_RISE = 0.85;
const SMOKE_LIFE = 6.5;
const BIRD_SPEED = 0.22;

export interface Chimney {
  x: number;
  y: number;
  z: number;
}

export interface Ambient {
  update(dt: number, t: number, nightFactor: number): void;
  /** for the debug hook: is anything actually being drawn up there */
  debug(): { smoke: number; birds: number; peakSmokeAlpha: number; smokeTopY: number; birdY: number };
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

export function createAmbient(
  THREE: Three,
  scene: T.Scene,
  chimneys: Chimney[],
  birdCount: number,
  rand: () => number
): Ambient {
  // ---------- chimney smoke ----------
  const smokeCount = chimneys.length * SMOKE_PER_CHIMNEY;
  const smokePos = new Float32Array(Math.max(1, smokeCount) * 3);
  const smokeAge = new Float32Array(Math.max(1, smokeCount));
  const smokeDrift = new Float32Array(Math.max(1, smokeCount) * 2);
  const smokeAlpha = new Float32Array(Math.max(1, smokeCount));
  const smokeSize = new Float32Array(Math.max(1, smokeCount));

  for (let i = 0; i < smokeCount; i++) {
    const home = chimneys[Math.floor(i / SMOKE_PER_CHIMNEY)];
    // spread the puffs through the life cycle so no chimney puffs in bursts
    smokeAge[i] = (i % SMOKE_PER_CHIMNEY) * (SMOKE_LIFE / SMOKE_PER_CHIMNEY) + rand() * 0.2;
    smokeDrift[i * 2] = 0.22 + rand() * 0.2;
    smokeDrift[i * 2 + 1] = (rand() - 0.5) * 0.16;
    smokePos[i * 3] = home.x;
    smokePos[i * 3 + 1] = home.y;
    smokePos[i * 3 + 2] = home.z;
  }

  const smokeGeo = new THREE.BufferGeometry();
  const smokePosAttr = new THREE.BufferAttribute(smokePos, 3);
  const smokeAlphaAttr = new THREE.BufferAttribute(smokeAlpha, 1);
  const smokeSizeAttr = new THREE.BufferAttribute(smokeSize, 1);
  for (const a of [smokePosAttr, smokeAlphaAttr, smokeSizeAttr]) a.setUsage(THREE.DynamicDrawUsage);
  smokeGeo.setAttribute('position', smokePosAttr);
  smokeGeo.setAttribute('aAlpha', smokeAlphaAttr);
  smokeGeo.setAttribute('aSize', smokeSizeAttr);

  const puffVert = /* glsl */ `
    attribute float aAlpha;
    attribute float aSize;
    varying float vAlpha;
    void main() {
      vAlpha = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (320.0 / max(-mv.z, 0.1));
      gl_Position = projectionMatrix * mv;
    }
  `;
  const puffFrag = /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uTint;
    varying float vAlpha;
    void main() {
      if (vAlpha <= 0.001) discard;
      vec4 tex = texture2D(uMap, gl_PointCoord);
      gl_FragColor = vec4(uTint * tex.rgb, tex.a * vAlpha);
    }
  `;

  const smokeTint = { value: new THREE.Color(0.68, 0.68, 0.71) };
  const smokePoints = new THREE.Points(
    smokeGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: new THREE.CanvasTexture(softBlob(64, 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)')) },
        uTint: smokeTint,
      },
      vertexShader: puffVert,
      fragmentShader: puffFrag,
    })
  );
  smokePoints.frustumCulled = false;
  if (smokeCount > 0) scene.add(smokePoints);

  // ---------- birds ----------
  // lazy circles at different heights and radii; they read as birds because
  // they drift, not because you can count the feathers
  const birds = Math.max(0, birdCount);
  const birdPos = new Float32Array(Math.max(1, birds) * 3);
  const birdAlpha = new Float32Array(Math.max(1, birds));
  const birdSize = new Float32Array(Math.max(1, birds));
  const orbits: Array<{ cx: number; cz: number; r: number; y: number; phase: number; rate: number }> = [];
  for (let i = 0; i < birds; i++) {
    orbits.push({
      cx: (rand() - 0.5) * 180,
      cz: -40 - rand() * 200,
      r: 18 + rand() * 30,
      y: 26 + rand() * 16,
      phase: rand() * 6.28,
      rate: BIRD_SPEED * (0.7 + rand() * 0.7) * (rand() < 0.5 ? 1 : -1),
    });
    birdAlpha[i] = 0.75;
    birdSize[i] = 1.3 + rand() * 0.5;
  }
  const birdGeo = new THREE.BufferGeometry();
  const birdPosAttr = new THREE.BufferAttribute(birdPos, 3);
  birdPosAttr.setUsage(THREE.DynamicDrawUsage);
  const birdAlphaAttr = new THREE.BufferAttribute(birdAlpha, 1);
  birdAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  birdGeo.setAttribute('position', birdPosAttr);
  birdGeo.setAttribute('aAlpha', birdAlphaAttr);
  birdGeo.setAttribute('aSize', new THREE.BufferAttribute(birdSize, 1));

  const birdTint = { value: new THREE.Color(0.16, 0.17, 0.2) };
  const birdPoints = new THREE.Points(
    birdGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: new THREE.CanvasTexture(softBlob(32, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)')) },
        uTint: birdTint,
      },
      vertexShader: puffVert,
      fragmentShader: puffFrag,
    })
  );
  birdPoints.frustumCulled = false;
  if (birds > 0) scene.add(birdPoints);

  return {
    debug: () => ({
      smoke: smokeCount,
      birds,
      peakSmokeAlpha: +Math.max(0, ...Array.from(smokeAlpha)).toFixed(3),
      smokeTopY: +Math.max(0, ...Array.from({ length: smokeCount }, (_, i) => smokePos[i * 3 + 1])).toFixed(2),
      birdY: birds > 0 ? +birdPos[1].toFixed(2) : -1,
    }),

    update(dt, t, nightFactor): void {
      if (smokeCount > 0) {
        for (let i = 0; i < smokeCount; i++) {
          const home = chimneys[Math.floor(i / SMOKE_PER_CHIMNEY)];
          smokeAge[i] += dt;
          if (smokeAge[i] > SMOKE_LIFE) {
            smokeAge[i] -= SMOKE_LIFE;
            smokePos[i * 3] = home.x;
            smokePos[i * 3 + 1] = home.y;
            smokePos[i * 3 + 2] = home.z;
          }
          const k = smokeAge[i] / SMOKE_LIFE;
          smokePos[i * 3] += smokeDrift[i * 2] * dt;
          smokePos[i * 3 + 1] += SMOKE_RISE * dt;
          smokePos[i * 3 + 2] += smokeDrift[i * 2 + 1] * dt;
          // fades in off the chimney pot, thins out as it spreads
          smokeAlpha[i] = Math.min(k * 6, 1) * (1 - k) * 0.75;
          smokeSize[i] = 1.6 + k * 5.0;
        }
        smokePosAttr.needsUpdate = true;
        smokeAlphaAttr.needsUpdate = true;
        smokeSizeAttr.needsUpdate = true;
        // white smoke vanishes against a pale sky, so keep it grey enough to
        // read by day and let it darken further after dark
        const warm = 0.68 - nightFactor * 0.4;
        smokeTint.value.setRGB(warm, warm * 0.97, warm * 0.98);
      }

      if (birds > 0) {
        for (let i = 0; i < birds; i++) {
          const o = orbits[i];
          const a = o.phase + t * o.rate;
          birdPos[i * 3] = o.cx + Math.cos(a) * o.r;
          birdPos[i * 3 + 1] = o.y + Math.sin(t * 0.6 + o.phase) * 1.6;
          birdPos[i * 3 + 2] = o.cz + Math.sin(a) * o.r;
          // they turn in for the night
          birdAlpha[i] = 0.55 * (1 - nightFactor);
        }
        birdPosAttr.needsUpdate = true;
        birdAlphaAttr.needsUpdate = true;
      }
    },
  };
}
