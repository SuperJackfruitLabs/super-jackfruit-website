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
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 horizon = vec3(1.0, 0.85, 0.66);   // warm cream
        vec3 mid = vec3(0.66, 0.85, 0.96);      // soft day blue
        vec3 zenith = vec3(0.38, 0.66, 0.90);   // deeper blue
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
        col = mix(col, zenith, smoothstep(0.28, 0.85, h));
        // warm bloom around the sun direction
        float sunGlow = pow(max(dot(normalize(vDir), normalize(vec3(0.5, 0.35, 0.4))), 0.0), 6.0);
        col += vec3(0.35, 0.2, 0.05) * sunGlow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), skyMat);
  scene.add(skyDome);

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
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0xd8c090, 1.25));

  // ---------- deterministic layout randomness ----------
  let seed = 20260809;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // ---------- street geometry ----------
  const Z_START = 14;
  const Z_END = -252;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 400),
    new THREE.MeshLambertMaterial({ color: 0x9fc178 })
  );
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

  const [houses, driveway, fence, planter, kTreeLarge, kTreeSmall, flowers, bushes, rocks, nTrees] =
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
      Promise.all(['tree_default', 'tree_detailed', 'tree_oak', 'tree_default_fall'].map(loadAsset)),
    ]);

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
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.07),
      new THREE.MeshLambertMaterial({ map: tex })
    );
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
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 1.15),
      new THREE.MeshLambertMaterial({ map: tex })
    );
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
        place(nTrees[Math.floor(rand() * nTrees.length)], 3 + rand() * 2, gx, z - rand() * 4, rand() * 6.28, 'trunk', 0.01);
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
    place(nTrees[Math.floor(rand() * nTrees.length)], 3 + rand() * 3.5, x, z, rand() * 6.28, 'trunk', 0.01);
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
  const MAX_REVERSE = 4;
  const ACCEL = 9;
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
    const throttle = -iz; // up = forward
    const steer = -ix; // right key steers right (heading decreases visually)
    if (throttle > 0.05) {
      speed += ACCEL * throttle * dt;
    } else if (throttle < -0.05) {
      speed += (speed > 0 ? -BRAKE : ACCEL * throttle) * dt;
    } else {
      speed -= Math.sign(speed) * Math.min(Math.abs(speed), DRAG * dt);
    }
    speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, speed));

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
