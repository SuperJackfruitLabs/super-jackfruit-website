/**
 * The home page's street: a small island village, one house per product, that the camera walks
 * down as the page scrolls. Scroll position is the only clock for the camera and the time of day,
 * so scrolling back plays everything in reverse. Ambient life (cars, villagers, the water) runs on
 * its own time but never moves the camera.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HOUSE_MODELS, modelUrl } from '../data/village-models';

export interface StreetProduct {
  slug: string;
  hex: string;
}

export interface Street {
  /** f runs 0 (hero) → 1..n (each product) → n+1 (finale) */
  setProgress(f: number): void;
  dispose(): void;
}

const TREES = ['forest-oak-a', 'forest-oak-b', 'forest-oak-c', 'forest-oak-a-fall', 'forest-oak-b-fall', 'forest-spruce-a', 'forest-spruce-b', 'forest-spruce-c'];
const ROCKS = ['forest-rock-big-a', 'forest-rock-big-b', 'forest-rock-a', 'forest-rock-b'];
const SMALL = ['plant_bush', 'plant_bushLarge', 'flower_purpleA', 'flower_redA', 'flower_yellowA', 'planter'];
const NPCS = ['npc-a', 'npc-b', 'npc-e', 'npc-k'];
const CARS = ['car-taxi', 'car-van'];

/** small seeded random, so the island is the same island on every visit */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** scale a model so its largest horizontal side is `size` (or its height, if `byHeight`), feet on y=0 */
function fit(obj: THREE.Object3D, size: number, byHeight = false) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const k = size / (byHeight ? s.y : Math.max(s.x, s.z));
  obj.scale.setScalar(k);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  obj.position.set(-c.x, -b2.min.y, -c.z);
  wrap.add(obj);
  return wrap;
}

/**
 * Two moods, chosen by the page theme: a golden-hour evening for light, the lit-up night for dark.
 * Each is a pair of looks, one for the top of the page and one for the end of the street,
 * and the scene blends between them by scroll progress and between moods by the theme.
 */
interface Look {
  top: string; mid: string; horizon: string; sea: string;
  sun: string; sunI: number; sunY: number;
  hemi: string; ground: string; hemiI: number;
  glow: number; bulb: number; sign: number; stars: number; exposure: number;
}
const EVENING: [Look, Look] = [
  { sea: '#4f63a8', top: '#3a5bb0', mid: '#d58bb5', horizon: '#ffb36b', sun: '#ffa463', sunI: 2.6, sunY: 22, hemi: '#ffd2b0', ground: '#5a5040', hemiI: 1.15, glow: 5, bulb: 1.5, sign: 0.25, stars: 0, exposure: 1.0 },
  { sea: '#3d4a8c', top: '#2a3a88', mid: '#c86a98', horizon: '#ff8a55', sun: '#ff7a48', sunI: 1.9, sunY: 11, hemi: '#f0b0b0', ground: '#45403a', hemiI: 0.95, glow: 14, bulb: 3, sign: 0.45, stars: 0.15, exposure: 1.05 },
];
const NIGHT: [Look, Look] = [
  { sea: '#18224f', top: '#0d1433', mid: '#1f2a5c', horizon: '#3a3f7a', sun: '#a9b8ff', sunI: 0.9, sunY: 55, hemi: '#7f8fd6', ground: '#1d2a22', hemiI: 0.95, glow: 30, bulb: 5, sign: 0.75, stars: 0.6, exposure: 1.25 },
  { sea: '#0c1230', top: '#05081a', mid: '#121a3d', horizon: '#252a5a', sun: '#a9b8ff', sunI: 0.55, sunY: 55, hemi: '#6a78c0', ground: '#152019', hemiI: 0.6, glow: 30, bulb: 5, sign: 0.75, stars: 1, exposure: 1.25 },
];
const c1 = new THREE.Color();
const c2 = new THREE.Color();
/** blend one colour field across scroll (p) and mood (m: 0 evening, 1 night) */
function mixColor(key: 'sea' | 'top' | 'mid' | 'horizon' | 'sun' | 'hemi' | 'ground', p: number, m: number, out: THREE.Color) {
  c1.set(EVENING[0][key]).lerp(c2.set(EVENING[1][key]), p);
  out.set(NIGHT[0][key]).lerp(c2.set(NIGHT[1][key]), p);
  return out.lerp(c1, 1 - m);
}
type NumKey = 'sunI' | 'sunY' | 'hemiI' | 'glow' | 'bulb' | 'sign' | 'stars' | 'exposure';
function mixNum(key: NumKey, p: number, m: number) {
  const e = THREE.MathUtils.lerp(EVENING[0][key], EVENING[1][key], p);
  const n = THREE.MathUtils.lerp(NIGHT[0][key], NIGHT[1][key], p);
  return THREE.MathUtils.lerp(e, n, m);
}

async function logoTexture(slug: string, hex: string): Promise<THREE.CanvasTexture> {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = hex;
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fffaf2';
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  try {
    const img = new Image();
    img.src = `/brand/${slug}.svg`;
    await img.decode();
    g.drawImage(img, 48, 48, 160, 160);
  } catch {
    /* the ring alone still names the colour */
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export async function createStreet(canvas: HTMLCanvasElement, products: StreetProduct[], onReady: () => void): Promise<Street> {
  const wide = () => window.innerWidth >= 900;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, wide() ? 1.75 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = wide();
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  // THREE.Fog copies the colour it is given, so keep a handle on the fog's own colour
  const fog = new THREE.Fog('#ffb36b', 90, 260);
  scene.fog = fog;
  const fogColor = fog.color;

  // a painted sky dome: horizon, a middle band and the top, plus a soft sun glow
  const skyU = {
    top: { value: new THREE.Color() },
    mid: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
    sunColor: { value: new THREE.Color() },
    sunGlow: { value: 1 },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(360, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunGlow;
        varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          c = mix(c, top, smoothstep(0.18, 0.75, h));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 1.2) * sunGlow;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  skyDome.renderOrder = -1;
  scene.add(skyDome);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);

  // light
  const hemi = new THREE.HemisphereLight('#fff6e8', '#5a7d4a', 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 200 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // stars and a moon
  const starGeo = new THREE.BufferGeometry();
  {
    const r = rng(9);
    const pts: number[] = [];
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2;
      const e = 0.08 + r() * 1.3; // elevation, kept above the horizon
      const d = 300;
      pts.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, fog: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false, transparent: true }));
  moon.position.set(-90, 95, -220);
  scene.add(moon);

  // island, beach and sea
  const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, ...extra });
  // the sea is unlit and takes its colour from the sky, so it reads as reflection, never as a dark band
  const seaMat = new THREE.MeshBasicMaterial({ color: '#4f63a8' });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(2500, 64), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.9;
  scene.add(sea);
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(51, 54, 1.4, 40), flat('#f1d59b'));
  beach.position.y = -0.75;
  beach.receiveShadow = true;
  scene.add(beach);
  const island = new THREE.Mesh(new THREE.CylinderGeometry(47, 49, 1.2, 40), flat('#8ccd62'));
  island.position.y = -0.6;
  island.receiveShadow = true;
  scene.add(island);

  // the street
  const road = new THREE.Mesh(new THREE.BoxGeometry(76, 0.1, 6), flat('#4b505c'));
  road.position.y = 0.02;
  road.receiveShadow = true;
  scene.add(road);
  for (const z of [-3.9, 3.9]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(76, 0.22, 1.8), flat('#e3dccb'));
    walk.position.set(0, 0.08, z);
    walk.receiveShadow = true;
    scene.add(walk);
  }
  const dashGeo = new THREE.BoxGeometry(1.6, 0.02, 0.18);
  const dashMat = flat('#fff6d8');
  for (let x = -36; x <= 36; x += 3.4) {
    const d = new THREE.Mesh(dashGeo, dashMat);
    d.position.set(x, 0.08, 0);
    scene.add(d);
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map<string, Promise<THREE.Group>>();
  const load = (name: string) => {
    if (!cache.has(name)) cache.set(name, loader.loadAsync(modelUrl(name)).then((g) => g.scene));
    return cache.get(name)!.then((s) => {
      const c = s.clone(true);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return c;
    });
  };

  // one house per product along the north side, in the order a task travels, so the camera
  // can track down the street in one direction instead of crossing it
  // spread over the 76-unit road whatever the count: 12 apart for six, closer for more
  const gapX = Math.min(12, 70 / Math.max(1, products.length - 1));
  const houses = products.map((p, i) => ({ ...p, x: -((products.length - 1) * gapX) / 2 + i * gapX, z: -10 }));
  const signMats: THREE.MeshStandardMaterial[] = [];
  const glows: THREE.PointLight[] = [];
  const bulbs: THREE.MeshStandardMaterial[] = [];

  const jobs: Promise<unknown>[] = [];
  houses.forEach((h, i) => {
    const facing = h.z < 0 ? 0 : Math.PI; // fronts face +z, so the south side turns round
    const toStreet = h.z < 0 ? 1 : -1;
    jobs.push(
      load(HOUSE_MODELS[(i * 3) % HOUSE_MODELS.length]).then((m) => {
        const house = fit(m, 7);
        house.position.set(h.x, 0, h.z);
        house.rotation.y = facing;
        scene.add(house);
      }),
    );
    // drive
    const drive = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 3.2), flat('#cfc4ae'));
    drive.position.set(h.x, 0.04, h.z + toStreet * 4.6);
    drive.receiveShadow = true;
    scene.add(drive);
    // the round hanging sign beside the drive, in the product's colour
    jobs.push(
      logoTexture(h.slug, h.hex).then((tex) => {
        const sign = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.2, 8), flat('#5b4636'));
        post.position.y = 1.6;
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.16, 32), flat(h.hex));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 3.4;
        const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.05, roughness: 0.6 });
        signMats.push(mat);
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), mat);
        face.position.set(0, 3.4, 0.09);
        const back = face.clone();
        back.rotation.y = Math.PI;
        back.position.z = -0.09;
        for (const o of [post, rim, face, back]) o.castShadow = true;
        sign.add(post, rim, face, back);
        sign.position.set(h.x + 2.8 * toStreet, 0, h.z + toStreet * 5.3);
        sign.rotation.y = facing;
        scene.add(sign);
      }),
    );
    // the house's own glow, which comes up at dusk
    const glow = new THREE.PointLight(h.hex, 0, 14, 1.6);
    glow.position.set(h.x, 2.2, h.z + toStreet * 5.5);
    scene.add(glow);
    glows.push(glow);
    // a little garden
    const r = rng(i + 7);
    for (let k = 0; k < 4; k++) {
      const name = SMALL[Math.floor(r() * SMALL.length)];
      const gx = h.x + (r() < 0.5 ? -1 : 1) * (2 + r() * 2.2);
      const gz = h.z + toStreet * (3.6 + r() * 1.2);
      jobs.push(
        load(name).then((m) => {
          const o = fit(m, 0.8 + r() * 0.5);
          o.position.set(gx, 0, gz);
          o.rotation.y = r() * Math.PI * 2;
          scene.add(o);
        }),
      );
    }
  });

  // street lamps
  // north lamps stand between the houses, clear of the signs; south lamps face the houses
  const lampSpots = [
    ...[-24, -12, 0, 12, 24].map((x) => [x, -3.9] as const),
    ...[-30, -18, -6, 6, 18, 30].map((x) => [x, 3.9] as const),
  ];
  for (const [x, z] of lampSpots) {
    jobs.push(
      load('street-lamp').then((m) => {
        const lamp = fit(m, 3.6, true);
        lamp.position.set(x, 0.15, z);
        lamp.rotation.y = z > 0 ? Math.PI : 0;
        scene.add(lamp);
        const mat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0 });
        bulbs.push(mat);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat);
        bulb.position.set(x, 3.55, z);
        scene.add(bulb);
      }),
    );
  }

  // woods round the village, kept off the street and the gardens
  {
    const r = rng(42);
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 120; tries++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 45;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      // keep the street clear, and the south side open where the camera stands
      if (z > -16 && z < 32 && Math.abs(x) < 46) continue;
      if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 8)) continue;
      const rock = r() < 0.15;
      const name = rock ? ROCKS[Math.floor(r() * ROCKS.length)] : TREES[Math.floor(r() * TREES.length)];
      const size = rock ? 1 + r() * 1.6 : 4.5 + r() * 3.5;
      const rot = r() * Math.PI * 2;
      placed++;
      jobs.push(
        load(name).then((m) => {
          const o = fit(m, size, !rock);
          o.position.set(x, 0, z);
          o.rotation.y = rot;
          scene.add(o);
        }),
      );
    }
  }

  // life: two cars on a loop and villagers on the pavement
  const movers: { obj: THREE.Object3D; update: (t: number) => void }[] = [];
  CARS.forEach((name, i) => {
    jobs.push(
      load(name).then((m) => {
        const car = fit(m, 2.8);
        const dir = i === 0 ? 1 : -1;
        car.rotation.y = (dir * Math.PI) / 2;
        scene.add(car);
        movers.push({
          obj: car,
          update: (t) => {
            const span = 80;
            const s = ((t * 4.2 + i * 37) % span) - span / 2;
            car.position.set(dir * s, 0.08, dir * 1.45);
          },
        });
      }),
    );
  });
  NPCS.forEach((name, i) => {
    jobs.push(
      load(name).then((m) => {
        const npc = fit(m, 1.5, true);
        scene.add(npc);
        const z = i % 2 ? 3.9 : -3.9;
        const x0 = -24 + i * 13;
        movers.push({
          obj: npc,
          update: (t) => {
            const ph = t * 0.22 + i * 1.7;
            const x = x0 + Math.sin(ph) * 5;
            npc.position.set(x, 0.2 + Math.abs(Math.sin(t * 6 + i)) * 0.06, z);
            npc.rotation.y = Math.cos(ph) > 0 ? Math.PI / 2 : -Math.PI / 2;
          },
        });
      }),
    );
  });

  // camera: one keyframe per beat — hero, a house each, finale
  type Key = { pos: THREE.Vector3; look: THREE.Vector3 };
  const keys = (): Key[] => {
    const desk = wide();
    // the opening and the ending look out past the island, so the sky takes the top of the frame
    const k: Key[] = [{ pos: new THREE.Vector3(-6, 30, 64), look: new THREE.Vector3(0, 2, -26) }];
    for (const h of houses) {
      // the same framing at every house, so moving between them is a pure sideways track;
      // on wide screens the card sits left and the house right, on phones the card sits low
      k.push({
        pos: new THREE.Vector3(h.x + (desk ? -4 : 0), desk ? 9 : 11, h.z + (desk ? 21 : 25)),
        look: new THREE.Vector3(h.x + (desk ? -5 : 0), desk ? 2.2 : -5, h.z),
      });
    }
    k.push({ pos: new THREE.Vector3(6, 24, 50), look: new THREE.Vector3(0, 3, -22) });
    return k;
  };
  let K = keys();

  let target = 0;
  const want = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const cur = { pos: K[0].pos.clone(), look: K[0].look.clone() };

  function solve(f: number) {
    const n = K.length - 1;
    const c = Math.min(n, Math.max(0, f));
    const i = Math.min(n - 1, Math.floor(c));
    const raw = c - i;
    // dwell at each stop, travel between them
    const t = smooth(0.18, 0.82, raw);
    want.pos.lerpVectors(K[i].pos, K[i + 1].pos, t);
    want.look.lerpVectors(K[i].look, K[i + 1].look, t);
    return c / n;
  }

  // mood: 0 evening (light theme), 1 night (dark theme); eases toward the theme when it changes
  const isDark = () => document.documentElement.dataset.sjlTheme === 'dark' || document.documentElement.dataset.theme === 'dark';
  let mood = isDark() ? 1 : 0;
  let moodTarget = mood;
  const themeWatch = new MutationObserver(() => (moodTarget = isDark() ? 1 : 0));
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sjl-theme'] });

  const sunDir = new THREE.Vector3();
  function light(p: number) {
    const m = mood;
    mixColor('top', p, m, skyU.top.value);
    mixColor('mid', p, m, skyU.mid.value);
    mixColor('horizon', p, m, skyU.horizon.value);
    seaMat.color.copy(skyU.horizon.value).lerp(skyU.mid.value, 0.45).multiplyScalar(0.82);
    fogColor.copy(skyU.horizon.value); // the far sea melts into the sky's horizon
    // the evening sun sits low in the west, behind the houses; at night the moon lights from high up
    const sunY = mixNum('sunY', p, m);
    // evening: low over the sea behind the houses, so it sits in frame; night: the moon, high
    sun.position.set(THREE.MathUtils.lerp(-35, -40, m), sunY, THREE.MathUtils.lerp(-110, -30, m));
    sunDir.copy(sun.position).normalize();
    skyU.sunDir.value.copy(sunDir);
    mixColor('sun', p, m, sun.color);
    skyU.sunColor.value.copy(sun.color);
    skyU.sunGlow.value = 1 - m;
    sun.intensity = mixNum('sunI', p, m);
    mixColor('hemi', p, m, hemi.color);
    mixColor('ground', p, m, hemi.groundColor);
    hemi.intensity = mixNum('hemiI', p, m);
    const glow = mixNum('glow', p, m);
    for (const g of glows) g.intensity = glow;
    const bulb = mixNum('bulb', p, m);
    for (const b of bulbs) b.emissiveIntensity = bulb;
    const sign = mixNum('sign', p, m);
    for (const mt of signMats) mt.emissiveIntensity = sign;
    stars.material.opacity = mixNum('stars', p, m);
    (moon.material as THREE.MeshBasicMaterial).opacity = m;
    renderer.toneMappingExposure = mixNum('exposure', p, m);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = wide() ? 40 : 52;
    camera.updateProjectionMatrix();
    K = keys();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  await Promise.all(jobs.map((j) => j.catch(() => undefined)));

  const clock = new THREE.Timer();
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.getElapsed();
    const p = solve(target);
    mood += (moodTarget - mood) * (1 - Math.exp(-dt * 2.5));
    light(p);
    const k = 1 - Math.exp(-dt * 5);
    cur.pos.lerp(want.pos, k);
    cur.look.lerp(want.look, k);
    camera.position.copy(cur.pos);
    camera.position.x += Math.sin(t * 0.25) * 0.35;
    camera.position.y += Math.sin(t * 0.33) * 0.2;
    camera.lookAt(cur.look);
    // the sky is always the same distance away, wherever the camera is
    skyDome.position.copy(camera.position);
    for (const m of movers) m.update(t);
    renderer.render(scene, camera);
  };
  frame();
  onReady();
  // development only: render one frame and hand back its pixels, for regenerating the poster stills
  if (import.meta.env.DEV) {
    (window as unknown as { __streetState: () => unknown }).__streetState = () => ({ f: target, cam: camera.position.toArray().map((v) => +v.toFixed(1)) });
    (window as unknown as { __streetSnapshot: () => string }).__streetSnapshot = () => {
      mood = moodTarget;
      light(solve(target));
      skyDome.position.copy(camera.position);
      renderer.render(scene, camera);
      return canvas.toDataURL('image/png');
    };
  }

  return {
    setProgress(f) {
      target = f;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeWatch.disconnect();
      renderer.dispose();
    },
  };
}
