// "Lab by day" village — a low-poly countryside you drive through. Each
// project from the lab's data gets a house and a kerbside signboard; pulling up
// to one raises the info card in the DOM.
//
// Assets: Kenney City Kit Suburban + Nature Kit (CC0), street lamp kit, and
// Han66st's Japan Offroad Car (CC-BY). This file assembles the village; the
// pieces live in ./village/*.
// three is imported statically rather than on demand: this page always mounts
// the canvas, so a dynamic import bought nothing and cost a round trip — the
// browser could not discover three until the page script had already run.
// Static imports let the bundler emit a modulepreload, so it downloads in
// parallel with everything else.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// models ship meshopt-compressed (scripts/compress-assets.mjs); the decoder is
// a few KB and rides along inside three's addons
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { districts, byDistrict, type Project } from '../data/projects';
import { createRoads, Z_START, Z_END, FOOTPATH } from './village/road';
import { createEnv } from './village/env';
import { createProps } from './village/props';
import { createBoards } from './village/boards';
import { createLamps } from './village/lamps';
import { createCar } from './village/car';
import { createAudio } from './village/audio';
import { createInput } from './village/input';
import { createFx } from './village/fx';
import { createQuality, type QualitySettings } from './village/quality';
import { createNpcs, type IdleSpot } from './village/npcs';
import { ALL_VILLAGE_MODELS, HOUSE_MODELS } from '../data/village-models';
import { createAmbient, type Chimney } from './village/ambient';
import { restoreVisits } from './village/visits.mjs';

/** GLBs the village pulls in — used to keep the loading bar honest early on */
const EXPECTED_ASSETS = 34;

interface Station {
  kind: 'project' | 'info';
  /** How close the car has to come before the card rises; boards default to 4.4. */
  reach?: number;
  project?: Project;
  accent: string;
  x: number;
  z: number;
  info?: { title: string; tagline: string; lines: string[]; links: Array<{ label: string; url: string }> };
}

export async function initVillageScene(canvas: HTMLCanvasElement): Promise<boolean> {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return false;

  // build-up timings, readable from the console via __village.timings()
  const timings: Array<{ phase: string; ms: number }> = [];
  let lastMark = performance.now();
  const mark = (phase: string) => {
    const now = performance.now();
    timings.push({ phase, ms: Math.round(now - lastMark) });
    lastMark = now;
  };
  (window as any).__villageTimings = timings;


  // The signboards are drawn into canvases, so the face has to be ready before
  // THEY are built — but nothing else depends on it. Start it here and await it
  // later, so the models aren't queued behind a webfont. Capped, because a font
  // that never arrives must not cost us the village.
  const fontsReady = Promise.race([
    Promise.all([
      document.fonts.load('700 90px "Inconsolata Variable"'),
      document.fonts.load('800 112px "Bricolage Grotesque Variable"'),
      document.fonts.load('600 54px "Figtree Variable"'),
      document.fonts.load('44px "Inconsolata Variable"'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]).catch(() => {});

  const quality = createQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.settings.tier !== 'low' });
  renderer.setPixelRatio(quality.settings.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = quality.settings.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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
  mark('setup');

  // ---------- the streets, on a 10 m grid of road tiles ----------
  // The spine runs south from the start, jogs east and back so the drive has
  // corners to take, and ends at the square. The suite lines its first long
  // straight; MCP Alley leaves east and the Odd Shop west, each from a T.
  const run = (x0: number, z0: number, x1: number, z1: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 0; i <= n; i++) out.push([x0 + Math.sign(x1 - x0) * i, z0 + Math.sign(z1 - z0) * i]);
    return out;
  };
  const MAIN_CELLS = [
    ...run(0, 1, 0, -10),
    ...run(1, -10, 3, -10),
    ...run(3, -11, 3, -18),
    ...run(2, -18, 0, -18),
    ...run(0, -19, 0, -25),
  ];
  const road = await createRoads(
    THREE, scene, props.loadAsset,
    { id: 'main', cells: MAIN_CELLS, culDeSac: 0, startCulDeSac: 9 },
    [
      // straight on at the first bend, back into the main street where it returns
      { id: 'straight-on', cells: run(0, -11, 0, -17), culDeSac: 0, rejoins: true },
      { id: 'mcp-alley', cells: run(4, -13, 11, -13), culDeSac: 9 },
      { id: 'odd-shop', cells: run(-1, -21, -6, -21), culDeSac: 9 },
    ],
    (o) => {
      if ((o as import('three').Mesh).isMesh) o.receiveShadow = true;
    }
  );

  // A flat colour reads as a void at speed. A speckled tile, multiplied by the
  // season's colour, gives the eye something to track and the car a sense of pace.
  const groundTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 200 + Math.floor(rand() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 5, 2 + rand() * 5);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(150,150,150,0.18)';
      g.beginPath();
      g.arc(rand() * 256, rand() * 256, 8 + rand() * 22, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(70, 70);
    tex.anisotropy = maxAniso;
    return tex;
  })();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9fc178, map: groundTex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (Z_START + Z_END) / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Ask for every model up front. The lamp, the villagers and the car used to
  // wait for this batch to finish before they were even requested, which cost
  // half a second of dead air on the wire for nothing.
  for (const name of ALL_VILLAGE_MODELS) void props.loadGltf(name);

  const [houses, driveway, planter, kTreeLarge, kTreeSmall, flowers, bushes, rocks, nTrees, fallTrees] =
    await Promise.all([
      Promise.all(HOUSE_MODELS.map(props.loadAsset)),
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

  mark('load-assets');
  await fontsReady;
  mark('fonts');
  const seasonalTree = (i: number, size: number, x: number, z: number, rotY: number) =>
    props.placeSeasonalTree(nTrees[i % nTrees.length], fallTrees[i % fallTrees.length], size, x, z, rotY);

  const boards = createBoards(THREE, scene, maxAniso, props.addOrientedCollider);

  // ---------- the town ----------
  // Projects live on their district's street, so each district is somewhere you
  // turn off for rather than a sign you drive past. The main road carries the
  // neighbours who don't ship software.
  const stations: Station[] = [];
  const houseCenters: Array<{ x: number; z: number }> = [];
  const idleSpots: IdleSpot[] = [];
  const chimneys: Chimney[] = [];
  const gates: Array<{ x: number; z: number }> = [];

  // signs stand on the verge; a house set down later keeps its distance from them too
  const signSpots: Array<{ x: number; z: number }> = [];
  const clearOfHouses = (x: number, z: number, gap: number): boolean =>
    !houseCenters.some((h) => Math.hypot(h.x - x, h.z - z) < gap) &&
    !signSpots.some((s) => Math.hypot(s.x - x, s.z - z) < Math.max(9, gap * 0.75));

  // ---------- lit windows ----------
  // The houses share Kenney's palette texture, and their glass is one swatch
  // of it (the pale-blue cell, column 6 of the second row). A mask that is
  // warm light on that swatch and black everywhere else, used as the houses'
  // emissive map, makes every window glow without touching walls or roofs;
  // the glow fades in with the night.
  const windowMask = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#fff';
    g.fillRect(320, 128, 64, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false; // as glTF's own textures are
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  for (const h of houses) {
    h.traverse((o) => {
      const mesh = o as import('three').Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const lm = m as import('three').MeshStandardMaterial;
        if (!('emissive' in lm)) continue;
        lm.emissiveMap = windowMask;
        lm.emissive.set(0xffc46b);
        lm.emissiveIntensity = 0;
      }
    });
  }

  function putHouse(x: number, z: number, facing: number, size: number, pick?: (typeof houses)[number]): void {
    const proto = pick ?? houses[Math.floor(rand() * houses.length)];
    props.place(proto, size, x, z, facing, 'box');
    houseCenters.push({ x, z });
    if (chimneys.length < quality.settings.chimneys) {
      const fx = Math.sin(facing);
      const fz = Math.cos(facing);
      // back from the road-facing gable, off to one side of the ridge
      chimneys.push({
        x: x - fx * 1.1 + fz * 1.3,
        y: props.scaledSize(proto, size).y * 0.98,
        z: z - fz * 1.1 - fx * 1.3,
      });
    }
  }

  // ---------- the suite: the first six houses down the main road, in flow order ----------
  // A visitor meets the suite before anything else, one step after another,
  // alternating sides so each house gets its own frontage.
  const startT = 0.012;
  {
    const half = road.main.width / 2;
    const items = byDistrict('agent-works');
    // the signs are painted once, so their logos have to be in hand first
    const logos = new Map<string, HTMLImageElement>();
    await Promise.all(items.map((p) => new Promise<void>((resolve) => {
      if (!p.logo) return resolve();
      const img = new Image();
      img.onload = () => { logos.set(p.slug, img); resolve(); };
      img.onerror = () => resolve(); // a missing logo falls back to the step number
      img.src = p.logo;
    })));
    items.forEach((project, i) => {
      const t = 0.07 + i * (12 / road.main.length);
      const c = road.main.curve.getPointAt(t);
      const tan = road.main.curve.getTangentAt(t);
      const n = road.main.perp(t).multiplyScalar(i % 2 === 0 ? -1 : 1);
      const faceRoad = Math.atan2(-n.x, -n.z);
      putHouse(c.x + n.x * (half + 8), c.z + n.z * (half + 8), faceRoad, 7.6, houses[(i * 3 + 1) % houses.length]);
      const dx = c.x + n.x * (half + 2.6);
      const dz = c.z + n.z * (half + 2.6);
      props.place(driveway, 3.0, dx, dz, faceRoad);
      // the sign stands side-on to the road so it reads as you approach
      const bx = c.x + n.x * (half + FOOTPATH + 1.2) - tan.x * 3.2;
      const bz = c.z + n.z * (half + FOOTPATH + 1.2) - tan.z * 3.2;
      boards.suiteBoard(i + 1, project, bx, bz, Math.atan2(-tan.x, -tan.z), logos.get(project.slug));
      signSpots.push({ x: bx, z: bz });
      stations.push({ kind: 'project', project, accent: project.accent ?? '#d98a1f', x: c.x, z: c.z, reach: 9 });
      const ix = c.x + n.x * (half + 4.4) + tan.x * 2.2;
      const iz = c.z + n.z * (half + 4.4) + tan.z * 2.2;
      idleSpots.push({ x: ix, z: iz, facing: faceRoad });
    });

    // where the drive starts: what this place is, and how to skip it
    const c = road.main.curve.getPointAt(startT + 0.02);
    const tan = road.main.curve.getTangentAt(startT + 0.02);
    const n = road.main.perp(startT + 0.02).multiplyScalar(1);
    const sx = c.x + n.x * (half + FOOTPATH + 1.2);
    const sz = c.z + n.z * (half + FOOTPATH + 1.2);
    boards.infoBoard('START HERE', 'six tools, one task — drive on', '#d98a1f', sx, sz, Math.atan2(-tan.x, -tan.z));
    signSpots.push({ x: sx, z: sz });
    stations.push({
      kind: 'info', accent: '#d98a1f', x: c.x, z: c.z, reach: 7,
      info: {
        title: 'Super Jackfruit Labs',
        tagline: 'six tools for working with agents',
        lines: [
          'Drive on: the next six houses are the suite, in the order a task moves through it — you talk, the work is planned, an agent does it, your fleet runs it, it remembers, you see proof.',
          'Each one works on its own. Further down the road are the experiments that taught us what to build.',
        ],
        links: [
          { label: 'the suite as a page →', url: '/suite' },
          { label: 'run it with your team →', url: 'mailto:rakesh@superjackfruit.com' },
        ],
      },
    });
  }

  for (const d of districts) {
    if (d.id === 'agent-works') continue; // the suite, placed above
    const street = road.get(d.id);

    // a sign on the spine before the turning, so the street is somewhere you
    // decide to go rather than something you notice in the mirror
    {
      const spec = road.junctions.find((b) => b.id === d.id)!;
      const at = spec.t - 24 / road.main.length;
      const c = road.main.curve.getPointAt(at);
      const tan = road.main.curve.getTangentAt(at);
      const n = road.main.perp(at).multiplyScalar(spec.side);
      const half = road.main.width / 2;
      const off = half + FOOTPATH + 1.2;
      boards.infoBoard(
        spec.side === 1 ? `${d.name} →` : `← ${d.name}`, d.blurb, d.accent,
        c.x + n.x * off, c.z + n.z * off, Math.atan2(-tan.x, -tan.z)
      );
      gates.push({ x: c.x + n.x * off, z: c.z + n.z * off });
      signSpots.push({ x: c.x + n.x * off, z: c.z + n.z * off });
    }
    const items = byDistrict(d.id);
    const half = street.width / 2;

    let side = 1;
    items.forEach((project, i) => {
      const t = 0.22 + ((i + 0.5) / items.length) * 0.64;
      const c = street.curve.getPointAt(t);
      const tan = street.curve.getTangentAt(t);

      // Where two streets meet, "beside this lane" can be "in the middle of
      // that one". Try the intended side, then the other, then further back
      // from the kerb, and take the first that puts neither the board nor the
      // house on anybody's road.
      const tryside = (s: number, push: number) => {
        const n = street.perp(t).multiplyScalar(s);
        const bx = c.x + n.x * (half + 1.5 + push) + tan.x * 1.5;
        const bz = c.z + n.z * (half + 1.5 + push) + tan.z * 1.5;
        const hx = c.x + n.x * (half + 7.4 + push);
        const hz = c.z + n.z * (half + 7.4 + push);
        if (road.onRibbon(bx, bz, 1.2) || road.onRibbon(hx, hz, 2.5)) return null;
        return { n, push };
      };
      const spot =
        tryside(side, 0) ?? tryside(-side, 0) ?? tryside(side, 7) ?? tryside(-side, 7) ??
        { n: street.perp(t).multiplyScalar(side), push: 0 };
      const { n, push } = spot;
      const faceRoad = Math.atan2(-n.x, -n.z);

      const hx = c.x + n.x * (half + 7.4 + push);
      const hz = c.z + n.z * (half + 7.4 + push);
      putHouse(hx, hz, faceRoad, 7.2 + rand() * 1.4);

      const dx = c.x + n.x * (half + 2.6 + push);
      const dz = c.z + n.z * (half + 2.6 + push);
      if (!road.onRibbon(dx, dz, 1.4)) props.place(driveway, 3.0, dx, dz, faceRoad);

      const bx = c.x + n.x * (half + FOOTPATH + 1.2 + push) + tan.x * 1.5;
      const bz = c.z + n.z * (half + FOOTPATH + 1.2 + push) + tan.z * 1.5;
      boards.projectBoard(project, d.accent, bx, bz, faceRoad);
      signSpots.push({ x: bx, z: bz });
      stations.push({ kind: 'project', project, accent: d.accent, x: c.x + n.x * 2, z: c.z + n.z * 2, reach: 5 });

      const ix = c.x + n.x * (half + 4.4 + push) - tan.x * 2.2;
      const iz = c.z + n.z * (half + 4.4 + push) - tan.z * 2.2;
      if (!road.onRibbon(ix, iz, 1)) idleSpots.push({ x: ix, z: iz, facing: faceRoad });

      // a garden across the lane, so the far kerb isn't bare
      const o = street.perp(t).multiplyScalar(-Math.sign(n.dot(street.perp(t)) || 1));
      const gx = c.x + o.x * (half + 2.4);
      const gz = c.z + o.z * (half + 2.4);
      if (!road.onRibbon(gx, gz, 1.2)) {
        props.place(bushes[Math.floor(rand() * bushes.length)], 1.2 + rand() * 0.7, gx, gz, rand() * 6.28, false, 0.02);
      }
      const tx = c.x + o.x * (half + 6);
      const tz = c.z + o.z * (half + 6);
      if (rand() < 0.7 && !road.onRibbon(tx, tz, 2)) {
        seasonalTree(Math.floor(rand() * 100), 2.6 + rand() * 1.6, tx, tz, rand() * 6.28);
      }

      side = -side;
    });

    // neighbours filling the rest of the street
    for (let k = 0; k < 4; k++) {
      const t = 0.14 + rand() * 0.78;
      const n = street.perp(t).multiplyScalar(rand() < 0.5 ? 1 : -1);
      const c = street.curve.getPointAt(t);
      const hx = c.x + n.x * (half + 7.4);
      const hz = c.z + n.z * (half + 7.4);
      if (!clearOfHouses(hx, hz, 11) || road.onRibbon(hx, hz, 2.5)) continue;
      putHouse(hx, hz, Math.atan2(-n.x, -n.z), 6.8 + rand() * 1.6);
    }
  }

  // the spine: houses down both sides, kept clear of the junctions so the
  // turnings stay readable
  {
    const junctions = road.branches.map((b) => b.curve.getPointAt(0));
    const half = road.main.width / 2;
    let side = 1;
    for (let t = 0.04; t < 0.96; t += 24 / road.main.length) {
      const c = road.main.curve.getPointAt(t);
      const n = road.main.perp(t).multiplyScalar(side);
      const faceRoad = Math.atan2(-n.x, -n.z);
      const hx = c.x + n.x * (half + 7.8);
      const hz = c.z + n.z * (half + 7.8);
      side = -side;
      if (junctions.some((j) => Math.hypot(j.x - hx, j.z - hz) < 24)) continue;
      if (road.onRibbon(hx, hz, 3)) continue;
      if (!clearOfHouses(hx, hz, 13)) continue;
      putHouse(hx, hz, faceRoad, 7.0 + rand() * 2.0);
      const dx = c.x + n.x * (half + 2.6);
      const dz = c.z + n.z * (half + 2.6);
      if (rand() < 0.55 && !road.onRibbon(dx, dz, 1.4)) props.place(driveway, 3.1, dx, dz, faceRoad);
      const ix = c.x + n.x * (half + 4.6);
      const iz = c.z + n.z * (half + 4.6);
      if (rand() < 0.4 && !road.onRibbon(ix, iz, 1)) idleSpots.push({ x: ix, z: iz, facing: faceRoad });
    }
  }

  // ---------- the village square: HQ, about, contact kiosk ----------
  // the square sits at the END of the road — the drive's destination
  // The square is where the road ENDS, so it has to swallow the road end
  // rather than float past it — a disc set back by less than its own radius
  // overlaps the last of the tarmac, and the drive runs straight in.
  const PLAZA_R = 13;
  const plaza = (() => {
    const c = road.main.curve.getPointAt(1);
    const dir = road.main.curve.getTangentAt(1).normalize(); // direction of travel
    return { x: c.x + dir.x * 12, z: c.z + dir.z * 12, n: dir, c };
  })();
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 44), new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(plaza.x, 0.045, plaza.z);
    disc.receiveShadow = true;
    scene.add(disc);

    // HQ stands just past the far kerb of the square, facing back down the road
    const faceP = Math.atan2(plaza.c.x - plaza.x, plaza.c.z - plaza.z);
    props.place(houses[7], 13, plaza.x + plaza.n.x * 18, plaza.z + plaza.n.z * 18, faceP, 'box');

    const hqx = plaza.x + plaza.n.x * 8.5;
    const hqz = plaza.z + plaza.n.z * 8.5;
    boards.infoBoard('SUPER JACKFRUIT LABS', 'agent-native tools, built in the open', '#d98a1f', hqx, hqz, faceP);
    stations.push({
      kind: 'info', accent: '#d98a1f', x: hqx, z: hqz,
      info: {
        title: 'Super Jackfruit Labs',
        tagline: 'agent-native tools, built in the open',
        lines: [
          'The first street is the suite: six tools that carry a task from ask to proof. Each works on its own.',
          'The other streets hold the experiments that taught us what to build.',
        ],
        links: [
          { label: 'the suite as a page →', url: '/suite' },
          { label: 'run it with your team →', url: 'mailto:rakesh@superjackfruit.com' },
        ],
      },
    });

    const kx = plaza.x - plaza.n.z * 9.5;
    const kz = plaza.z + plaza.n.x * 9.5;
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

    // planters round the rim, but never across the mouth where the road comes in
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const px = plaza.x + Math.cos(a) * (PLAZA_R - 1.6);
      const pz = plaza.z + Math.sin(a) * (PLAZA_R - 1.6);
      if (road.onRibbon(px, pz, 2)) continue;
      props.place(planter, 1.2, px, pz, a + Math.PI / 2, 'box');
    }

    // a couple of people about the square, facing its middle
    for (const a of [1.9, 4.3]) {
      const sx = plaza.x + Math.cos(a) * 6.5;
      const sz = plaza.z + Math.sin(a) * 6.5;
      idleSpots.push({ x: sx, z: sz, facing: Math.atan2(plaza.x - sx, plaza.z - sz) });
    }
  }

  mark('plaza');
  const lamps = await createLamps(
    THREE, scene, props.loadGltf, road.all,
    [
      ...houseCenters.map((h) => ({ x: h.x, z: h.z, r: 8.5 })),
      ...stations.map((s) => ({ x: s.x, z: s.z, r: 3 })),
    ],
    props.addOrientedCollider,
    quality.settings.lampLights,
    road.onRibbon
  );

  mark('lamps');
  // flowers along every kerb
  for (const seg of road.all) {
    const half = seg.width / 2;
    for (let t = 0.02; t < 0.98; t += (3.5 + rand() * 3) / seg.length) {
      const c = seg.curve.getPointAt(t);
      for (const sd of [-1, 1]) {
        const n = seg.perp(t).multiplyScalar(sd);
        // in the verge just past the footpath, not on it
        const off = half + FOOTPATH + 0.5 + rand() * 0.6;
        const fx = c.x + n.x * off;
        const fz = c.z + n.z * off;
        if (rand() < quality.settings.flowerChance && !road.onRibbon(fx, fz, 0.15)) {
          props.place(flowers[Math.floor(rand() * flowers.length)], 0.55 + rand() * 0.3, fx, fz, rand() * 6.28, false, 0.05);
        }
      }
    }
  }

  // background nature keeps clear of the road and the plaza
  for (let i = 0; i < quality.settings.bgTrees; i++) {
    const x = (rand() - 0.5) * 300;
    const z = Z_END - 20 + rand() * (Z_START - Z_END + 60);
    if (road.distTo(x, z) < 15) continue;
    if (Math.hypot(x - plaza.x, z - plaza.z) < 19) continue;
    if (!clearOfHouses(x, z, 10)) continue;
    seasonalTree(Math.floor(rand() * 100), 3 + rand() * 3.5, x, z, rand() * 6.28);
  }
  for (let i = 0; i < quality.settings.bgRocks; i++) {
    const x = (rand() - 0.5) * 280;
    const z = Z_END - 10 + rand() * (Z_START - Z_END + 40);
    if (road.distTo(x, z) < 14) continue;
    if (!clearOfHouses(x, z, 9)) continue;
    props.place(rocks[Math.floor(rand() * rocks.length)], 0.5 + rand() * 0.8, x, z, rand() * 6.28);
  }

  mark('scatter');
  // everything scattered so far becomes a handful of instanced meshes
  props.commit();
  mark('commit-instances');
  // the instanced copies of the house materials, whose glow follows the night
  const windowMats: import('three').MeshStandardMaterial[] = [];
  scene.traverse((o) => {
    const m = (o as import('three').Mesh).material as import('three').MeshStandardMaterial | undefined;
    if (m && !Array.isArray(m) && m.emissiveMap === windowMask && !windowMats.includes(m)) windowMats.push(m);
  });

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

  const npcs = await createNpcs(THREE, scene, props.loadGltf, road.all, idleSpots, {
    walkers: quality.settings.npcWalkers,
    idlers: quality.settings.npcIdlers,
  }, rand);

  mark('npcs');
  const ambient = createAmbient(THREE, scene, chimneys, quality.settings.birds, rand);

  const car = await createCar(THREE, props.loadGltf, scene);
  {
    const p = road.main.curve.getPointAt(startT);
    const tan = road.main.curve.getTangentAt(startT);
    car.teleport(p.x, p.z, Math.atan2(tan.x, tan.z));
  }
  mark('car');
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
  window.addEventListener('village:quality', ((e: CustomEvent<'low' | 'medium' | 'high'>) => {
    // Pixel ratio and shadows change on the spot; scenery counts were spent at
    // build time, so the rest of the tier lands on the next visit.
    applyQuality(quality.setTier(e.detail));
  }) as EventListener);
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
    env.setShadowMapSize(s.shadowMapSize);
    window.dispatchEvent(new CustomEvent('village:quality-changed', { detail: s.tier }));
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
  // progress counts the suite alone, under a new key so the old catalogue's
  // visits don't arrive as a head start
  const VISITED_KEY = 'sjl-suite-visited';
  const suiteSlugs = byDistrict('agent-works').map((p) => p.slug);
  let visited = new Set<string>();
  try {
    visited = restoreVisits(localStorage.getItem(VISITED_KEY), suiteSlugs);
    localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
  } catch {}
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('village:visited', { detail: { count: visited.size, total: suiteSlugs.length } }));
  }, 500);

  // ---------- driving surface ----------
  // the asphalt and the paved square are smooth; everything else is dirt
  const PAVED_MARGIN = 0.6;
  const offRoad = (x: number, z: number): boolean =>
    !road.isPaved(x, z, PAVED_MARGIN) && Math.hypot(x - plaza.x, z - plaza.z) > PLAZA_R;

  const carCtx = {
    resolve: props.resolve,
    offRoad,
    bounds: { minX: -130, maxX: 130, minZ: Z_END + 4, maxZ: Z_START - 2 },
  };

  // ---------- loop ----------
  let activeStation: Station | null = null;
  const startFwd = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
  const camPos = car.root.position.clone().addScaledVector(startFwd, -8.4).setY(4.1);
  const camTarget = car.root.position.clone().addScaledVector(startFwd, 4.5).setY(1.3);
  const fwd = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  camera.position.copy(camPos);

  // Compile every shader before the first frame: left to the first render,
  // it stalled the page for seconds right as the visitor pressed a key.
  camera.lookAt(camTarget);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  mark('compile');

  const timer = new THREE.Timer();
  let framesTimed = 0;
  renderer.setAnimationLoop((now) => {
    const frameStart = performance.now();
    timer.update(now);
    const dt = Math.min(0.05, timer.getDelta());
    const t = timer.getElapsed();

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
    for (const m of windowMats) m.emissiveIntensity = nightFactor * 1.6;
    car.applyNight(nightFactor);

    props.updateSway(t);
    npcs.update(dt, car.root.position.x, car.root.position.z);
    ambient.update(dt, t, nightFactor);
    for (const cloud of clouds) {
      cloud.position.x += dt * 0.6;
      if (cloud.position.x > 150) cloud.position.x = -150;
    }

    // nearest station within reach → raise the card
    let nearest: Station | null = null;
    let bestD = Infinity;
    for (const st of stations) {
      const d = Math.hypot(st.x - car.root.position.x, st.z - car.root.position.z);
      if (d < (st.reach ?? 4.4) && d < bestD) {
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
      if (nearest && nearest.kind === 'project' && nearest.project && suiteSlugs.includes(nearest.project.slug) && !visited.has(nearest.project.slug)) {
        visited.add(nearest.project.slug);
        try {
          localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
        } catch {}
        window.dispatchEvent(new CustomEvent('village:visited', { detail: { count: visited.size, total: suiteSlugs.length } }));
        if (visited.size === suiteSlugs.length) fx.celebrate(plaza.x, plaza.z);
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

    if (framesTimed < 6) {
      timings.push({ phase: `frame-${framesTimed}`, ms: Math.round(performance.now() - frameStart) });
      framesTimed++;
    }
  });

  mark('wiring');
  timings.push({ phase: 'ready@', ms: Math.round(performance.now()) });
  window.dispatchEvent(
    new CustomEvent('village:quality-changed', { detail: quality.settings.tier })
  );
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
    timings: () => timings,
    npcs: () => npcs.list(),
    ambient: () => ({ chimneys: chimneys.length, ...ambient.debug() }),
    // nothing should be standing in the road; this is how that gets checked
    audit: () => {
      const onRoad = (list: Array<{ x: number; z: number }>, clearance: number) =>
        list.filter((o) => road.onRibbon(o.x, o.z, clearance)).length;
      return {
        // a suite stop's point is on the road on purpose (it's where the card rises); its sign is not
        boardsOnRoad: onRoad(stations.filter((st) => st.reach === undefined), 0),
        gatesOnRoad: onRoad(gates, 0),
        housesOnRoad: onRoad(houseCenters, 1.5),
        lampsOnRoad: onRoad(lamps.poles(), 0),
        totals: { boards: stations.length, gates: gates.length, houses: houseCenters.length, lamps: lamps.poles().length },
      };
    },
    // sampled centrelines + everything placed, so a top-down map can be drawn
    plan: () => ({
      roads: road.all.map((seg) => ({
        id: seg.id,
        width: seg.width,
        pts: Array.from({ length: 61 }, (_, i) => {
          const c = seg.curve.getPointAt(i / 60);
          return [+c.x.toFixed(1), +c.z.toFixed(1)];
        }),
        circle: seg.end.r > 0 ? [+seg.end.x.toFixed(1), +seg.end.z.toFixed(1), seg.end.r] : null,
      })),
      houses: houseCenters.map((h) => [+h.x.toFixed(1), +h.z.toFixed(1)]),
      boards: stations.map((st) => [+st.x.toFixed(1), +st.z.toFixed(1)]),
      lamps: lamps.poles().map((l) => [+l.x.toFixed(1), +l.z.toFixed(1)]),
      plaza: [+plaza.x.toFixed(1), +plaza.z.toFixed(1)],
    }),
    roads: () =>
      road.all.map((seg) => {
        const a = seg.curve.getPointAt(0);
        const b = seg.curve.getPointAt(1);
        return {
          id: seg.id,
          length: +seg.length.toFixed(1),
          width: seg.width,
          start: { x: +a.x.toFixed(1), z: +a.z.toFixed(1) },
          end: { x: +b.x.toFixed(1), z: +b.z.toFixed(1) },
        };
      }),
    teleport: (x: number, z: number, h = Math.PI) => car.teleport(x, z, h),
    fx: () => fx.counts(),
  };

  return true;
}
