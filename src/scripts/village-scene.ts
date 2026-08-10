// "Lab by day" village — a low-poly countryside you drive through. Each
// project from the lab's data gets a house and a kerbside signboard; pulling up
// to one raises the info card in the DOM.
//
// Assets: Kenney City Kit Suburban + Nature Kit (CC0), street lamp kit, and
// Han66st's Japan Offroad Car (CC-BY). This file assembles the village; the
// pieces live in ./village/*.
import { projects, districts, byDistrict, type Project } from '../data/projects';
import { createRoad, Z_START, Z_END } from './village/road';
import { createEnv } from './village/env';
import { createProps } from './village/props';
import { createBoards } from './village/boards';
import { createLamps } from './village/lamps';
import { createCar } from './village/car';
import { createAudio } from './village/audio';
import { createInput } from './village/input';
import { createFx } from './village/fx';
import { createQuality, type QualitySettings } from './village/quality';

/** GLBs the village pulls in — used to keep the loading bar honest early on */
const EXPECTED_ASSETS = 28;

interface Station {
  kind: 'project' | 'info';
  project?: Project;
  accent: string;
  x: number;
  z: number;
  info?: { title: string; tagline: string; lines: string[]; links: Array<{ label: string; url: string }> };
}

export async function initVillageScene(canvas: HTMLCanvasElement): Promise<boolean> {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return false;

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  // models ship meshopt-compressed (scripts/compress-assets.mjs); the decoder
  // is a few KB and rides along inside three's addons
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');

  await Promise.all([
    document.fonts.load('700 90px "Inconsolata Variable"'),
    document.fonts.load('44px "Inconsolata Variable"'),
  ]).catch(() => {});

  const quality = createQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.settings.tier !== 'low' });
  renderer.setPixelRatio(quality.settings.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = quality.settings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);

  // deterministic layout randomness — the village looks the same every visit
  let seed = 20260809;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const env = createEnv(THREE, scene, renderer, quality.settings.shadowMapSize);
  const road = createRoad(THREE, scene, maxAniso);

  // the page shows a real bar while the village downloads; `total` climbs as
  // later batches are queued, so hold the fraction against a known floor and
  // never let it run backwards
  let progress = 0;
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    progress = Math.max(progress, Math.min(0.98, loaded / Math.max(total, EXPECTED_ASSETS)));
    window.dispatchEvent(new CustomEvent('village:loading', { detail: progress }));
  };
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const props = createProps(THREE, scene, loader, rand);

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9fc178 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (Z_START + Z_END) / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const [houses, driveway, planter, kTreeLarge, kTreeSmall, flowers, bushes, rocks, nTrees, fallTrees] =
    await Promise.all([
      Promise.all(['building-type-a', 'building-type-c', 'building-type-e', 'building-type-g', 'building-type-h', 'building-type-j', 'building-type-m', 'building-type-q'].map(props.loadAsset)),
      props.loadAsset('driveway-short'),
      props.loadAsset('planter'),
      props.loadAsset('tree-large'),
      props.loadAsset('tree-small'),
      Promise.all(['flower_purpleA', 'flower_redA', 'flower_yellowA'].map(props.loadAsset)),
      Promise.all(['plant_bush', 'plant_bushLarge'].map(props.loadAsset)),
      Promise.all(['rock_smallA', 'rock_smallC'].map(props.loadAsset)),
      Promise.all(['tree_default', 'tree_detailed', 'tree_oak'].map(props.loadAsset)),
      Promise.all(['tree_default_fall', 'tree_detailed_fall', 'tree_oak_fall'].map(props.loadAsset)),
    ]);

  const seasonalTree = (i: number, size: number, x: number, z: number, rotY: number) =>
    props.placeSeasonalTree(nTrees[i % nTrees.length], fallTrees[i % fallTrees.length], size, x, z, rotY);

  const boards = createBoards(THREE, scene, maxAniso, props.addOrientedCollider);

  // ---------- project stations along the winding road ----------
  const stations: Station[] = [];
  const houseCenters: Array<{ x: number; z: number }> = [];
  {
    const totalStations = projects.length;
    let idx = 0;
    let side = -1;
    for (const d of districts) {
      const items = byDistrict(d.id);
      // district gate beside the road at the section start
      const tGate = 0.05 + (idx / totalStations) * 0.86;
      {
        const c = road.curve.getPointAt(tGate);
        const n = road.perp(tGate);
        boards.districtBoard(d, c.x + n.x * 6.5, c.z + n.z * 6.5, Math.atan2(-n.x, -n.z));
      }
      for (const project of items) {
        const t = 0.08 + (idx / totalStations) * 0.86;
        const c = road.curve.getPointAt(t);
        const tan = road.curve.getTangentAt(t);
        const n = road.perp(t).multiplyScalar(side);
        const faceRoad = Math.atan2(-n.x, -n.z);

        // deep house models reach ~4.7 toward the road — keep every facade
        // behind the signboards at 6.4
        const hx = c.x + n.x * 12.4;
        const hz = c.z + n.z * 12.4;
        props.place(houses[Math.floor(rand() * houses.length)], 7.5 + rand() * 1.8, hx, hz, faceRoad, 'box');
        houseCenters.push({ x: hx, z: hz });
        props.place(driveway, 3.2, c.x + n.x * 7.3, c.z + n.z * 7.3, faceRoad);
        const bx = c.x + n.x * 6.4 + tan.x * 1.6;
        const bz = c.z + n.z * 6.4 + tan.z * 1.6;
        boards.projectBoard(project, d.accent, bx, bz, faceRoad);
        stations.push({ kind: 'project', project, accent: d.accent, x: bx, z: bz });

        // yard + across-the-road garden
        const treeKind = rand() < 0.5 ? kTreeLarge : kTreeSmall;
        props.place(treeKind, 2.2 + rand() * 1.6, hx + tan.x * (4 + rand() * 2), hz + tan.z * (4 + rand() * 2), rand() * 6.28, 'trunk', 0.012);
        if (rand() < 0.6) props.place(planter, 1.1, c.x + n.x * 6.8 - tan.x * 2.2, c.z + n.z * 6.8 - tan.z * 2.2, faceRoad, 'box');
        seasonalTree(Math.floor(rand() * 100), 3 + rand() * 2, c.x - n.x * (9 + rand() * 3), c.z - n.z * (9 + rand() * 3), rand() * 6.28);
        props.place(bushes[Math.floor(rand() * bushes.length)], 1.2 + rand() * 0.8, c.x - n.x * (7 + rand() * 2), c.z - n.z * (7 + rand() * 2), rand() * 6.28, false, 0.02);

        idx++;
        side *= -1;
      }
    }
  }

  // ---------- the village square: HQ, about, contact kiosk ----------
  // the square sits at the END of the road — the drive's destination
  const plaza = (() => {
    const c = road.curve.getPointAt(1);
    const dir = road.curve.getTangentAt(1).normalize(); // direction of travel
    return { x: c.x + dir.x * 17, z: c.z + dir.z * 17, n: dir, c };
  })();
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(11, 40), new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(plaza.x, 0.045, plaza.z);
    disc.receiveShadow = true;
    scene.add(disc);

    const path = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 9), new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }));
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = -Math.atan2(plaza.n.x, plaza.n.z);
    path.position.set(plaza.c.x + plaza.n.x * 4.5, 0.035, plaza.c.z + plaza.n.z * 4.5);
    path.receiveShadow = true;
    scene.add(path);

    // HQ: the biggest house in the kit, scaled up, facing the plaza
    const faceP = Math.atan2(plaza.c.x - plaza.x, plaza.c.z - plaza.z);
    props.place(houses[7], 13, plaza.x + plaza.n.x * 10, plaza.z + plaza.n.z * 10, faceP, 'box');

    const hqx = plaza.x + plaza.n.x * 4.5;
    const hqz = plaza.z + plaza.n.z * 4.5;
    boards.infoBoard('SUPER JACKFRUIT LABS', 'an open-source lab you can drive through', '#d98a1f', hqx, hqz, faceP);
    stations.push({
      kind: 'info', accent: '#d98a1f', x: hqx, z: hqz,
      info: {
        title: 'Super Jackfruit Labs',
        tagline: 'an open-source lab you can drive through',
        lines: [
          "Hi — I'm Rakesh. This village is my lab: every house on the road is a real open-source project, most of them work-in-progress, all of them free to fork.",
          'By night this lab is a neon street — same projects, different weather.',
        ],
        links: [{ label: 'the neon street (night site) →', url: 'https://superjackfruit.com/' }],
      },
    });

    const kx = plaza.x - plaza.n.z * 8;
    const kz = plaza.z + plaza.n.x * 8;
    const faceK = Math.atan2(plaza.x - kx, plaza.z - kz);
    boards.infoBoard('say hi', 'the lab is always open', '#3f9e3f', kx, kz, faceK);
    stations.push({
      kind: 'info', accent: '#3f9e3f', x: kx, z: kz,
      info: {
        title: 'say hi',
        tagline: 'the lab is always open',
        lines: ['Everything here is open source. Come look under the hood, open an issue, or just wave.'],
        links: [
          { label: 'github.com/rakeshgangwar →', url: 'https://github.com/rakeshgangwar' },
          { label: 'github.com/SuperJackfruitLabs →', url: 'https://github.com/SuperJackfruitLabs' },
        ],
      },
    });

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      props.place(planter, 1.2, plaza.x + Math.cos(a) * 10, plaza.z + Math.sin(a) * 10, a + Math.PI / 2, 'box');
    }
  }

  const lamps = await createLamps(
    THREE, scene, loader, road,
    [
      ...houseCenters.map((h) => ({ x: h.x, z: h.z, r: 8.5 })),
      ...stations.map((s) => ({ x: s.x, z: s.z, r: 3 })),
    ],
    props.addOrientedCollider,
    quality.settings.lampLights
  );

  // flowers along the road edges
  for (let t = 0.02; t < 0.98; t += (3.5 + rand() * 3) / road.length) {
    const c = road.curve.getPointAt(t);
    for (const sd of [-1, 1]) {
      const n = road.perp(t).multiplyScalar(sd);
      if (rand() < quality.settings.flowerChance) {
        props.place(flowers[Math.floor(rand() * flowers.length)], 0.55 + rand() * 0.3, c.x + n.x * (5.3 + rand() * 0.6), c.z + n.z * (5.3 + rand() * 0.6), rand() * 6.28, false, 0.05);
      }
    }
  }

  // background nature keeps clear of the road and the plaza
  for (let i = 0; i < quality.settings.bgTrees; i++) {
    const x = (rand() - 0.5) * 300;
    const z = Z_END - 20 + rand() * (Z_START - Z_END + 60);
    if (road.distTo(x, z) < 13) continue;
    if (Math.hypot(x - plaza.x, z - plaza.z) < 16) continue;
    seasonalTree(Math.floor(rand() * 100), 3 + rand() * 3.5, x, z, rand() * 6.28);
  }
  for (let i = 0; i < quality.settings.bgRocks; i++) {
    const x = (rand() - 0.5) * 280;
    const z = Z_END - 10 + rand() * (Z_START - Z_END + 40);
    if (road.distTo(x, z) < 12) continue;
    props.place(rocks[Math.floor(rand() * rocks.length)], 0.5 + rand() * 0.8, x, z, rand() * 6.28);
  }

  // everything scattered so far becomes a handful of instanced meshes
  props.commit();

  // drifting cartoon clouds
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false });
  const clouds: import('three').Group[] = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + rand() * 2.4, 7, 6), cloudMat);
      puff.position.set(p * 2.6 + rand(), rand() * 1.2, rand() * 1.5);
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 280, 36 + rand() * 16, Z_END + rand() * (Z_START - Z_END + 40));
    scene.add(cloud);
    clouds.push(cloud);
  }

  const car = await createCar(THREE, loader, scene);
  const audio = createAudio();
  const input = createInput(canvas, audio.ensure);
  const fx = createFx(THREE, scene);

  // ---------- page wiring ----------
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') audio.toggleMute();
  });
  window.addEventListener('village:audio', ((e: CustomEvent<{ channel: string; on: boolean }>) => {
    audio.setChannel(e.detail.channel, e.detail.on);
  }) as EventListener);
  window.addEventListener('village:time', ((e: CustomEvent<string>) => env.setTime(e.detail)) as EventListener);
  window.addEventListener('village:season', ((e: CustomEvent<string>) => {
    const season = e.detail === 'autumn' ? 'autumn' : 'summer';
    props.setSeason(season);
    groundMat.color.set(season === 'autumn' ? 0xb3a068 : 0x9fc178);
  }) as EventListener);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // a downgrade can only touch what's cheap to change mid-flight; scenery
  // counts were spent at build time
  function applyQuality(s: QualitySettings): void {
    renderer.setPixelRatio(s.pixelRatio);
    if (renderer.shadowMap.enabled !== s.shadows) {
      renderer.shadowMap.enabled = s.shadows;
      // shadows are compiled into the shaders — every material needs a rebuild
      scene.traverse((o) => {
        const mat = (o as import('three').Mesh).material;
        if (!mat) return;
        for (const m of Array.isArray(mat) ? mat : [mat]) m.needsUpdate = true;
      });
    }
  }

  // visited tracking + completion fireworks over the square
  const visited = new Set<string>();
  try {
    for (const sl of JSON.parse(localStorage.getItem('sjl-visited') ?? '[]')) visited.add(sl);
  } catch {}
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('village:visited', { detail: { count: visited.size, total: projects.length } }));
  }, 500);

  // ---------- driving surface ----------
  // the asphalt and the paved square are smooth; everything else is dirt
  const PAVED_MARGIN = 0.6;
  const offRoad = (x: number, z: number): boolean =>
    road.distTo(x, z) > road.halfAsphalt + PAVED_MARGIN && Math.hypot(x - plaza.x, z - plaza.z) > 11;

  const carCtx = {
    resolve: props.resolve,
    offRoad,
    bounds: { minX: -100, maxX: 100, minZ: Z_END + 4, maxZ: Z_START - 2 },
  };

  // ---------- loop ----------
  let activeStation: Station | null = null;
  const camPos = new THREE.Vector3(0, 4.5, 16);
  const camTarget = new THREE.Vector3(0, 1.6, 8);
  const fwd = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  camera.position.copy(camPos);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    quality.monitor(dt, applyQuality);

    const state = input.read();
    car.update(dt, t, state, carCtx, audio);

    const nitro = state.nitro && -state.iz > 0.05;
    audio.engine(car.speed, nitro);

    // nitro widens the lens as the surge builds
    const targetFov = 50 + 8 * Math.max(0, (car.speed - 11 * 0.7) / (18 - 11 * 0.7));
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }

    const nightFactor = env.update(dt);
    lamps.update(nightFactor, car.root.position.x, car.root.position.z);
    boards.applyNight(nightFactor);
    car.applyNight(nightFactor);

    props.updateSway(t);
    for (const cloud of clouds) {
      cloud.position.x += dt * 0.6;
      if (cloud.position.x > 150) cloud.position.x = -150;
    }

    // nearest station within reach → raise the card
    let nearest: Station | null = null;
    let bestD = 4.4;
    for (const st of stations) {
      const d = Math.hypot(st.x - car.root.position.x, st.z - car.root.position.z);
      if (d < bestD) {
        bestD = d;
        nearest = st;
      }
    }
    if (nearest !== activeStation) {
      activeStation = nearest;
      window.dispatchEvent(
        new CustomEvent('village:station', {
          detail: nearest
            ? nearest.kind === 'project'
              ? { kind: 'project', project: nearest.project, accent: nearest.accent }
              : { kind: 'info', info: nearest.info, accent: nearest.accent }
            : null,
        })
      );
      if (nearest && nearest.kind === 'project' && nearest.project && !visited.has(nearest.project.slug)) {
        visited.add(nearest.project.slug);
        try {
          localStorage.setItem('sjl-visited', JSON.stringify([...visited]));
        } catch {}
        window.dispatchEvent(new CustomEvent('village:visited', { detail: { count: visited.size, total: projects.length } }));
        if (visited.size === projects.length) fx.celebrate(plaza.x, plaza.z);
      }
    }

    fx.update(dt, nightFactor, car.root.position.x, car.root.position.z, car.heading);

    // chase camera: sits behind the car's heading, lags softly into corners,
    // and looks ahead of the car rather than at it
    fwd.set(Math.sin(car.heading), 0, Math.cos(car.heading));
    desiredCam.copy(car.root.position).addScaledVector(fwd, -8.4);
    desiredCam.y += 4.1;
    camPos.lerp(desiredCam, Math.min(1, dt * 2.6));
    camera.position.copy(camPos);
    if (car.shake > 0.001) {
      // a knock rattles the mount, not the car
      const s = car.shake * 0.14;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    desiredTarget.copy(car.root.position).addScaledVector(fwd, 4.5);
    desiredTarget.y += 1.3;
    camTarget.lerp(desiredTarget, Math.min(1, dt * 4.5));
    camera.lookAt(camTarget);
    env.follow(camera.position, car.root.position);

    renderer.render(scene, camera);
  });

  window.dispatchEvent(new CustomEvent('village:ready'));

  (window as any).__village = {
    tier: () => quality.settings.tier,
    drawCalls: () => ({ instanced: props.drawCallCount(), frame: renderer.info.render.calls }),
    pos: () => ({
      x: +car.root.position.x.toFixed(2),
      z: +car.root.position.z.toFixed(2),
      speed: +car.speed.toFixed(2),
    }),
    stations: () => stations.map((s) => ({ slug: s.project?.slug ?? s.info?.title ?? '?', x: +s.x.toFixed(1), z: +s.z.toFixed(1) })),
    colliders: () => props.colliderCount(),
    teleport: (x: number, z: number, h = Math.PI) => car.teleport(x, z, h),
    fx: () => fx.counts(),
  };

  return true;
}
