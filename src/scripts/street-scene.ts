import type { Project, District } from '../data/projects';

const INK = 0x07070a;
const WALL_X = 9;
const SIGN_SPACING = 13;
const SIGN_Y = 4.2;
const CAM_Y = 3.4;
const CAM_START_Z = 10;
const STATUS_COLOR: Record<string, number> = {
  stable: 0x0fe513,
  wip: 0xf2a707,
  experiment: 0xa12cf9,
};

interface SignEntry {
  mesh: import('three').Mesh;
  reflection: import('three').Mesh;
  project: Project;
  baseColor: import('three').Color;
  status: string;
  seed: number;
}

export async function initStreetScene(
  canvas: HTMLCanvasElement,
  projects: Project[],
  districts: District[]
): Promise<boolean> {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  const THREE = await import('three');
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');

  // fonts must be ready before we draw sign textures
  await Promise.all([
    document.fonts.load('90px "Tilt Neon"'),
    document.fonts.load('40px "Inconsolata Variable"'),
    document.fonts.load('64px "Neonderthaw"'),
  ]).catch(() => {});

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.FogExp2(INK, 0.042);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, CAM_Y, CAM_START_Z);

  const texLoader = new THREE.TextureLoader();

  // ---------- canvas texture helpers ----------

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makeSignTexture(project: Project, accent: string): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, c.width, c.height);

    // border tube
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 36;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    if (project.status === 'experiment') ctx.setLineDash([28, 22]);
    roundRect(ctx, 40, 40, c.width - 80, c.height - 80, 36);
    ctx.stroke();
    ctx.stroke();
    ctx.restore();

    // name — per-char so experiments get a dead letter
    const chars = [...project.name];
    const deadIndex = project.status === 'experiment' ? Math.floor(chars.length / 2) : -1;
    ctx.font = '90px "Tilt Neon", sans-serif';
    ctx.textBaseline = 'middle';
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = (c.width - total) / 2;
    const nameY = c.height / 2 - 30;
    chars.forEach((ch, i) => {
      if (i === deadIndex) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillText(ch, x, nameY);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur = 42;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ch, x, nameY);
        ctx.fillText(ch, x, nameY); // double pass = hotter core
        ctx.restore();
      }
      x += widths[i];
    });

    // tagline
    ctx.font = '40px "Inconsolata Variable", monospace';
    ctx.fillStyle = 'rgba(239,233,220,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(project.tagline, c.width / 2, c.height / 2 + 88);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function makeDistrictTexture(d: District): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1400;
    c.height = 360;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '110px "Tilt Neon", sans-serif';
    ctx.shadowColor = d.accent;
    ctx.shadowBlur = 48;
    ctx.fillStyle = d.accent;
    const spaced = d.name.toUpperCase().split('').join(' ');
    ctx.fillText(spaced, c.width / 2, 130);
    ctx.fillText(spaced, c.width / 2, 130);
    ctx.font = '64px "Neonderthaw", cursive';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(239,233,220,0.9)';
    ctx.fillText(d.blurb, c.width / 2, 268);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeTextTexture(text: string, color: string, px = 72, font = '"Inconsolata Variable", monospace'): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 180;
    const ctx = c.getContext('2d')!;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${px}px ${font}`;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, c.height / 2);
    ctx.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeGlowTexture(hex: string): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, hex);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  // ---------- street layout ----------

  const signs: SignEntry[] = [];
  const clickables: import('three').Object3D[] = [];
  const gates: import('three').Mesh[] = [];
  let z = -30;

  const districtGroups = districts.map((d) => ({
    district: d,
    items: projects.filter((p) => p.district === d.id).sort((a, b) => a.order - b.order),
  }));

  let side = -1;
  for (const group of districtGroups) {
    // district gate floating over the street
    const gateTex = makeDistrictTexture(group.district);
    const gate = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.6),
      new THREE.MeshBasicMaterial({ map: gateTex, transparent: true, fog: false })
    );
    gate.position.set(0, 8, z);
    scene.add(gate);
    gates.push(gate);
    z -= 9;

    for (const project of group.items) {
      const accent = group.district.accent;
      const tex = makeSignTexture(project, accent);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), mat);
      mesh.position.set(side * (WALL_X - 1.4), SIGN_Y, z);
      mesh.rotation.y = side * -Math.PI / 2 + side * 0.28;
      mesh.userData.project = project;
      mesh.userData.accent = accent;
      scene.add(mesh);
      clickables.push(mesh);

      // fake wet reflection
      const rMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      const refl = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), rMat);
      refl.position.set(mesh.position.x, -SIGN_Y * 0.92, z);
      refl.rotation.y = mesh.rotation.y;
      refl.scale.y = -1;
      scene.add(refl);

      // glow pool on the asphalt
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 4.5),
        new THREE.MeshBasicMaterial({
          map: makeGlowTexture(accent),
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(mesh.position.x * 0.75, 0.02, z);
      scene.add(pool);

      const baseColor = new THREE.Color(0xffffff);
      signs.push({ mesh, reflection: refl, project, baseColor, status: project.status, seed: Math.random() * 100 });
      side *= -1;
      z -= SIGN_SPACING;
    }
    z -= 6;
  }

  const endZ = z - 4;

  // ---------- walls / ground / end wall ----------

  const brickTex = texLoader.load('/brick-pattern.jpg');
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
  brickTex.colorSpace = THREE.SRGBColorSpace;
  const streetLen = Math.abs(endZ) + CAM_START_Z + 30;
  brickTex.repeat.set(streetLen / 8, 2.2);

  const wallMat = new THREE.MeshBasicMaterial({ map: brickTex, color: 0x4a2a44 });
  const wallGeo = new THREE.PlaneGeometry(streetLen, 16);
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-WALL_X, 8, endZ / 2 + CAM_START_Z / 2);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(WALL_X, 8, endZ / 2 + CAM_START_Z / 2);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // ground: semi-transparent so reflections beneath show through
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_X * 2, streetLen),
    new THREE.MeshBasicMaterial({ color: 0x0b0b12, transparent: true, opacity: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, endZ / 2 + CAM_START_Z / 2);
  scene.add(ground);

  // end wall with graffiti + link signs
  const graffitiTex = texLoader.load('/graffiti-wall.jpg');
  graffitiTex.colorSpace = THREE.SRGBColorSpace;
  const endWall = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_X * 2, 16),
    new THREE.MeshBasicMaterial({ map: graffitiTex, color: 0xcfcfcf })
  );
  endWall.position.set(0, 8, endZ - 6);
  scene.add(endWall);

  const links: Array<{ text: string; url: string; color: string; y: number }> = [
    { text: 'github.com/rakeshgangwar', url: 'https://github.com/rakeshgangwar', color: '#bfee21', y: 4.6 },
    { text: 'github.com/SuperJackfruitLabs', url: 'https://github.com/SuperJackfruitLabs', color: '#09e6f2', y: 3.0 },
  ];
  for (const link of links) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 1.65),
      new THREE.MeshBasicMaterial({ map: makeTextTexture(link.text, link.color), transparent: true })
    );
    mesh.position.set(0, link.y, endZ - 5.8);
    mesh.userData.url = link.url;
    scene.add(mesh);
    clickables.push(mesh);
  }

  // lamps along the street
  const lampGlowTex = makeGlowTexture('#ffd678');
  for (let lz = -24; lz > endZ; lz -= 34) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 6.4),
      new THREE.MeshBasicMaterial({ color: 0x08080c })
    );
    pole.position.set(-WALL_X + 1.1, 3.2, lz);
    scene.add(pole);
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: lampGlowTex, color: 0xffc860, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    head.scale.set(2.6, 2.6, 1);
    head.position.set(-WALL_X + 1.1, 6.6, lz);
    scene.add(head);
  }

  // rain
  const RAIN = 600;
  const rainPos = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * WALL_X * 2;
    rainPos[i * 3 + 1] = Math.random() * 16;
    rainPos[i * 3 + 2] = CAM_START_Z - Math.random() * (streetLen + 10);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0x8fa3b8, size: 0.03, transparent: true, opacity: 0.3, depthWrite: false })
  );
  scene.add(rain);

  // ---------- post-processing ----------

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.0,
    0.6,
    0.2
  );
  composer.addPass(bloom);

  // ---------- movement & interaction ----------

  let targetZ = CAM_START_Z;
  let mouseX = 0;
  const minZ = endZ + 8;
  const clampZ = () => {
    targetZ = Math.max(minZ, Math.min(CAM_START_Z, targetZ));
  };

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      targetZ -= delta * 0.02;
      clampZ();
    },
    { passive: false }
  );

  let dragging = false;
  let dragStartY = 0;
  let dragStartZ = 0;
  let moved = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragStartZ = targetZ;
    moved = 0;
  });
  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    if (!dragging) return;
    const dy = e.clientY - dragStartY;
    moved = Math.max(moved, Math.abs(dy));
    targetZ = dragStartZ + dy * 0.05;
    clampZ();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  const KEY_STEP = 6;
  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('panel-open')) return;
    if (['ArrowUp', 'w', 'W', 'ArrowRight'].includes(e.key)) {
      targetZ -= KEY_STEP;
      clampZ();
    } else if (['ArrowDown', 's', 'S', 'ArrowLeft'].includes(e.key)) {
      targetZ += KEY_STEP;
      clampZ();
    }
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: import('three').Object3D | null = null;

  function raycast(clientX: number, clientY: number): import('three').Object3D | null {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickables, false)[0];
    return hit ? hit.object : null;
  }

  canvas.addEventListener('pointermove', (e) => {
    const obj = raycast(e.clientX, e.clientY);
    if (hovered && hovered !== obj) hovered.scale.setScalar(1);
    hovered = obj;
    if (hovered) hovered.scale.setScalar(1.05);
    canvas.style.cursor = obj ? 'pointer' : 'grab';
  });

  canvas.addEventListener('click', (e) => {
    if (moved > 6) return;
    const obj = raycast(e.clientX, e.clientY);
    if (!obj) return;
    if (obj.userData.url) {
      window.open(obj.userData.url, '_blank', 'noopener');
      return;
    }
    if (obj.userData.project) {
      window.dispatchEvent(
        new CustomEvent('project:open', {
          detail: { project: obj.userData.project, accent: obj.userData.accent },
        })
      );
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- render loop ----------

  const dim = new THREE.Color(0x555555);
  const dark = new THREE.Color(0x222222);
  const white = new THREE.Color(0xffffff);
  const startTime = performance.now();

  renderer.setAnimationLoop(() => {
    if (document.hidden) return;
    const t = (performance.now() - startTime) / 1000;

    camera.position.z += (targetZ - camera.position.z) * 0.06;
    camera.position.x += (mouseX * 0.9 - camera.position.x) * 0.04;
    camera.lookAt(camera.position.x * 0.4, CAM_Y - 0.3, camera.position.z - 12);

    const progress = Math.min(1, Math.max(0, (CAM_START_Z - camera.position.z) / 18));
    window.dispatchEvent(new CustomEvent('street3d:progress', { detail: { progress } }));

    // status behavior
    for (const s of signs) {
      const m = s.mesh.material as import('three').MeshBasicMaterial;
      const rm = s.reflection.material as import('three').MeshBasicMaterial;
      if (s.status === 'wip') {
        // irregular flicker: mostly on, occasional dropouts
        const n = Math.sin(t * 7 + s.seed) * Math.sin(t * 13.7 + s.seed * 2) * Math.sin(t * 3.1 + s.seed);
        const on = n > -0.88;
        m.color.copy(on ? white : dim);
        rm.opacity = on ? 0.16 : 0.05;
      } else if (s.status === 'experiment') {
        const buzz = 0.62 + 0.1 * Math.sin(t * 40 + s.seed) + 0.06 * Math.sin(t * 9 + s.seed);
        m.color.copy(white).multiplyScalar(buzz);
        rm.opacity = 0.1;
      }
    }

    // gates fade out as you walk up to them instead of blooming across the view
    for (const gate of gates) {
      const dist = camera.position.z - gate.position.z;
      const mat = gate.material as import('three').MeshBasicMaterial;
      mat.opacity = Math.max(0, Math.min(1, (dist - 5) / 9));
    }

    // rain fall
    const pos = rainGeo.getAttribute('position') as import('three').BufferAttribute;
    for (let i = 0; i < RAIN; i++) {
      let y = pos.getY(i) - 0.22;
      if (y < 0) y = 16;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    composer.render();
  });

  canvas.style.cursor = 'grab';

  // test/debug handle: project a sign's center to screen coordinates
  (window as any).__street = {
    signScreenPos(slug: string): { x: number; y: number } | null {
      const entry = signs.find((s) => s.project.slug === slug);
      if (!entry) return null;
      const v = entry.mesh.position.clone().project(camera);
      if (v.z > 1) return null; // behind camera
      return {
        x: ((v.x + 1) / 2) * window.innerWidth,
        y: ((1 - v.y) / 2) * window.innerHeight,
      };
    },
    cameraZ: () => camera.position.z,
  };

  return true;
}
