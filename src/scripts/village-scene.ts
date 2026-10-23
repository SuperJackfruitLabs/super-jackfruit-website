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
import { CARS, loadChoice, saveChoice, type CarChoice } from './village/cars';
import { createAudio } from './village/audio';
import { createInput, isTyping } from './village/input';
import { createFx } from './village/fx';
import { createQuality, type QualitySettings } from './village/quality';
import { createNpcs, type IdleSpot } from './village/npcs';
import { ALL_VILLAGE_MODELS, HOUSE_MODELS } from '../data/village-models';
import { createAmbient, type Chimney } from './village/ambient';
import { createTraffic, TRAFFIC_MODELS } from './village/traffic';
import { layStreets } from './village/streets.mjs';
import { createMinimap } from './village/minimap';
import { createSpatialAudio } from './village/spatial-audio';
import { createMotion } from './village/motion';

/** the id prefix of every back street, so the named streets can be told apart */
const BACK_STREET = 'lane-';
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
  info?: { title: string; tagline: string; logo?: string; lines: string[]; links: Array<{ label: string; url: string }> };
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
  const NAMED = [
    // straight on at the first bend, back into the main street where it returns
    { id: 'straight-on', cells: run(0, -11, 0, -17), culDeSac: 0, rejoins: true },
    { id: 'mcp-alley', cells: run(4, -13, 11, -13), culDeSac: 9 },
    { id: 'odd-shop', cells: run(-1, -21, -6, -21), culDeSac: 9 },
  ];
  // The back streets: a knocked-about grid over the open ground either side
  // (streets.mjs), joined to the spine only where it has no suite house, sign
  // or turning pointer to cut through. The cells the named streets' turning
  // circles and the square stand on count as taken.
  const backStreets = layStreets({
    seed: 16,
    prefix: BACK_STREET,
    taken: [
      ...MAIN_CELLS, ...NAMED.flatMap((b) => b.cells),
      [0, 2], [0, 3], [12, -13], [13, -13], [-7, -21], [-8, -21],
      [0, -26], [0, -27], [0, -28], [1, -26], [1, -27], [-1, -26], [-1, -27],
    ],
    regions: [
      // west of the spine, from the start down past the Odd Shop
      { x0: -13, x1: -4, z0: 3, z1: -30, connect: [{ from: [0, -9], dir: [-1, 0] }, { from: [0, -24], dir: [-1, 0] }] },
      // east of the suite, north of the first bend
      { x0: 4, x1: 13, z0: 3, z1: -8, connect: [{ from: [3, -10], dir: [0, 1] }] },
      // east of the square, south of MCP Alley
      { x0: 5, x1: 13, z0: -17, z1: -30, connect: [{ from: [3, -18], dir: [0, -1] }] },
    ],
  });
  const road = await createRoads(
    THREE, scene, props.loadAsset,
    { id: 'main', cells: MAIN_CELLS, culDeSac: 13, startCulDeSac: 9 } /* the far end is the village square */,
    [...NAMED, ...backStreets],
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
  for (const name of TRAFFIC_MODELS.slice(0, quality.settings.traffic)) void props.loadGltf(name);

  const [houses, driveway, planter, flowers, bushes, rocks, oaks, fallOaks, spruces, deadTrees, bigRocks, forestRocks] =
    await Promise.all([
      Promise.all(HOUSE_MODELS.map(props.loadAsset)),
      props.loadAsset('driveway-short'),
      props.loadAsset('planter'),
      Promise.all(['flower_purpleA', 'flower_redA', 'flower_yellowA'].map(props.loadAsset)),
      Promise.all(['plant_bush', 'plant_bushLarge'].map(props.loadAsset)),
      Promise.all(['rock_smallA', 'rock_smallC'].map(props.loadAsset)),
      Promise.all(['forest-oak-a', 'forest-oak-b', 'forest-oak-c'].map(props.loadAsset)),
      Promise.all(['forest-oak-a-fall', 'forest-oak-b-fall', 'forest-oak-c-fall'].map(props.loadAsset)),
      Promise.all(['forest-spruce-a', 'forest-spruce-b', 'forest-spruce-c'].map(props.loadAsset)),
      Promise.all(['forest-dead-spruce', 'forest-dead-oak'].map(props.loadAsset)),
      Promise.all(['forest-rock-big-a', 'forest-rock-big-b'].map(props.loadAsset)),
      Promise.all(['forest-rock-a', 'forest-rock-b', 'forest-rock-c'].map(props.loadAsset)),
    ]);

  mark('load-assets');
  await fontsReady;
  mark('fonts');
  // every tree comes from the woods' set now: oaks that turn, spruce that don't
  const seasonalTree = (i: number, size: number, x: number, z: number, rotY: number) => {
    if (i % 3 === 0) props.placeSeasonalTree(spruces[i % spruces.length], spruces[i % spruces.length], size * 0.7, x, z, rotY);
    else props.placeSeasonalTree(oaks[i % oaks.length], fallOaks[i % fallOaks.length], size * 1.15, x, z, rotY);
  };

  // every solid part of every sign, kept so the audit can prove none of them stands inside a house
  const signSolids: Array<{ x: number; z: number; hx: number; hz: number }> = [];
  const boards = createBoards(THREE, scene, maxAniso, (x, z, hx, hz, rotY) => {
    signSolids.push({ x, z, hx, hz });
    props.addOrientedCollider(x, z, hx, hz, rotY);
  });

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

  const houseBoxes: Array<{ x: number; z: number; facing: number; hx: number; hz: number }> = [];
  function putHouse(x: number, z: number, facing: number, size: number, pick?: (typeof houses)[number]): void {
    const proto = pick ?? houses[Math.floor(rand() * houses.length)];
    props.place(proto, size, x, z, facing, 'box');
    houseCenters.push({ x, z });
    const dims = props.scaledSize(proto, size);
    houseBoxes.push({ x, z, facing, hx: dims.x / 2, hz: dims.z / 2 });
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
  // keyboard jumps (1–6, H, R): a spot on the road a little before each place, facing it
  const jumps = new Map<string, { x: number; z: number; h: number }>();
  const before = (seg: typeof road.main, t: number, metres: number) => {
    const at = Math.max(0, t - metres / seg.length);
    const p = seg.curve.getPointAt(at);
    const tan = seg.curve.getTangentAt(at);
    return { x: p.x, z: p.z, h: Math.atan2(tan.x, tan.z) };
  };
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
    // Main Street holds your work; the agents' two (AgentPod, Salaam) live on the Agent Quarter,
    // the road that carries straight on at the first bend, as in the frame's street footer
    const QUARTER = new Set(['agentpod', 'salaam']);
    const quarter = road.get('straight-on');
    const suiteHouse = (seg: typeof road.main, project: (typeof items)[number], t: number, side: number): void => {
      const c = seg.curve.getPointAt(t);
      const tan = seg.curve.getTangentAt(t);
      const n = seg.perp(t).multiplyScalar(side);
      const faceRoad = Math.atan2(-n.x, -n.z);
      jumps.set(project.slug, before(seg, t, 14));
      const step = items.indexOf(project) + 1;
      const proto = houses[((step - 1) * 3 + 1) % houses.length];
      const hx = c.x + n.x * (half + 8);
      const hz = c.z + n.z * (half + 8);
      putHouse(hx, hz, faceRoad, 7.6, proto);
      const dx = c.x + n.x * (half + 2.6);
      const dz = c.z + n.z * (half + 2.6);
      props.place(driveway, 3.0, dx, dz, faceRoad);
      // the sign stands side-on to the road so it reads as you approach
      const bx = c.x + n.x * (half + FOOTPATH + 1.2) - tan.x * 3.2;
      const bz = c.z + n.z * (half + FOOTPATH + 1.2) - tan.z * 3.2;
      {
        // every suite product hangs the same sign: a round board swinging from a bracket,
        // the bracket reaching out over the pavement toward the road
        const along = Math.atan2(-tan.x, -tan.z);
        const towardRoad = Math.cos(along) * -n.x - Math.sin(along) * -n.z > 0;
        boards.hangingSign(project, bx + n.x * 1.6, bz + n.z * 1.6, towardRoad ? along : along + Math.PI, logos.get(project.slug));
      }
      signSpots.push({ x: bx, z: bz });
      stations.push({ kind: 'project', project, accent: project.accent ?? '#d98a1f', x: c.x, z: c.z, reach: 9 });
      const ix = c.x + n.x * (half + 4.4) + tan.x * 2.2;
      const iz = c.z + n.z * (half + 4.4) + tan.z * 2.2;
      idleSpots.push({ x: ix, z: iz, facing: faceRoad });
    };
    items.filter((p) => !QUARTER.has(p.slug)).forEach((project, i) =>
      suiteHouse(road.main, project, 0.07 + i * (22 / road.main.length), i % 2 === 0 ? -1 : 1));
    // the Agent Quarter's houses stand on its outer side, clear of the loop's inside
    const outer = quarter.perp(0.5).x < 0 ? 1 : -1;
    // alternate sides, like Main Street, so one sign doesn't hide the next
    items.filter((p) => QUARTER.has(p.slug)).forEach((project, i) =>
      suiteHouse(quarter, project, 0.3 + i * 0.4, i % 2 === 0 ? outer : -outer));

    // the crossroads: an arch over the way into the Agent Quarter, as at the square, so it
    // names the street without standing in front of the signs beyond it
    {
      const c = quarter.curve.getPointAt(0.04);
      const tan = quarter.curve.getTangentAt(0.04);
      boards.streetArch('Agent Quarter', 'where agents live and work', '#2196f3', c.x, c.z, Math.atan2(-tan.x, -tan.z), 11.2);
    }

    // where the drive starts: what this place is, and how to skip it
    const c = road.main.curve.getPointAt(startT + 0.02);
    const tan = road.main.curve.getTangentAt(startT + 0.02);
    const n = road.main.perp(startT + 0.02).multiplyScalar(1);
    const sx = c.x + n.x * (half + FOOTPATH + 1.2);
    const sz = c.z + n.z * (half + FOOTPATH + 1.2);
    boards.fingerpost([
      { text: 'Main Street', accent: '#d98a1f', dir: 0 },
      { text: 'Agent Quarter', accent: '#2196f3', dir: 0 },
      { text: 'MCP Alley', accent: '#f2a707', dir: 0 },
      { text: 'The Odd Shop', accent: '#a12cf9', dir: 0 },
      { text: 'HQ', accent: '#8a5a1a', dir: 0 },
    ], sx, sz, Math.atan2(-tan.x, -tan.z));
    signSpots.push({ x: sx, z: sz });
    stations.push({
      kind: 'info', accent: '#d98a1f', x: c.x, z: c.z, reach: 7,
      info: {
        title: 'Super Jackfruit Labs',
        logo: '/brand/sjl-facet.svg',
        tagline: 'six tools for working with agents',
        lines: [
          'Drive on: Main Street holds your work — you talk, the work is planned, it remembers, you see proof. At the first bend the Agent Quarter carries straight on: where agents work (Salaam) and the machines they live on (AgentPod).',
          'Further down the road are the experiments that taught us what to build.',
        ],
        links: [
          { label: 'the suite as a page →', url: '/' },
          { label: 'run it with your team →', url: 'mailto:rakesh@superjackfruit.com' },
        ],
      },
    });
  }

  // every side-street sign its own colour, picked by name so a house keeps it from visit to visit
  const SIGN_COLOURS = ['#e4572e', '#f2a707', '#2a9d8f', '#3a86ff', '#8338ec', '#ff006e', '#6a994e', '#c1121f', '#0081a7', '#bc6c25', '#7b2cbf', '#e76f51'];
  function signColour(slug: string): string {
    let h = 0;
    for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return SIGN_COLOURS[h % SIGN_COLOURS.length];
  }

  for (const d of districts) {
    if (d.id === 'agent-works') continue; // the suite, placed above
    const street = road.get(d.id);

    // an arch over the street's entrance, as at the Agent Quarter and the square: it names the
    // street without standing in front of the signs further along the main road
    {
      const at = 4 / street.length;
      const c = street.curve.getPointAt(at);
      const tan = street.curve.getTangentAt(at);
      boards.streetArch(d.name, d.blurb, d.accent, c.x, c.z, Math.atan2(-tan.x, -tan.z), 11.2);
    }
    // a turning's arch is edge-on until you reach it, so a small, low pointer on the main road
    // says it's coming; low enough that the signs beyond it stay in view
    {
      const spec = road.junctions.find((b) => b.id === d.id)!;
      const at = spec.t - 22 / road.main.length;
      const c = road.main.curve.getPointAt(at);
      const tan = road.main.curve.getTangentAt(at);
      const n = road.main.perp(at).multiplyScalar(spec.side);
      const off = road.main.width / 2 + FOOTPATH + 0.8;
      const px = c.x + n.x * off, pz = c.z + n.z * off;
      boards.fingerpost([
        { text: d.name, accent: d.accent, dir: spec.side === 1 ? 1 : -1 },
        { text: 'HQ', accent: '#8a5a1a', dir: 0 },
      ], px, pz, Math.atan2(-tan.x, -tan.z));
      signSpots.push({ x: px, z: pz });
    }
    const items = byDistrict(d.id);
    const half = street.width / 2;

    // the sign stands beside the drive, as on Main Street, so the house sits as close as Main Street's
    const signDepth = FOOTPATH + 2.4;
    let side = 1;
    items.forEach((project, i) => {
      const proto = houses[Math.floor(rand() * houses.length)];
      const houseSize = 7.2 + rand() * 1.4;
      const dims = props.scaledSize(proto, houseSize);
      const setback = signDepth + dims.z / 2;
      const t = 0.22 + ((i + 0.5) / items.length) * 0.64;
      const c = street.curve.getPointAt(t);
      const tan = street.curve.getTangentAt(t);

      // Where two streets meet, "beside this lane" can be "in the middle of
      // that one". Try the intended side, then the other, then further back
      // from the kerb, and take the first that puts neither the board nor the
      // house on anybody's road.
      const tryside = (s: number, push: number) => {
        const n = street.perp(t).multiplyScalar(s);
        const bx = c.x + n.x * (half + FOOTPATH + 2.8 + push) - tan.x * 3.2;
        const bz = c.z + n.z * (half + FOOTPATH + 2.8 + push) - tan.z * 3.2;
        const hx = c.x + n.x * (half + setback + push);
        const hz = c.z + n.z * (half + setback + push);
        if (road.onRibbon(bx, bz, 1.2) || road.onRibbon(hx, hz, 2.5)) return null;
        return { n, push };
      };
      const spot =
        tryside(side, 0) ?? tryside(-side, 0) ?? tryside(side, 7) ?? tryside(-side, 7) ??
        { n: street.perp(t).multiplyScalar(side), push: 0 };
      const { n, push } = spot;
      const faceRoad = Math.atan2(-n.x, -n.z);

      const hx = c.x + n.x * (half + setback + push);
      const hz = c.z + n.z * (half + setback + push);
      putHouse(hx, hz, faceRoad, houseSize, proto);

      const dx = c.x + n.x * (half + 2.6 + push);
      const dz = c.z + n.z * (half + 2.6 + push);
      if (!road.onRibbon(dx, dz, 1.4)) props.place(driveway, 3.0, dx, dz, faceRoad);

      // the same sign as Main Street: a round board swinging from a bracket, side-on to the
      // road beside the drive, so it reads as you approach and leaves the house in view
      const bx = c.x + n.x * (half + FOOTPATH + 2.8 + push) - tan.x * 3.2;
      const bz = c.z + n.z * (half + FOOTPATH + 2.8 + push) - tan.z * 3.2;
      const along = Math.atan2(-tan.x, -tan.z);
      const towardRoad = Math.cos(along) * -n.x - Math.sin(along) * -n.z > 0;
      boards.hangingSign({ ...project, accent: project.accent ?? signColour(project.slug) }, bx, bz, towardRoad ? along : along + Math.PI);
      signSpots.push({ x: bx, z: bz });
      stations.push({ kind: 'project', project, accent: d.accent, x: c.x + n.x * 2, z: c.z + n.z * 2, reach: 5 });

      const ix = c.x + n.x * (half + 4.4 + push) + tan.x * 2.2;
      const iz = c.z + n.z * (half + 4.4 + push) + tan.z * 2.2;
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

  // ---------- the back streets: ordinary neighbours, gardens and trees ----------
  // Both sides of each street, every so often, kept off every street's tarmac,
  // clear of the houses already standing and inside the hedge.
  for (const seg of road.branches) {
    if (!seg.id.startsWith(BACK_STREET) || seg.length < 24) continue;
    const half = seg.width / 2;
    for (let t = 9 / seg.length; t < 1 - 9 / seg.length; t += (17 + rand() * 6) / seg.length) {
      const c = seg.curve.getPointAt(t);
      const tan = seg.curve.getTangentAt(t);
      for (const sd of [1, -1]) {
        const n = seg.perp(t).multiplyScalar(sd);
        const faceRoad = Math.atan2(-n.x, -n.z);
        const hx = c.x + n.x * (half + 7.6);
        const hz = c.z + n.z * (half + 7.6);
        const inside = Math.abs(hx) < 140 && hz > Z_END - 18 && hz < Z_START + 14;
        if (rand() < 0.82 && inside && !road.onRibbon(hx, hz, 3.2) && clearOfHouses(hx, hz, 12)) {
          putHouse(hx, hz, faceRoad, 6.6 + rand() * 1.8);
          const dx = c.x + n.x * (half + 2.6);
          const dz = c.z + n.z * (half + 2.6);
          if (rand() < 0.5 && !road.onRibbon(dx, dz, 1.4)) props.place(driveway, 3.0, dx, dz, faceRoad);
          const ix = c.x + n.x * (half + 4.4) + tan.x * 2.4;
          const iz = c.z + n.z * (half + 4.4) + tan.z * 2.4;
          if (rand() < 0.25 && !road.onRibbon(ix, iz, 1)) idleSpots.push({ x: ix, z: iz, facing: faceRoad });
        } else if (inside && !road.onRibbon(hx, hz, 3) && clearOfHouses(hx, hz, 7)) {
          // an empty plot: a garden tree, and a bush by the pavement
          seasonalTree(Math.floor(rand() * 100), 2.8 + rand() * 1.6, hx, hz, rand() * 6.28);
        }
        // a garden between this house and the next
        const gx = c.x + n.x * (half + 5.2) + tan.x * 8.5;
        const gz = c.z + n.z * (half + 5.2) + tan.z * 8.5;
        if (rand() < 0.5 && !road.onRibbon(gx, gz, 1.2) && clearOfHouses(gx, gz, 5)) {
          props.place(bushes[Math.floor(rand() * bushes.length)], 1.1 + rand() * 0.7, gx, gz, rand() * 6.28, false, 0.02);
        }
      }
    }
  }

  // the middles of the blocks: back gardens, a tree or two in each
  {
    const blocks = [[-135, -35, 35, -305], [35, 135, 35, -85], [45, 135, -165, -305]];
    const wanted = Math.round(quality.settings.bgTrees * 0.6);
    for (let i = 0, tries = 0; i < wanted && tries < wanted * 12; tries++) {
      const [x0, x1, z0, z1] = blocks[tries % blocks.length];
      const x = x0 + rand() * (x1 - x0);
      const z = z1 + rand() * (z0 - z1);
      const d = road.distTo(x, z);
      if (d < 10.5 || d > 26 || road.onRibbon(x, z, 3) || !clearOfHouses(x, z, 8)) continue;
      seasonalTree(Math.floor(rand() * 100), 2.6 + rand() * 2.2, x, z, rand() * 6.28);
      i++;
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
    // the road lays the square's kerb and footpath ring; the paving goes inside it
    return { x: road.main.end.x, z: road.main.end.z, n: dir, c };
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

    // the lab's sign spans the road where it opens into the square
    const hqx = plaza.c.x;
    jumps.set('hq', before(road.main, 1, 16));
    const hqz = plaza.c.z;
    // the lab's own sign: its mark, and wide enough that the name isn't squeezed
    const mark = await new Promise<HTMLImageElement | undefined>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(undefined);
      img.src = '/brand/sjl-facet.svg'; // the Facet mark
    });
    // the lab's stone stands in the middle of the square, plaque toward the road
    boards.monument('Super Jackfruit Labs', 'agent-native tools, built in the open', plaza.x, plaza.z, faceP + Math.PI, mark);
    stations.push({
      kind: 'info', accent: '#d98a1f', x: hqx, z: hqz,
      info: {
        title: 'Super Jackfruit Labs',
        logo: '/brand/sjl-facet.svg',
        tagline: 'agent-native tools, built in the open',
        lines: [
          'The first street is the suite: six tools that carry a task from ask to proof.',
          'The other streets hold the experiments that taught us what to build.',
        ],
        links: [
          { label: 'the suite as a page →', url: '/' },
          { label: 'run it with your team →', url: 'mailto:rakesh@superjackfruit.com' },
        ],
      },
    });

    // the A-board stands out front of HQ, to one side of its door, the way a shop puts one out
    const hqDepth = props.scaledSize(houses[7], 13).z;
    const front = 18 - hqDepth / 2 - 1.6;
    const kx = plaza.x + plaza.n.x * front - plaza.n.z * 3.2;
    const kz = plaza.z + plaza.n.z * front + plaza.n.x * 3.2;
    const faceK = faceP;
    // the lab's flag flies from its roof: the mark alone, no words
    const hqTop = props.scaledSize(houses[7], 13).y;
    boards.flag(
      { name: 'Super Jackfruit Labs', slug: 'sjl', tagline: '', accent: '#d98a1f' } as Project,
      plaza.x + plaza.n.x * 18,
      plaza.z + plaza.n.z * 18,
      faceP + Math.PI,
      mark,
      { baseY: hqTop - 0.3, emblem: true }
    );
    boards.chalkboard('say hi', ['the lab is always open', 'everything here is', 'open source', 'come and wave'], kx, kz, faceK);
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

  // ---------- Captain Jack's house: the nearest neighbour to HQ ----------
  // Pull up outside and the card offers a talk with him: the frame's own Captain Jack sheet,
  // opened through its sjl-ask event, the same as "Ask Captain Jack" anywhere on the site.
  {
    const hqX = plaza.x + plaza.n.x * 18;
    const hqZ = plaza.z + plaza.n.z * 18;
    const home = houseBoxes
      .filter((h) => Math.hypot(h.x - hqX, h.z - hqZ) > 4)
      .sort((a, b) => Math.hypot(a.x - plaza.x, a.z - plaza.z) - Math.hypot(b.x - plaza.x, b.z - plaza.z))[0];
    if (home) {
      const fx = Math.sin(home.facing);
      const fz = Math.cos(home.facing);
      // out front of the door, at the pavement
      const sx = home.x + fx * (home.hz + 2.2);
      const sz = home.z + fz * (home.hz + 2.2);
      const portrait = await new Promise<HTMLImageElement | undefined>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(undefined);
        img.src = '/brand/captain-jack.svg';
      });
      // at the kerb in front of his house, like the suite's signs on Main Street: face side-on
      // to the road, bracket reaching out toward it
      let bestT = 0;
      for (let i = 0, bestD = Infinity; i <= 400; i++) {
        const p = road.main.curve.getPointAt(i / 400);
        const d = Math.hypot(p.x - home.x, p.z - home.z);
        if (d < bestD) [bestD, bestT] = [d, i / 400];
      }
      {
        const c = road.main.curve.getPointAt(bestT);
        const tan = road.main.curve.getTangentAt(bestT);
        const side = Math.sign(road.main.perp(bestT).x * (home.x - c.x) + road.main.perp(bestT).z * (home.z - c.z)) || 1;
        const n = road.main.perp(bestT).multiplyScalar(side);
        const half = road.main.width / 2;
        const bx = c.x + n.x * (half + FOOTPATH + 1.2 + 1.6);
        const bz = c.z + n.z * (half + FOOTPATH + 1.2 + 1.6);
        const along = Math.atan2(-tan.x, -tan.z);
        const towardRoad = Math.cos(along) * -n.x - Math.sin(along) * -n.z > 0;
        boards.hangingSign(
          { name: 'Captain Jack', slug: 'captain-jack', tagline: "the lab's guide — come and ask", accent: '#173d83' } as Project,
          bx, bz, towardRoad ? along : along + Math.PI, portrait
        );
      }
      jumps.set('captain-jack', before(road.main, bestT, 14));
      stations.push({
        kind: 'info', accent: '#173d83', x: sx, z: sz, reach: 8,
        info: {
          title: 'Captain Jack',
          logo: '/brand/captain-jack.svg',
          tagline: "the lab's guide",
          lines: ["This is Captain Jack's house. Ask him anything about the lab and its tools. He's a character; an AI writes his answers."],
          links: [{ label: 'talk to Captain Jack →', url: '#captain-jack' }],
        },
      });
    }
  }

  // ---------- bunting: strings of the suite's colours across every street, well spaced ----------
  {
    const colours = byDistrict('agent-works').map((p) => p.accent ?? '#d98a1f');
    const gap = 46;
    for (const seg of road.all) {
      if (seg.id.startsWith(BACK_STREET)) continue; // the named streets are the ones dressed up
      const half = seg.width / 2;
      for (let d = 30; d < seg.length - 12; d += gap) {
        const t = d / seg.length;
        const c = seg.curve.getPointAt(t);
        const n = seg.perp(t);
        const w = half + FOOTPATH + 0.4;
        const a = { x: c.x + n.x * w, z: c.z + n.z * w };
        const b = { x: c.x - n.x * w, z: c.z - n.z * w };
        // keep the poles off junctions, signs and houses
        if (road.onRibbon(a.x, a.z, 0.2) || road.onRibbon(b.x, b.z, 0.2)) continue;
        if (!clearOfHouses(a.x, a.z, 4.5) || !clearOfHouses(b.x, b.z, 4.5)) continue;
        boards.bunting(a.x, a.z, b.x, b.z, colours);
      }
    }
  }

  // ---------- the woods ----------
  // The empty ground between the streets grows woods: clumps rather than an even
  // sprinkle, spruce thick in the middle of a clump and oaks thinning out at its
  // edge, a dead tree now and then, and boulders half sunk among the trunks.
  // The spruce stay green in autumn; the oaks turn.
  {
    const groves: Array<{ x: number; z: number; r: number }> = [];
    for (let tries = 0; groves.length < 26 && tries < 900; tries++) {
      const x = (rand() - 0.5) * 290;
      const z = Z_END - 20 + rand() * (Z_START - Z_END + 40);
      const r = 14 + rand() * 18;
      if (road.distTo(x, z) < 20 + r * 0.3) continue;
      if (Math.hypot(x - plaza.x, z - plaza.z) < 34) continue;
      if (!clearOfHouses(x, z, 16)) continue;
      if (groves.some((g) => Math.hypot(g.x - x, g.z - z) < (g.r + r) * 0.7)) continue;
      groves.push({ x, z, r });
    }
    const perGrove = Math.ceil(quality.settings.forestTrees / Math.max(1, groves.length));
    for (const g of groves) {
      for (let i = 0; i < perGrove; i++) {
        // denser toward the middle
        const d = Math.sqrt(rand()) * g.r;
        const a = rand() * Math.PI * 2;
        const x = g.x + Math.cos(a) * d;
        const z = g.z + Math.sin(a) * d;
        if (road.distTo(x, z) < 11 || !clearOfHouses(x, z, 9)) continue;
        if (x < -148 || x > 148) continue;
        const edge = d / g.r;
        const rot = rand() * 6.28;
        const pick = rand();
        if (pick < 0.04) {
          props.place(deadTrees[Math.floor(rand() * deadTrees.length)], 2 + rand() * 2, x, z, rot, 'trunk');
        } else if (edge > 0.6 ? pick < 0.75 : pick < 0.25) {
          const k = Math.floor(rand() * oaks.length);
          props.placeSeasonalTree(oaks[k], fallOaks[k], 4 + rand() * 4, x, z, rot);
        } else {
          const s = spruces[Math.floor(rand() * spruces.length)];
          props.placeSeasonalTree(s, s, 2.6 + rand() * 2.6, x, z, rot);
        }
      }
      // a boulder or two, and loose stones
      for (let i = 0; i < 1 + Math.floor(rand() * 2); i++) {
        const x = g.x + (rand() - 0.5) * g.r;
        const z = g.z + (rand() - 0.5) * g.r;
        if (road.distTo(x, z) > 12 && clearOfHouses(x, z, 9)) props.place(bigRocks[Math.floor(rand() * bigRocks.length)], 3 + rand() * 3, x, z, rand() * 6.28, 'box');
      }
      for (let i = 0; i < 4; i++) {
        const x = g.x + (rand() - 0.5) * g.r * 1.6;
        const z = g.z + (rand() - 0.5) * g.r * 1.6;
        if (road.distTo(x, z) > 9) props.place(forestRocks[Math.floor(rand() * forestRocks.length)], 0.6 + rand() * 1.2, x, z, rand() * 6.28);
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
  // the drivable area: everything built plus a margin, so the hedge round it never meets a
  // house, the square or a turning circle
  const bounds = { minX: -150, maxX: 150, minZ: Z_END - 28, maxZ: Z_START + 22 };
  // a hedge just past the edge of the drivable area, so the car stops against something
  {
    const out = 1.8, step = 1.9;
    const hedge = (x: number, z: number) =>
      props.place(bushes[1], 2.2 + rand() * 0.5, x, z, rand() * 6.28, false, 0.015);
    for (let x = bounds.minX - out; x <= bounds.maxX + out; x += step) {
      hedge(x, bounds.minZ - out);
      hedge(x, bounds.maxZ + out);
    }
    for (let z = bounds.minZ - out + step; z < bounds.maxZ + out; z += step) {
      hedge(bounds.minX - out, z);
      hedge(bounds.maxX + out, z);
    }
  }
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
  const traffic = await createTraffic(THREE, scene, props.loadGltf, road, quality.settings.traffic, quality.settings.shadows);
  mark('traffic');
  const ambient = createAmbient(THREE, scene, chimneys, quality.settings.birds, rand);

  let carChoice = loadChoice();
  const car = await createCar(THREE, props.loadGltf, scene, carChoice);
  {
    const p = road.main.curve.getPointAt(startT);
    const tan = road.main.curve.getTangentAt(startT);
    car.teleport(p.x, p.z, Math.atan2(tan.x, tan.z));
  }
  const startJump = before(road.main, startT, 0);
  // a jump leaves the old neighbourhood behind: everyone pooled is placed round the new spot
  const teleport = (x: number, z: number, h: number): void => {
    car.teleport(x, z, h);
    npcs.reseed();
    traffic.reseed();
  };
  mark('car');
  const audio = createAudio();
  audio.setEngine(car.spec.engine);
  // the other cars and the chatting neighbours, in 3D; a smaller pool of voices on a weaker device
  const low = quality.settings.tier === 'low';
  const spatial = createSpatialAudio(audio, { motors: low ? 3 : 5, talk: low ? 1 : 2 });
  const listener = { x: 0, y: 0, z: 0, fx: 0, fz: 1 };
  const input = createInput(canvas, audio.ensure);

  // ---------- the garage: the menu picks, C cycles ----------
  const chooseCar = (next: CarChoice): void => {
    carChoice = next;
    saveChoice(next);
    void car.choose(next).then(() => audio.setEngine(car.spec.engine));
    window.dispatchEvent(new CustomEvent('village:car-chosen', { detail: next }));
  };
  window.addEventListener('village:car', ((e: CustomEvent<CarChoice>) => chooseCar(e.detail)) as EventListener);
  window.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'c') return;
    const i = CARS.findIndex((c) => c.id === carChoice.car);
    chooseCar({ car: CARS[(i + 1) % CARS.length].id, paint: 0 });
  });
  window.dispatchEvent(new CustomEvent('village:car-chosen', { detail: carChoice }));
  const fx = createFx(THREE, scene);

  // ---------- page wiring ----------
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') audio.toggleMute();
  });
  // desktop shortcuts for getting around: 1–6 the suite in order, H the lab, R the start
  if (!(window.matchMedia?.('(pointer: coarse)').matches ?? false)) {
    const ORDER = ['supermessage', 'superpipeline', 'superlibrary', 'superwitness', 'salaam', 'agentpod'];
    window.addEventListener('keydown', (e) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const to = /^[1-6]$/.test(k) ? jumps.get(ORDER[+k - 1]) : k === 'h' ? jumps.get('hq') : k === 'r' ? startJump : undefined;
      if (to) teleport(to.x, to.z, to.h);
    });
  }
  // the menu's places list: drive straight to one
  window.addEventListener('village:jump', ((e: CustomEvent<string>) => {
    const to = e.detail === 'start' ? startJump : jumps.get(e.detail);
    if (to) teleport(to.x, to.z, to.h);
  }) as EventListener);
  window.addEventListener('village:volume', ((e: CustomEvent<{ bus: 'music' | 'sound'; level: number }>) => {
    if (e.detail.bus === 'music' || e.detail.bus === 'sound') audio.setVolume(e.detail.bus, e.detail.level);
  }) as EventListener);
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
    window.dispatchEvent(new CustomEvent('village:visited', { detail: { count: visited.size, total: suiteSlugs.length, slugs: [...visited] } }));
  }, 500);

  // ---------- the minimap ----------
  // the suite's houses in their colours, the lab's square and Captain Jack's house
  const mapCanvas = document.getElementById('minimap-canvas');
  const minimap = mapCanvas instanceof HTMLCanvasElement
    ? createMinimap(mapCanvas, road, bounds, [
      ...stations
        .filter((st) => st.kind === 'project' && st.project && suiteSlugs.includes(st.project.slug))
        .map((st) => ({ x: st.x, z: st.z, color: st.project!.accent ?? st.accent, slug: st.project!.slug, kind: 'suite' as const })),
      { x: plaza.x, z: plaza.z, color: '#8a5a1a', kind: 'hq' as const },
      ...stations
        .filter((st) => st.info?.title === 'Captain Jack')
        .map((st) => ({ x: st.x, z: st.z, color: st.accent, kind: 'guide' as const })),
    ], () => visited)
    : null;

  // ---------- driving surface ----------
  // the asphalt and the paved square are smooth; everything else is dirt
  const PAVED_MARGIN = 0.6;
  const offRoad = (x: number, z: number): boolean =>
    !road.isPaved(x, z, PAVED_MARGIN) && Math.hypot(x - plaza.x, z - plaza.z) > PLAZA_R;

  const carCtx = {
    // the world, then the other cars: either can knock the car back
    resolve: (pos: import('three').Vector3, radius: number) => {
      const a = props.resolve(pos, radius);
      const b = traffic.resolve(pos, radius);
      return { x: a.x + b.x, z: a.z + b.z, depth: Math.max(a.depth, b.depth) };
    },
    offRoad,
    bounds,
  };

  // ---------- loop ----------
  let activeStation: Station | null = null;
  const startFwd = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
  const camPos = car.root.position.clone().addScaledVector(startFwd, -8.4).setY(4.1);
  const camTarget = car.root.position.clone().addScaledVector(startFwd, 4.5).setY(1.3);
  const fwd = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  // the chase camera's mount and look point, as offsets from the car
  const CAM_RATE = 2.6;
  const LOOK_RATE = 4.5;
  const camOffset = camPos.clone().sub(car.root.position);
  const lookOffset = camTarget.clone().sub(car.root.position);
  camera.position.copy(camPos);

  // Compile every shader before the first frame: left to the first render,
  // it stalled the page for seconds right as the visitor pressed a key.
  camera.lookAt(camTarget);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  mark('compile');

  // what the camera can see, for the pooled actors: they only come and go off-screen
  const frustum = new THREE.Frustum();
  const projScreen = new THREE.Matrix4();
  const viewSphere = new THREE.Sphere();
  const inView = (x: number, z: number, r: number): boolean => {
    // past the fog's far edge nothing can be seen, frustum or not
    if (Math.hypot(x - camera.position.x, z - camera.position.z) - r > 150) return false;
    viewSphere.center.set(x, 1, z);
    viewSphere.radius = r;
    return frustum.intersectsSphere(viewSphere);
  };

  const trafficPlayer = { x: 0, z: 0, heading: 0, speed: 0 };

  // reduced motion stills the village's own motion; this clock stops while it's on, so
  // the signs, trees, birds and smoke hold where they are instead of snapping back
  const motion = createMotion();
  let ambientT = 0;

  const timer = new THREE.Timer();
  let framesTimed = 0;
  const sceneEl = canvas.closest<HTMLElement>('.scene');
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
    const still = motion.reduced;
    const ambientDt = still ? 0 : dt;
    ambientT += ambientDt;
    const targetFov = still ? 50 : 50 + 8 * Math.max(0, (car.speed - 11 * 0.7) / (18 - 11 * 0.7));
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }

    const nightFactor = env.update(dt);
    lamps.update(nightFactor, car.root.position.x, car.root.position.z);
    boards.applyNight(nightFactor);
    boards.tick(ambientT);
    // the page's own chrome (the station card) goes dark with the village
    const night = sceneEl?.dataset.night === 'true' ? nightFactor > 0.45 : nightFactor > 0.55;
    if (sceneEl && String(night) !== sceneEl.dataset.night) sceneEl.dataset.night = String(night);
    for (const m of windowMats) m.emissiveIntensity = nightFactor * 1.6;
    car.applyNight(nightFactor);

    props.updateSway(ambientT);
    props.updateCulling(camera.position.x, camera.position.z);
    // last frame's view is close enough to tell what's on screen
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreen);
    npcs.update(dt, car.root.position.x, car.root.position.z, car.heading, inView);
    trafficPlayer.x = car.root.position.x;
    trafficPlayer.z = car.root.position.z;
    trafficPlayer.heading = car.heading;
    trafficPlayer.speed = car.speed;
    traffic.update(dt, trafficPlayer, inView, still);
    traffic.applyNight(nightFactor);
    ambient.update(ambientDt, ambientT, nightFactor);
    for (const cloud of clouds) {
      cloud.position.x += ambientDt * 0.6;
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
        window.dispatchEvent(new CustomEvent('village:visited', { detail: { count: visited.size, total: suiteSlugs.length, slugs: [...visited] } }));
        if (visited.size === suiteSlugs.length) fx.celebrate(plaza.x, plaza.z);
      }
    }

    fx.update(dt, nightFactor, car.root.position.x, car.root.position.z, car.heading);
    minimap?.update(car.root.position.x, car.root.position.z, car.heading, night, traffic.cars(), !still);

    // chase camera: sits behind the car's heading, lags softly into corners,
    // and looks ahead of the car rather than at it.
    // The lag is eased on the camera's offset FROM the car, not on its place in
    // the world. A world-space follower trails by speed × dt per frame, so with
    // uneven frame times it surged back and forth behind the car; relative to
    // the car a steady drive holds the camera still and only turns are eased.
    // The old follower's pull-back at speed (speed / rate behind the mount, and
    // the look point the same way) is put back in explicitly, so the framing
    // at any speed is what it was.
    fwd.set(Math.sin(car.heading), 0, Math.cos(car.heading));
    const along = Math.max(0, car.speed);
    desiredCam.copy(fwd).multiplyScalar(-(8.4 + along / CAM_RATE));
    desiredCam.y = 4.1;
    camOffset.lerp(desiredCam, 1 - Math.exp(-dt * CAM_RATE));
    camPos.copy(car.root.position).add(camOffset);
    camera.position.copy(camPos);
    if (car.shake > 0.001 && !still) {
      // a knock rattles the mount, not the car
      const s = car.shake * 0.14;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    desiredTarget.copy(fwd).multiplyScalar(4.5 - along / LOOK_RATE);
    desiredTarget.y = 1.3;
    lookOffset.lerp(desiredTarget, 1 - Math.exp(-dt * LOOK_RATE));
    camTarget.copy(car.root.position).add(lookOffset);
    camera.lookAt(camTarget);
    env.follow(camera.position, car.root.position);
    listener.x = camera.position.x;
    listener.y = camera.position.y;
    listener.z = camera.position.z;
    {
      const lx = camTarget.x - camera.position.x;
      const lz = camTarget.z - camera.position.z;
      const len = Math.hypot(lx, lz) || 1;
      listener.fx = lx / len;
      listener.fz = lz / len;
    }
    spatial.update(dt, listener, traffic.cars(), npcs.conversations);

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
    drawCalls: () => ({ instanced: props.drawCallCount(), frame: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    pos: () => ({
      x: +car.root.position.x.toFixed(2),
      z: +car.root.position.z.toFixed(2),
      speed: +car.speed.toFixed(2),
    }),
    stations: () => stations.map((s) => ({ slug: s.project?.slug ?? s.info?.title ?? '?', x: +s.x.toFixed(1), z: +s.z.toFixed(1) })),
    colliders: () => props.colliderCount(),
    timings: () => timings,
    npcs: () => npcs.list(),
    chats: () => npcs.conversations(),
    sound: () => ({ ...spatial.counts(), levels: audio.levels() }),
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
        // any solid part of a sign inside a house's footprint
        signsInHouses: signSolids.filter((sg) => houseBoxes.some((h) => {
          const dx = sg.x - h.x, dz = sg.z - h.z;
          const lx = Math.cos(h.facing) * dx - Math.sin(h.facing) * dz;
          const lz = Math.sin(h.facing) * dx + Math.cos(h.facing) * dz;
          const r = Math.max(sg.hx, sg.hz);
          return Math.abs(lx) < h.hx + r && Math.abs(lz) < h.hz + r;
        })).map((sg) => ({ x: +sg.x.toFixed(1), z: +sg.z.toFixed(1) })),
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
    teleport: (x: number, z: number, h = Math.PI) => teleport(x, z, h),
    pool: () => ({ walkers: npcs.poolStats() }),
    motion: () => ({ reduced: motion.reduced, ambientT: +ambientT.toFixed(2), fov: +camera.fov.toFixed(1) }),
    traffic: () => traffic.debug(),
    fx: () => fx.counts(),
  };

  return true;
}
