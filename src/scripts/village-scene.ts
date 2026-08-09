// Feel prototype for the "lab by day" village experience.
// Everything visual is graybox — what's being judged here is movement,
// camera, and animation feel. Assets get curated later.

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

  const scene = new THREE.Scene();
  const SKY = 0x9ed4f5;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 60, 140);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);

  // ---------- light ----------
  const sun = new THREE.DirectionalLight(0xfff3d6, 2.6);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a9a6a, 1.1));

  // ---------- graybox world ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshLambertMaterial({ color: 0xa8c686 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // road along z
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 240),
    new THREE.MeshLambertMaterial({ color: 0xb9bcc4 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  scene.add(road);

  // dashed center line
  for (let z = -110; z < 110; z += 6) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 2.4),
      new THREE.MeshLambertMaterial({ color: 0xf2efe6 })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.02, z);
    scene.add(dash);
  }

  // pastel block houses along both sides
  const palette = [0xe8b4b8, 0xf0d9a7, 0xb8d8d8, 0xd9c7e8, 0xc7e8c9];
  let seed = 12;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let side = -1; side <= 1; side += 2) {
    for (let z = -100; z < 100; z += 14 + Math.floor(rand() * 8)) {
      const w = 6 + rand() * 5;
      const h = 4 + rand() * 4;
      const d = 5 + rand() * 4;
      const x = side * (8 + rand() * 6 + w / 2);
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color: palette[Math.floor(rand() * palette.length)] })
      );
      house.position.set(x, h / 2, z);
      house.castShadow = true;
      house.receiveShadow = true;
      scene.add(house);
      // simple roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2 + rand() * 1.5, 4),
        new THREE.MeshLambertMaterial({ color: 0xc96f5a })
      );
      roof.position.set(x, h + 1 + rand() * 0.7, z);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      scene.add(roof);
    }
  }

  // scattered "trees": cone on cylinder
  for (let i = 0; i < 60; i++) {
    const x = (rand() - 0.5) * 200;
    const z = (rand() - 0.5) * 200;
    if (Math.abs(x) < 16) continue; // keep the street clear
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a })
    );
    trunk.position.set(x, 0.8, z);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.6 + rand() * 1.4, 3 + rand() * 2.5, 7),
      new THREE.MeshLambertMaterial({ color: rand() < 0.5 ? 0x6aa84f : 0x7dbb5e })
    );
    crown.position.set(x, 3 + rand(), z);
    trunk.castShadow = crown.castShadow = true;
    scene.add(trunk, crown);
  }

  // ---------- character ----------
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/assets/soldier.glb');
  const player = gltf.scene;
  player.traverse((o) => {
    if ((o as import('three').Mesh).isMesh) o.castShadow = true;
  });
  player.rotation.y = Math.PI; // model faces +z; we treat -z as forward
  const playerRoot = new THREE.Group();
  playerRoot.add(player);
  scene.add(playerRoot);

  const mixer = new THREE.AnimationMixer(player);
  const clips = gltf.animations;
  const actions: Record<string, import('three').AnimationAction> = {};
  for (const name of ['Idle', 'Walk', 'Run']) {
    const clip = THREE.AnimationClip.findByName(clips, name);
    if (clip) {
      actions[name] = mixer.clipAction(clip);
      actions[name].play();
      actions[name].setEffectiveWeight(name === 'Idle' ? 1 : 0);
    }
  }

  // ---------- input ----------
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // touch: simple drag-to-move joystick
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
  const WALK_SPEED = 2.2;
  const RUN_SPEED = 6.2;
  const TURN_RATE = 11;
  let heading = 0; // facing angle
  let speed = 0;

  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 4.5, 8);
  camera.position.copy(camPos);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());

    // input vector (screen-relative: up = away from camera)
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
      const desired = Math.atan2(ix, iz) + Math.PI; // world heading from input
      let diff = desired - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, dt * TURN_RATE);
    }

    playerRoot.rotation.y = heading;
    playerRoot.position.x += Math.sin(heading) * -speed * dt;
    playerRoot.position.z += Math.cos(heading) * -speed * dt;
    // keep on the map
    playerRoot.position.x = Math.max(-90, Math.min(90, playerRoot.position.x));
    playerRoot.position.z = Math.max(-110, Math.min(110, playerRoot.position.z));

    // animation blending by speed
    const runW = Math.max(0, Math.min(1, (speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)));
    const moveW = Math.max(0, Math.min(1, speed / WALK_SPEED));
    actions.Idle?.setEffectiveWeight(1 - moveW);
    actions.Walk?.setEffectiveWeight(moveW * (1 - runW));
    actions.Run?.setEffectiveWeight(moveW * runW);
    mixer.update(dt);

    // follow camera: behind the character with soft lag and slight look-ahead
    const behind = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const desiredCam = playerRoot.position
      .clone()
      .addScaledVector(behind, 7.5)
      .add(new THREE.Vector3(0, 4.2, 0));
    camPos.lerp(desiredCam, Math.min(1, dt * 3.2));
    camera.position.copy(camPos);
    camTarget.lerp(
      playerRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(behind, -2),
      Math.min(1, dt * 5)
    );
    camera.lookAt(camTarget);

    // sun follows so shadows stay crisp near the player
    sun.position.set(playerRoot.position.x + 18, 30, playerRoot.position.z + 12);
    sun.target.position.copy(playerRoot.position);
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);
  });

  // debug handle for automated checks
  (window as any).__village = {
    pos: () => ({
      x: +playerRoot.position.x.toFixed(2),
      z: +playerRoot.position.z.toFixed(2),
      speed: +speed.toFixed(2),
    }),
  };

  return true;
}
