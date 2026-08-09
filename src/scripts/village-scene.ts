// "Lab by day" village — Summer Afternoon-inspired third-person stroll.
// Assets: Kenney City Kit Suburban + Nature Kit (CC0), KayKit Adventurers
// character (CC0). Each project from the lab's data gets a house and a
// curbside signboard; walking up to one raises the info card in the DOM.

import { projects, districts, byDistrict, type Project, type District } from '../data/projects';

export async function initVillageScene(canvas: HTMLCanvasElement): Promise<boolean> {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return false;

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  await Promise.all([
    document.fonts.load('700 90px "Inconsolata Variable"'),
    document.fonts.load('44px "Inconsolata Variable"'),
  ]).catch(() => {});

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdfe9ef, 55, 150);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);

  // ---------- golden-hour sky ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(1.0, 0.85, 0.66) },
      uMid: { value: new THREE.Color(0.66, 0.85, 0.96) },
      uZenith: { value: new THREE.Color(0.38, 0.66, 0.9) },
      uGlowColor: { value: new THREE.Color(0.35, 0.2, 0.05) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.4).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uMid;
      uniform vec3 uZenith;
      uniform vec3 uGlowColor;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.28, 0.85, h));
        float sunGlow = pow(max(dot(normalize(vDir), uSunDir), 0.0), 6.0);
        col += uGlowColor * sunGlow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), skyMat);
  scene.add(skyDome);

  // stars, revealed at night
  const starGeo = new THREE.BufferGeometry();
  {
    const pts = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      const az = Math.random() * Math.PI * 2;
      const el = Math.asin(Math.random() * 0.9 + 0.08);
      const r = 310;
      pts[i * 3] = Math.cos(el) * Math.cos(az) * r;
      pts[i * 3 + 1] = Math.sin(el) * r;
      pts[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
  const stars = new THREE.Points(starGeo, starMat);
  skyDome.add(stars);

  // ---------- light ----------
  const sun = new THREE.DirectionalLight(0xffe2b0, 3.4);
  sun.position.set(18, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0xd8c090, 1.25);
  scene.add(hemi);

  // ---------- environment presets (time of day) ----------
  interface EnvPreset {
    horizon: number[]; mid: number[]; zenith: number[]; glow: number[];
    sunDir: number[]; sunColor: number; sunIntensity: number;
    hemiSky: number; hemiGround: number; hemiIntensity: number;
    fog: number; exposure: number; night: number;
  }
  const TIME_PRESETS: Record<string, EnvPreset> = {
    dawn: {
      horizon: [1.0, 0.78, 0.75], mid: [0.95, 0.85, 0.8], zenith: [0.5, 0.62, 0.82],
      glow: [0.4, 0.2, 0.12], sunDir: [0.8, 0.18, 0.3],
      sunColor: 0xffd4ae, sunIntensity: 2.2, hemiSky: 0xe8e0ff, hemiGround: 0xbfae90, hemiIntensity: 1.05,
      fog: 0xefe2e2, exposure: 1.05, night: 0,
    },
    day: {
      horizon: [0.87, 0.94, 1.0], mid: [0.62, 0.82, 0.96], zenith: [0.29, 0.56, 0.85],
      glow: [0.22, 0.2, 0.12], sunDir: [0.35, 0.75, 0.25],
      sunColor: 0xfff6e0, sunIntensity: 3.4, hemiSky: 0xcfe8ff, hemiGround: 0xcfc0a0, hemiIntensity: 1.4,
      fog: 0xdfeaf2, exposure: 1.15, night: 0,
    },
    dusk: {
      horizon: [1.0, 0.85, 0.66], mid: [0.66, 0.85, 0.96], zenith: [0.38, 0.66, 0.9],
      glow: [0.35, 0.2, 0.05], sunDir: [0.5, 0.35, 0.4],
      sunColor: 0xffe2b0, sunIntensity: 3.2, hemiSky: 0xbfe0ff, hemiGround: 0xd8c090, hemiIntensity: 1.25,
      fog: 0xdfe9ef, exposure: 1.18, night: 0,
    },
    night: {
      horizon: [0.1, 0.13, 0.24], mid: [0.05, 0.08, 0.18], zenith: [0.02, 0.03, 0.09],
      glow: [0.1, 0.12, 0.2], sunDir: [-0.4, 0.5, -0.3],
      sunColor: 0xa9c0e8, sunIntensity: 0.75, hemiSky: 0x2a3a58, hemiGround: 0x1a2030, hemiIntensity: 0.55,
      fog: 0x0e1424, exposure: 1.0, night: 1,
    },
  };
  let envTarget = TIME_PRESETS.dusk;
  let nightFactor = 0;
  const envState = {
    horizon: new THREE.Color().fromArray(TIME_PRESETS.dusk.horizon),
    mid: new THREE.Color().fromArray(TIME_PRESETS.dusk.mid),
    zenith: new THREE.Color().fromArray(TIME_PRESETS.dusk.zenith),
    glow: new THREE.Color().fromArray(TIME_PRESETS.dusk.glow),
    sunDir: new THREE.Vector3().fromArray(TIME_PRESETS.dusk.sunDir).normalize(),
    sunColor: new THREE.Color(TIME_PRESETS.dusk.sunColor),
    sunIntensity: 3.2,
    hemiSky: new THREE.Color(TIME_PRESETS.dusk.hemiSky),
    hemiGround: new THREE.Color(TIME_PRESETS.dusk.hemiGround),
    hemiIntensity: 1.25,
    fog: new THREE.Color(TIME_PRESETS.dusk.fog),
    exposure: 1.18,
  };
  const nightGlowMats: import('three').MeshLambertMaterial[] = [];

  window.addEventListener('village:time', ((e: CustomEvent<string>) => {
    if (TIME_PRESETS[e.detail]) envTarget = TIME_PRESETS[e.detail];
  }) as EventListener);

  // ---------- deterministic layout randomness ----------
  let seed = 20260809;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // ---------- street geometry ----------
  const Z_START = 14;
  const Z_END = -252;
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9fc178 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (Z_START + Z_END) / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, Z_START - Z_END + 30),
    new THREE.MeshLambertMaterial({ color: 0xb5b8bf })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, (Z_START + Z_END) / 2);
  road.receiveShadow = true;
  scene.add(road);

  for (let z = Z_END - 6; z < Z_START + 8; z += 6) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xf2efe6 })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    scene.add(dash);
  }

  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, Z_START - Z_END + 30),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c4 })
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(side * 4.1, 0.025, (Z_START + Z_END) / 2);
    walk.receiveShadow = true;
    scene.add(walk);
  }

  // ---------- asset loading ----------
  const loader = new GLTFLoader();
  const cache = new Map<string, import('three').Group>();

  async function loadAsset(name: string): Promise<import('three').Group> {
    if (!cache.has(name)) {
      const gltf = await loader.loadAsync(`/assets/village/${name}.glb`);
      const g = gltf.scene;
      g.traverse((o) => {
        const mesh = o as import('three').Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // glTF defaults metallicFactor to 1; with no env map that renders
          // black. This art style has no metal — force dielectric.
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const std = m as import('three').MeshStandardMaterial;
            if ('metalness' in std) {
              std.metalness = 0;
              std.roughness = Math.max(0.85, std.roughness ?? 1);
            }
          }
        }
      });
      cache.set(name, g);
    }
    return cache.get(name)!;
  }

  // ---------- colliders + sway ----------
  interface ColliderBox {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }
  const colliders: ColliderBox[] = [];
  const swayers: Array<{ obj: import('three').Object3D; phase: number; amp: number; rate: number }> = [];

  function place(
    proto: import('three').Group,
    targetSize: number,
    x: number,
    z: number,
    rotY: number,
    solid: 'box' | 'trunk' | false = false,
    sway = 0
  ): import('three').Object3D {
    const inst = proto.clone(true);
    const box = new THREE.Box3().setFromObject(inst);
    const dims = box.getSize(new THREE.Vector3());
    const current = Math.max(dims.x, dims.z) || 1;
    const s = targetSize / current;
    inst.scale.setScalar(s);
    inst.position.set(x, -box.min.y * s, z);
    inst.rotation.y = rotY;
    scene.add(inst);
    if (solid === 'box') {
      const wb = new THREE.Box3().setFromObject(inst);
      colliders.push({ minX: wb.min.x, maxX: wb.max.x, minZ: wb.min.z, maxZ: wb.max.z });
    } else if (solid === 'trunk') {
      colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45 });
    }
    if (sway > 0) {
      swayers.push({ obj: inst, phase: rand() * 6.28, amp: sway, rate: 0.7 + rand() * 0.7 });
    }
    return inst;
  }

  const [houses, driveway, fence, planter, kTreeLarge, kTreeSmall, flowers, bushes, rocks, nTrees, fallTrees] =
    await Promise.all([
      Promise.all(['building-type-a', 'building-type-c', 'building-type-e', 'building-type-g', 'building-type-h', 'building-type-j', 'building-type-m', 'building-type-q'].map(loadAsset)),
      loadAsset('driveway-short'),
      loadAsset('fence-1x3'),
      loadAsset('planter'),
      loadAsset('tree-large'),
      loadAsset('tree-small'),
      Promise.all(['flower_purpleA', 'flower_redA', 'flower_yellowA'].map(loadAsset)),
      Promise.all(['plant_bush', 'plant_bushLarge'].map(loadAsset)),
      Promise.all(['rock_smallA', 'rock_smallC'].map(loadAsset)),
      Promise.all(['tree_default', 'tree_detailed', 'tree_oak'].map(loadAsset)),
      Promise.all(['tree_default_fall', 'tree_detailed_fall', 'tree_oak_fall'].map(loadAsset)),
    ]);

  // seasonal tree pairs: summer + autumn variants share a spot, one visible
  const seasonPairs: Array<{ summer: import('three').Object3D; autumn: import('three').Object3D }> = [];
  let season: 'summer' | 'autumn' = 'summer';
  function placeSeasonalTree(i: number, size: number, x: number, z: number, rotY: number): void {
    const su = place(nTrees[i % nTrees.length], size, x, z, rotY, 'trunk', 0.01);
    const au = place(fallTrees[i % fallTrees.length], size, x, z, rotY, false, 0.01);
    au.visible = false;
    seasonPairs.push({ summer: su, autumn: au });
  }
  window.addEventListener('village:season', ((e: CustomEvent<string>) => {
    season = e.detail === 'autumn' ? 'autumn' : 'summer';
    for (const pr of seasonPairs) {
      pr.summer.visible = season === 'summer';
      pr.autumn.visible = season === 'autumn';
    }
    groundMat.color.set(season === 'autumn' ? 0xb3a068 : 0x9fc178);
  }) as EventListener);

  // ---------- signboards ----------
  const boardWood = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const cream = '#f6f0e2';
  const inkText = '#2c2a26';

  function makeBoardTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 640, h = 360): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function statusDotColor(status: string): string {
    return status === 'stable' ? '#3f9e3f' : status === 'wip' ? '#d98a1f' : '#8a5fc9';
  }

  function makeProjectBoard(project: Project, accent: string, x: number, z: number, facing: number): void {
    const group = new THREE.Group();
    const tex = makeBoardTexture((ctx, w, h) => {
      ctx.fillStyle = cream;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 14;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = inkText;
      ctx.font = '700 68px "Inconsolata Variable", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(project.name, w / 2, 120, w - 80);
      ctx.font = '38px "Inconsolata Variable", monospace';
      ctx.fillStyle = 'rgba(44,42,38,0.75)';
      ctx.fillText(project.tagline, w / 2, 190, w - 80);
      ctx.fillStyle = statusDotColor(project.status);
      ctx.beginPath();
      ctx.arc(w / 2 - 90, 265, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(44,42,38,0.6)';
      ctx.font = '34px "Inconsolata Variable", monospace';
      ctx.fillText(project.status, w / 2 + 20, 277);
    });
    const panelMat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0x000000 });
    nightGlowMats.push(panelMat);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.07), panelMat);
    panel.position.y = 1.45;
    panel.castShadow = true;
    const backing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.17, 0.06), boardWood);
    backing.position.set(0, 1.45, -0.045);
    backing.castShadow = true;
    for (const px of [-0.8, 0.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.09), boardWood);
      // fully behind the backing board — a coplanar post face z-fights the facia
      post.position.set(px, 0.72, -0.125);
      post.castShadow = true;
      group.add(post);
    }
    group.add(panel, backing);
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    scene.add(group);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.25, maxZ: z + 0.25 });
  }

  function makeDistrictBoard(d: District, z: number): void {
    const tex = makeBoardTexture((ctx, w, h) => {
      ctx.fillStyle = d.accent;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '700 74px "Inconsolata Variable", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), w / 2, 150, w - 60);
      ctx.font = '40px "Inconsolata Variable", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(d.blurb, w / 2, 235, w - 60);
    }, 760, 300);
    const group = new THREE.Group();
    const gateMat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0x000000 });
    nightGlowMats.push(gateMat);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.15), gateMat);
    panel.position.set(0, 2.0, 0.06);
    panel.castShadow = true;
    const panelBack = panel.clone();
    panelBack.rotation.y = Math.PI;
    panelBack.position.z = -0.06;
    for (const px of [-1.3, 1.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.6, 0.11), boardWood);
      post.position.set(px, 1.3, 0);
      post.castShadow = true;
      group.add(post);
    }
    group.add(panel, panelBack);
    group.position.set(0, 0, z);
    scene.add(group);
  }

  // ---------- project stations ----------
  interface Station {
    project: Project;
    accent: string;
    x: number;
    z: number;
  }
  const stations: Station[] = [];
  {
    let z = -10;
    let side = -1;
    for (const d of districts) {
      makeDistrictBoard(d, z);
      z -= 8;
      for (const project of byDistrict(d.id)) {
        const x = side * (10 + rand() * 1.5);
        const rotY = side === 1 ? -Math.PI / 2 : Math.PI / 2;
        const house = houses[Math.floor(rand() * houses.length)];
        place(house, 7.5 + rand() * 1.8, x, z, rotY, 'box');
        place(driveway, 3.2, side * 6.4, z + 1.2, rotY);
        // face the road, tilted toward walkers arriving from the entrance
        makeProjectBoard(project, d.accent, side * 5.7, z + 3.4, side === 1 ? -Math.PI / 2 + 0.35 : Math.PI / 2 - 0.35);
        stations.push({ project, accent: d.accent, x: side * 5.7, z: z + 3.4 });

        // yard dressing
        const treeKind = rand() < 0.5 ? kTreeLarge : kTreeSmall;
        place(treeKind, 2.2 + rand() * 1.6, x + (rand() - 0.5) * 5, z - (4.8 + rand() * 2), rand() * 6.28, 'trunk', 0.012);
        if (rand() < 0.7) place(fence, 3.4, side * 6.2, z - (5 + rand() * 1.5), 0, 'box');
        if (rand() < 0.6) place(planter, 1.1, side * 5.2, z - 2.6, rotY, 'box');

        // garden cluster across the street — every house on the street is a
        // project house, so the opposite side gets greenery instead
        const gx = -side * (8.5 + rand() * 3);
        placeSeasonalTree(Math.floor(rand() * 100), 3 + rand() * 2, gx, z - rand() * 4, rand() * 6.28);
        place(bushes[Math.floor(rand() * bushes.length)], 1.2 + rand() * 0.8, gx + (rand() - 0.5) * 4, z + 1 + rand() * 3, rand() * 6.28, false, 0.02);
        if (rand() < 0.7) {
          place(flowers[Math.floor(rand() * flowers.length)], 0.6, -side * (6 + rand() * 2), z + rand() * 4, rand() * 6.28, false, 0.05);
        }

        z -= 14 + rand() * 3;
        side *= -1;
      }
      z -= 6;
    }
  }

  // flowers + bushes along the sidewalks
  for (let z = Z_END + 6; z < Z_START; z += 3.5 + rand() * 3) {
    for (const side of [-1, 1]) {
      if (rand() < 0.55) {
        const f = flowers[Math.floor(rand() * flowers.length)];
        place(f, 0.55 + rand() * 0.3, side * (5.3 + rand() * 0.6), z + rand() * 2, rand() * 6.28, false, 0.05);
      }
      if (rand() < 0.2) {
        place(bushes[Math.floor(rand() * bushes.length)], 1.1 + rand() * 0.7, side * (5.9 + rand()), z + rand() * 2, rand() * 6.28, false, 0.02);
      }
    }
  }

  // background nature
  for (let i = 0; i < 150; i++) {
    const x = (rand() - 0.5) * 300;
    const z = Z_END - 20 + rand() * (Z_START - Z_END + 60);
    if (Math.abs(x) < 19) continue;
    placeSeasonalTree(Math.floor(rand() * 100), 3 + rand() * 3.5, x, z, rand() * 6.28);
  }
  for (let i = 0; i < 50; i++) {
    const x = (rand() - 0.5) * 280;
    const z = Z_END - 10 + rand() * (Z_START - Z_END + 40);
    if (Math.abs(x) < 18) continue;
    place(rocks[Math.floor(rand() * rocks.length)], 0.5 + rand() * 0.8, x, z, rand() * 6.28);
  }

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

  // ---------- the car (you) + a greeter at the gate ----------
  const carGltf = await loader.loadAsync('/assets/village/car/sedan-sports.glb');
  const car = carGltf.scene;
  const wheels: { front: import('three').Object3D[]; all: import('three').Object3D[] } = { front: [], all: [] };
  car.traverse((o) => {
    const mesh = o as import('three').Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as import('three').MeshStandardMaterial;
        if ('metalness' in std) {
          std.metalness = 0;
          std.roughness = Math.max(0.85, std.roughness ?? 1);
        }
      }
    }
    if (/^wheel/.test(o.name)) {
      wheels.all.push(o);
      if (/front/.test(o.name)) wheels.front.push(o);
    }
  });
  // steering must live on its own pivot: yaw + accumulated roll on one Euler
  // cross axes and visually deform the wheel
  const frontPivots: import('three').Object3D[] = [];
  for (const w of wheels.front) {
    const pivot = new THREE.Group();
    w.parent!.add(pivot);
    pivot.position.copy(w.position);
    w.position.set(0, 0, 0);
    pivot.add(w);
    frontPivots.push(pivot);
  }
  {
    const box = new THREE.Box3().setFromObject(car);
    const len = box.getSize(new THREE.Vector3()).z || 1;
    const s2 = 2.9 / len; // a friendly toy-car length
    car.scale.setScalar(s2);
    car.position.y = -box.min.y * s2;
  }
  const playerRoot = new THREE.Group();
  playerRoot.add(car);
  playerRoot.position.set(0, 0, 8);
  scene.add(playerRoot);

  // nitro exhaust flames
  const flameTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,220,150,1)');
    grad.addColorStop(0.4, 'rgba(255,140,60,0.9)');
    grad.addColorStop(1, 'rgba(255,80,30,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const nitroFlames: import('three').Sprite[] = [];
  for (const fx of [-0.32, 0.32]) {
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flameTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flame.position.set(fx, 0.35, -1.55);
    flame.scale.setScalar(0.5);
    playerRoot.add(flame);
    nitroFlames.push(flame);
  }

  // headlights + taillights, revealed at night
  const headlights: import('three').SpotLight[] = [];
  const lightSprites: import('three').Sprite[] = [];
  {
    const headTexCanvas = document.createElement('canvas');
    headTexCanvas.width = headTexCanvas.height = 64;
    const hg = headTexCanvas.getContext('2d')!;
    const grad = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,246,214,1)');
    grad.addColorStop(1, 'rgba(255,246,214,0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 64, 64);
    const headTex = new THREE.CanvasTexture(headTexCanvas);
    for (const hx of [-0.42, 0.42]) {
      const spot = new THREE.SpotLight(0xfff2cc, 0, 26, 0.42, 0.5, 1.2);
      spot.position.set(hx, 0.55, 1.35);
      const tgt = new THREE.Object3D();
      tgt.position.set(hx * 0.6, 0.2, 12);
      playerRoot.add(tgt);
      spot.target = tgt;
      playerRoot.add(spot);
      headlights.push(spot);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true, opacity: 0, depthWrite: false }));
      glow.scale.setScalar(0.4);
      glow.position.set(hx, 0.55, 1.5);
      playerRoot.add(glow);
      lightSprites.push(glow);
    }
    // taillights
    for (const hx of [-0.42, 0.42]) {
      const tail = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3324, transparent: true, opacity: 0, depthWrite: false }));
      tail.scale.setScalar(0.14);
      tail.position.set(hx, 0.55, -1.42);
      playerRoot.add(tail);
      lightSprites.push(tail);
    }
  }

  // the villager stays on as a greeter beside the first gate
  const gltf = await loader.loadAsync('/assets/village/rogue.glb');
  const greeter = gltf.scene;
  greeter.traverse((o) => {
    const mesh = o as import('three').Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as import('three').MeshStandardMaterial;
        if ('metalness' in std) {
          std.metalness = 0;
          std.roughness = Math.max(0.85, std.roughness ?? 1);
        }
      }
    }
    if (/dagger|knife|sword|blade|weapon|crossbow|axe|shield|offhand|arrow|quiver/i.test(o.name)) {
      o.visible = false;
    }
  });
  {
    const box = new THREE.Box3().setFromObject(greeter);
    const h = box.getSize(new THREE.Vector3()).y || 1;
    const sg = 1.75 / h;
    greeter.scale.setScalar(sg);
    greeter.position.set(3.2, -box.min.y * sg, -9);
    greeter.rotation.y = Math.PI * 0.85; // angled toward arrivals
  }
  scene.add(greeter);
  const mixer = new THREE.AnimationMixer(greeter);
  {
    const clips = gltf.animations;
    const idle = THREE.AnimationClip.findByName(clips, 'Idle') ?? clips[0];
    if (idle) mixer.clipAction(idle).play();
  }

  // ---------- procedural engine sound ----------
  // detuned saw pair + sub through a lowpass; pitch/brightness follow speed.
  // Created lazily on first input (autoplay policy), silent at rest.
  // engine: a real petrol loop (CC-BY qubodup, opengameart.org), looped and
  // pitch-bent by RPM. Lazily created on first input; silent at rest.
  let engineAudio: {
    ctx: AudioContext;
    gain: GainNode;
    src: AudioBufferSourceNode;
  } | null = null;
  let engineLoading = false;
  let muted = false;

  function ensureEngineAudio(): void {
    if (engineAudio || engineLoading || muted) return;
    engineLoading = true;
    (async () => {
      try {
        const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const res = await fetch('/assets/village/engine-petrol.mp3');
        const buf = await actx.decodeAudioData(await res.arrayBuffer());
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = actx.createGain();
        gain.gain.value = 0;
        const comp = actx.createDynamicsCompressor();
        src.connect(gain);
        gain.connect(comp);
        comp.connect(actx.destination);
        src.start();
        engineAudio = { ctx: actx, gain, src };
      } catch {
        engineAudio = null;
      } finally {
        engineLoading = false;
      }
    })();
  }

  // background music: "Where Was I" by yd (CC0, opengameart.org)
  let music: HTMLAudioElement | null = null;
  function ensureMusic(): void {
    if (music || muted) return;
    music = new Audio('/assets/village/music.m4a');
    music.loop = true;
    music.volume = 0.55;
    music.play().catch(() => {});
  }

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm') {
      muted = !muted;
      if (engineAudio) {
        engineAudio.gain.gain.setTargetAtTime(0, engineAudio.ctx.currentTime, 0.05);
        if (muted) engineAudio.ctx.suspend();
        else engineAudio.ctx.resume();
      }
      if (music) music.muted = muted;
      return;
    }
    ensureEngineAudio();
    ensureMusic();
  });
  window.addEventListener('pointerdown', () => {
    ensureEngineAudio();
    ensureMusic();
  });

  // ---------- input ----------
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  let joy: { sx: number; sy: number; dx: number; dy: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    joy = { sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    if (joy) {
      joy.dx = (e.clientX - joy.sx) / 60;
      joy.dy = (e.clientY - joy.sy) / 60;
    }
  });
  window.addEventListener('pointerup', () => (joy = null));

  // ---------- driving + camera ----------
  const MAX_SPEED = 11;
  const NITRO_MAX = 18;
  const MAX_REVERSE = 4;
  const ACCEL = 9;
  const NITRO_ACCEL = 17;
  const BRAKE = 16;
  const DRAG = 3.2;
  const STEER_RATE = 1.9;
  const CAM_AZIMUTH = 0;
  let heading = Math.PI; // car noses toward the street (-z … model faces +z)
  let speed = 0; // signed: + forward, − reverse

  const camTarget = new THREE.Vector3(0, 1.6, 8);
  const camPos = new THREE.Vector3(0, 4.5, 16);
  camera.position.copy(camPos);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- proximity stations → DOM card ----------
  let activeStation: Station | null = null;

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    let ix = 0;
    let iz = 0;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (joy) {
      ix += Math.max(-1, Math.min(1, joy.dx));
      iz += Math.max(-1, Math.min(1, joy.dy));
    }
    // arcade car: throttle on the screen-vertical axis, steering on horizontal
    // gamepad: left stick steers, RT throttle, LT brake/reverse, A = nitro
    let padNitro = false;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
      ix += dz(pad.axes[0] ?? 0);
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      const trigger = rt - lt;
      iz += trigger !== 0 ? -trigger : dz(pad.axes[1] ?? 0);
      if (pad.buttons[0]?.pressed) padNitro = true;
      break;
    }
    ix = Math.max(-1, Math.min(1, ix));
    iz = Math.max(-1, Math.min(1, iz));

    const throttle = -iz; // up = forward
    const steer = -ix; // right key steers right (heading decreases visually)
    const nitro = (keys.has('shift') || padNitro) && throttle > 0.05;
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
    heading += steer * STEER_RATE * steerAuthority * dt;

    // the model noses +z at heading 0, so forward is +sin/+cos of heading
    const fwdX = Math.sin(heading);
    const fwdZ = Math.cos(heading);
    playerRoot.rotation.y = heading;
    playerRoot.position.x += fwdX * speed * dt;
    playerRoot.position.z += fwdZ * speed * dt;

    // wheels: roll with speed, front pair steers
    const roll = (speed * dt) / 0.35;
    for (const w of wheels.all) w.rotation.x += roll;
    for (const pv of frontPivots) pv.rotation.y = steer * 0.45 * Math.max(0, steerAuthority);

    // nitro juice: flames flicker, camera FOV widens with the surge
    for (const flame of nitroFlames) {
      const m = flame.material as import('three').SpriteMaterial;
      const targetO = nitro ? 0.85 + Math.sin(t * 47 + flame.position.x * 9) * 0.15 : 0;
      m.opacity += (targetO - m.opacity) * Math.min(1, dt * 14);
      flame.scale.setScalar(0.4 + (nitro ? 0.25 + Math.sin(t * 39 + flame.position.x * 7) * 0.1 : 0));
    }
    const targetFov = 50 + 8 * Math.max(0, (speed - MAX_SPEED * 0.7) / (NITRO_MAX - MAX_SPEED * 0.7));
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }

    // engine follows the wheels — gear-stepped RPM bends the sample's pitch
    if (engineAudio && !muted) {
      const sp = Math.abs(speed);
      const GEAR_SPAN = 6.5;
      const inGear = sp < 0.15 ? 0 : (sp % GEAR_SPAN) / GEAR_SPAN;
      const rpm = Math.min(1, 0.18 + inGear * 0.82 + (nitro ? 0.12 : 0));
      const now = engineAudio.ctx.currentTime;
      engineAudio.src.playbackRate.setTargetAtTime(0.65 + rpm * 1.15 + (nitro ? 0.3 : 0), now, 0.07);
      const vol = sp < 0.15 ? 0 : Math.min(0.2, 0.08 + (sp / NITRO_MAX) * 0.11) + (nitro ? 0.03 : 0);
      engineAudio.gain.gain.setTargetAtTime(vol, now, 0.1);
    }
    playerRoot.position.x = Math.max(-100, Math.min(100, playerRoot.position.x));
    playerRoot.position.z = Math.max(Z_END + 4, Math.min(Z_START - 2, playerRoot.position.z));

    // circle-vs-AABB collision: push the player out of anything solid
    const R = 1.05;
    for (let pass = 0; pass < 2; pass++) {
      const px = playerRoot.position.x;
      const pz = playerRoot.position.z;
      for (const c of colliders) {
        if (px < c.minX - 4 || px > c.maxX + 4 || pz < c.minZ - 4 || pz > c.maxZ + 4) continue;
        const cx = Math.max(c.minX, Math.min(c.maxX, px));
        const cz = Math.max(c.minZ, Math.min(c.maxZ, pz));
        const dx = px - cx;
        const dz = pz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < R * R) {
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            playerRoot.position.x += (dx / d) * (R - d);
            playerRoot.position.z += (dz / d) * (R - d);
          } else {
            const exits = [
              { d: px - c.minX + R, x: -(px - c.minX + R), z: 0 },
              { d: c.maxX - px + R, x: c.maxX - px + R, z: 0 },
              { d: pz - c.minZ + R, x: 0, z: -(pz - c.minZ + R) },
              { d: c.maxZ - pz + R, x: 0, z: c.maxZ - pz + R },
            ].sort((a, b) => a.d - b.d)[0];
            playerRoot.position.x += exits.x;
            playerRoot.position.z += exits.z;
          }
        }
      }
    }

    mixer.update(dt); // greeter idle

    // environment transition
    {
      const k = Math.min(1, dt * 1.6);
      envState.horizon.lerp(new THREE.Color().fromArray(envTarget.horizon), k);
      envState.mid.lerp(new THREE.Color().fromArray(envTarget.mid), k);
      envState.zenith.lerp(new THREE.Color().fromArray(envTarget.zenith), k);
      envState.glow.lerp(new THREE.Color().fromArray(envTarget.glow), k);
      envState.sunDir.lerp(new THREE.Vector3().fromArray(envTarget.sunDir).normalize(), k).normalize();
      envState.sunColor.lerp(new THREE.Color(envTarget.sunColor), k);
      envState.sunIntensity += (envTarget.sunIntensity - envState.sunIntensity) * k;
      envState.hemiSky.lerp(new THREE.Color(envTarget.hemiSky), k);
      envState.hemiGround.lerp(new THREE.Color(envTarget.hemiGround), k);
      envState.hemiIntensity += (envTarget.hemiIntensity - envState.hemiIntensity) * k;
      envState.fog.lerp(new THREE.Color(envTarget.fog), k);
      envState.exposure += (envTarget.exposure - envState.exposure) * k;
      nightFactor += (envTarget.night - nightFactor) * k;

      const u = skyMat.uniforms;
      (u.uHorizon.value as import('three').Color).copy(envState.horizon);
      (u.uMid.value as import('three').Color).copy(envState.mid);
      (u.uZenith.value as import('three').Color).copy(envState.zenith);
      (u.uGlowColor.value as import('three').Color).copy(envState.glow);
      (u.uSunDir.value as import('three').Vector3).copy(envState.sunDir);
      sun.color.copy(envState.sunColor);
      sun.intensity = envState.sunIntensity;
      hemi.color.copy(envState.hemiSky);
      hemi.groundColor.copy(envState.hemiGround);
      hemi.intensity = envState.hemiIntensity;
      (scene.fog as import('three').Fog).color.copy(envState.fog);
      renderer.toneMappingExposure = envState.exposure;
      starMat.opacity = nightFactor * 0.9;
      for (const m of nightGlowMats) m.emissive.setScalar(nightFactor * 0.92);
      const headOn = nightFactor > 0.25;
      headlights.forEach((h2) => (h2.intensity = nightFactor * 55));
      lightSprites.forEach((sp2, i2) => {
        (sp2.material as import('three').SpriteMaterial).opacity = headOn ? (i2 < 2 ? 0.85 : 0.7) * nightFactor : 0;
      });
    }

    // wind
    for (const s of swayers) {
      s.obj.rotation.z = Math.sin(t * s.rate + s.phase) * s.amp;
    }
    for (const cloud of clouds) {
      cloud.position.x += dt * 0.6;
      if (cloud.position.x > 150) cloud.position.x = -150;
    }

    // nearest station within reach → raise the card
    let nearest: Station | null = null;
    let bestD = 4.4;
    for (const st of stations) {
      const d = Math.hypot(st.x - playerRoot.position.x, st.z - playerRoot.position.z);
      if (d < bestD) {
        bestD = d;
        nearest = st;
      }
    }
    if (nearest !== activeStation) {
      activeStation = nearest;
      window.dispatchEvent(
        new CustomEvent('village:station', {
          detail: nearest ? { project: nearest.project, accent: nearest.accent } : null,
        })
      );
    }

    // fixed-azimuth follow camera
    const desiredCam = playerRoot.position
      .clone()
      .add(new THREE.Vector3(Math.sin(CAM_AZIMUTH) * 7.2, 4.0, Math.cos(CAM_AZIMUTH) * 7.2));
    camPos.lerp(desiredCam, Math.min(1, dt * 3.5));
    camera.position.copy(camPos);
    camTarget.lerp(playerRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0)), Math.min(1, dt * 6));
    camera.lookAt(camTarget);
    skyDome.position.copy(camera.position);

    sun.position.set(playerRoot.position.x + 18, 26, playerRoot.position.z + 14);
    sun.target.position.copy(playerRoot.position);
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
  });

  (window as any).__village = {
    pos: () => ({
      x: +playerRoot.position.x.toFixed(2),
      z: +playerRoot.position.z.toFixed(2),
      speed: +speed.toFixed(2),
    }),
    stations: () => stations.map((s) => ({ slug: s.project.slug, x: +s.x.toFixed(1), z: +s.z.toFixed(1) })),
    colliders: () => colliders.length,
    keys: () => [...keys],
  };

  return true;
}
