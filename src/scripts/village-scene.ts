// "Lab by day" village — Summer Afternoon-inspired third-person stroll.
// Assets: Kenney City Kit Suburban + Nature Kit (CC0), KayKit Adventurers
// character (CC0). Everything auto-scaled from bounding boxes so the two
// packs and the character agree on world scale.

export async function initVillageScene(canvas: HTMLCanvasElement): Promise<boolean> {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return false;

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const SKY = 0x9ed4f5;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 55, 130);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);

  // ---------- light ----------
  const sun = new THREE.DirectionalLight(0xfff2d0, 3.2);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x9bb068, 1.35));

  // ---------- deterministic layout randomness ----------
  let seed = 20260809;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // ---------- ground + road ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshLambertMaterial({ color: 0x9fc178 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 250),
    new THREE.MeshLambertMaterial({ color: 0xb5b8bf })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.receiveShadow = true;
  scene.add(road);

  for (let z = -115; z < 115; z += 6) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xf2efe6 })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    scene.add(dash);
  }

  // sidewalks
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 250),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c4 })
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(side * 4.1, 0.025, 0);
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

  // place a clone scaled so its largest horizontal dimension ≈ targetSize
  function place(
    proto: import('three').Group,
    targetSize: number,
    x: number,
    z: number,
    rotY: number
  ): import('three').Object3D {
    const inst = proto.clone(true);
    const box = new THREE.Box3().setFromObject(inst);
    const dims = box.getSize(new THREE.Vector3());
    const current = Math.max(dims.x, dims.z) || 1;
    const s = targetSize / current;
    inst.scale.setScalar(s);
    // sit on the ground
    inst.position.set(x, -box.min.y * s, z);
    inst.rotation.y = rotY;
    scene.add(inst);
    return inst;
  }

  const [
    houses,
    driveway,
    fence,
    planter,
    kTreeLarge,
    kTreeSmall,
    flowers,
    bushes,
    rocks,
    nTrees,
  ] = await Promise.all([
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

  // ---------- village layout ----------
  // houses face the road from both sides, with driveways and yard dressing
  for (const side of [-1, 1]) {
    let z = -96;
    while (z < 100) {
      const house = houses[Math.floor(rand() * houses.length)];
      const width = 7 + rand() * 2.5;
      const x = side * (9.5 + rand() * 2.5);
      const rotY = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      place(house, width, x, z, rotY);
      place(driveway, 3.2, side * 6.4, z + 1.2, rotY);

      // yard dressing
      const treeKind = rand() < 0.5 ? kTreeLarge : kTreeSmall;
      place(treeKind, 2.2 + rand() * 1.6, x + (rand() - 0.5) * 5, z - (4.5 + rand() * 2), rand() * 6.28);
      if (rand() < 0.7) {
        place(fence, 3.4, side * 6.2, z - (5 + rand() * 1.5), side === 1 ? 0 : 0);
      }
      if (rand() < 0.6) place(planter, 1.1, side * 5.2, z + (2.5 + rand() * 1.5), rotY);

      z += 13 + rand() * 6;
    }
  }

  // flowers + bushes along the sidewalks
  for (let z = -100; z < 100; z += 3.5 + rand() * 3) {
    for (const side of [-1, 1]) {
      if (rand() < 0.55) {
        const f = flowers[Math.floor(rand() * flowers.length)];
        place(f, 0.55 + rand() * 0.3, side * (5.3 + rand() * 0.6), z + rand() * 2, rand() * 6.28);
      }
      if (rand() < 0.22) {
        place(bushes[Math.floor(rand() * bushes.length)], 1.1 + rand() * 0.7, side * (5.6 + rand()), z + rand() * 2, rand() * 6.28);
      }
    }
  }

  // background nature beyond the houses
  for (let i = 0; i < 110; i++) {
    const x = (rand() - 0.5) * 260;
    const z = (rand() - 0.5) * 260;
    if (Math.abs(x) < 18) continue;
    const t = nTrees[Math.floor(rand() * nTrees.length)];
    place(t, 3 + rand() * 3.5, x, z, rand() * 6.28);
  }
  for (let i = 0; i < 40; i++) {
    const x = (rand() - 0.5) * 240;
    const z = (rand() - 0.5) * 240;
    if (Math.abs(x) < 17) continue;
    place(rocks[Math.floor(rand() * rocks.length)], 0.5 + rand() * 0.8, x, z, rand() * 6.28);
  }

  // soft cartoon clouds
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + rand() * 2.4, 7, 6), cloudMat);
      puff.position.set(p * 2.6 + rand(), rand() * 1.2, rand() * 1.5);
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 260, 34 + rand() * 14, (rand() - 0.5) * 260);
    scene.add(cloud);
  }

  // ---------- character ----------
  const gltf = await loader.loadAsync('/assets/village/rogue.glb');
  const player = gltf.scene;
  const hideNames: string[] = [];
  player.traverse((o) => {
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
    // a villager out for a stroll doesn't carry daggers
    if (/dagger|knife|sword|blade|weapon|crossbow|axe|shield|offhand|arrow|quiver/i.test(o.name)) {
      o.visible = false;
      hideNames.push(o.name);
    }
  });
  // normalize to a friendly height
  {
    const box = new THREE.Box3().setFromObject(player);
    const h = box.getSize(new THREE.Vector3()).y || 1;
    const s = 1.75 / h;
    player.scale.setScalar(s);
    player.position.y = -box.min.y * s;
  }
  const playerRoot = new THREE.Group();
  playerRoot.add(player);
  playerRoot.position.set(0, 0, 6);
  scene.add(playerRoot);

  const mixer = new THREE.AnimationMixer(player);
  const clips = gltf.animations;
  const pick = (want: string[]) => {
    for (const w of want) {
      const c = THREE.AnimationClip.findByName(clips, w);
      if (c) return c;
    }
    return null;
  };
  const actions: Record<string, import('three').AnimationAction | null> = {
    idle: null,
    walk: null,
    run: null,
  };
  const idleClip = pick(['Idle', 'Idle_A']);
  const walkClip = pick(['Walking_A', 'Walking_B', 'Walk']);
  const runClip = pick(['Running_A', 'Running_B', 'Run']);
  if (idleClip) actions.idle = mixer.clipAction(idleClip);
  if (walkClip) actions.walk = mixer.clipAction(walkClip);
  if (runClip) actions.run = mixer.clipAction(runClip);
  for (const a of Object.values(actions)) {
    if (a) {
      a.play();
      a.setEffectiveWeight(0);
    }
  }
  actions.idle?.setEffectiveWeight(1);

  // ---------- input ----------
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

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

  // ---------- movement + camera ----------
  const WALK_SPEED = 2.4;
  const RUN_SPEED = 6.4;
  const TURN_RATE = 11;
  let heading = 0;
  let speed = 0;

  const camTarget = new THREE.Vector3(0, 1.6, 0);
  const camPos = new THREE.Vector3(0, 4.5, 14);
  camera.position.copy(camPos);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());

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
    const mag = Math.hypot(ix, iz);
    const running = keys.has('shift') || mag > 1.4;
    const targetSpeed = mag > 0.05 ? (running ? RUN_SPEED : WALK_SPEED) : 0;
    speed += (targetSpeed - speed) * Math.min(1, dt * 6);

    if (mag > 0.05) {
      const desired = Math.atan2(ix, iz) + Math.PI;
      let diff = desired - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, dt * TURN_RATE);
    }

    playerRoot.rotation.y = heading;
    playerRoot.position.x += Math.sin(heading) * -speed * dt;
    playerRoot.position.z += Math.cos(heading) * -speed * dt;
    playerRoot.position.x = Math.max(-100, Math.min(100, playerRoot.position.x));
    playerRoot.position.z = Math.max(-115, Math.min(115, playerRoot.position.z));

    const runW = Math.max(0, Math.min(1, (speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)));
    const moveW = Math.max(0, Math.min(1, speed / WALK_SPEED));
    actions.idle?.setEffectiveWeight(1 - moveW);
    actions.walk?.setEffectiveWeight(moveW * (1 - runW));
    actions.run?.setEffectiveWeight(moveW * runW);
    mixer.update(dt);

    const behind = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const desiredCam = playerRoot.position
      .clone()
      .addScaledVector(behind, 7.2)
      .add(new THREE.Vector3(0, 4.0, 0));
    camPos.lerp(desiredCam, Math.min(1, dt * 3.2));
    camera.position.copy(camPos);
    camTarget.lerp(
      playerRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(behind, -2),
      Math.min(1, dt * 5)
    );
    camera.lookAt(camTarget);

    sun.position.set(playerRoot.position.x + 18, 30, playerRoot.position.z + 12);
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
    anims: () => clips.map((c) => c.name).slice(0, 40),
  };

  return true;
}
