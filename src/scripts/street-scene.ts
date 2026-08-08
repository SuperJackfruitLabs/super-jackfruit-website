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
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');

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

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  function makeSignTexture(project: Project, accent: string): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = 1024;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, c.width, c.height);

    // border tube: glow pass, then clean stroke on top (shadows paint over
    // earlier strokes, so never re-stroke with a shadow active)
    ctx.save();
    if (project.status === 'experiment') ctx.setLineDash([56, 44]);
    roundRect(ctx, 80, 80, c.width - 160, c.height - 160, 72);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 60;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    // name — per-char so experiments get a dead letter
    const chars = [...project.name];
    const deadIndex = project.status === 'experiment' ? Math.floor(chars.length / 2) : -1;
    ctx.font = '180px "Tilt Neon", sans-serif';
    ctx.textBaseline = 'middle';
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    const startX = (c.width - total) / 2;
    const nameY = c.height / 2 - 60;
    // pass 1: glow for every live character
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#ffffff';
    let x = startX;
    chars.forEach((ch, i) => {
      if (i !== deadIndex) ctx.fillText(ch, x, nameY);
      x += widths[i];
    });
    ctx.restore();
    // pass 2: clean cores on top, no shadow — nothing veils them afterwards
    ctx.fillStyle = '#ffffff';
    x = startX;
    chars.forEach((ch, i) => {
      if (i === deadIndex) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillText(ch, x, nameY);
        ctx.restore();
      } else {
        ctx.fillText(ch, x, nameY);
      }
      x += widths[i];
    });

    // tagline
    ctx.font = '80px "Inconsolata Variable", monospace';
    ctx.fillStyle = 'rgba(239,233,220,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(project.tagline, c.width / 2, c.height / 2 + 176);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  function makeDistrictTexture(d: District): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 2800;
    c.height = 720;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '220px "Tilt Neon", sans-serif';
    ctx.shadowColor = d.accent;
    ctx.shadowBlur = 60;
    ctx.fillStyle = d.accent;
    const spaced = d.name.toUpperCase().split('').join(' ');
    ctx.fillText(spaced, c.width / 2, 260);
    ctx.font = '128px "Neonderthaw", cursive';
    ctx.shadowBlur = 32;
    ctx.fillStyle = 'rgba(239,233,220,0.9)';
    ctx.fillText(d.blurb, c.width / 2, 536);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
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
    tex.anisotropy = maxAniso;
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
  const districtZones: Array<{ accent: string; mid: number }> = [];
  let z = -30;

  const districtGroups = districts.map((d) => ({
    district: d,
    items: projects.filter((p) => p.district === d.id).sort((a, b) => a.order - b.order),
  }));

  let side = -1;
  for (const group of districtGroups) {
    const zoneStart = z;
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
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), mat);
      mesh.position.set(side * (WALL_X - 1.4), SIGN_Y, z);
      mesh.rotation.y = side * -Math.PI / 2 + side * 0.42;
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
    districtZones.push({ accent: group.district.accent, mid: (zoneStart + z) / 2 });
    z -= 6;
  }

  const endZ = z - 4;

  // ---------- walls / ground / end wall ----------

  const streetLen = Math.abs(endZ) + CAM_START_Z + 30;
  const wallCenterZ = endZ / 2 + CAM_START_Z / 2;
  const wallZNear = wallCenterZ + streetLen / 2;

  // hue anchors along the street: entrance purple → district accents → ember end
  const hueAnchors: Array<{ z: number; color: import('three').Color }> = [
    { z: wallZNear, color: new THREE.Color('#7a2f7c') },
    ...districtZones.map((d) => ({ z: d.mid, color: new THREE.Color(d.accent) })),
    { z: endZ - 15, color: new THREE.Color('#fc5553') },
  ];

  function hueAtZ(zWorld: number): import('three').Color {
    if (zWorld >= hueAnchors[0].z) return hueAnchors[0].color.clone();
    for (let i = 0; i < hueAnchors.length - 1; i++) {
      const a = hueAnchors[i];
      const b = hueAnchors[i + 1];
      if (zWorld <= a.z && zWorld >= b.z) {
        const t = (a.z - zWorld) / (a.z - b.z);
        return a.color.clone().lerp(b.color, t);
      }
    }
    return hueAnchors[hueAnchors.length - 1].color.clone();
  }

  // generative circuit-trace wall art: one unique, non-tiling canvas per wall
  function makeWallArtTexture(flip: boolean): import('three').CanvasTexture {
    const W = 8192;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;

    const zAtX = (x: number) => {
      const f = x / W;
      return flip ? endZ - 15 + f * streetLen : wallZNear - f * streetLen;
    };
    const css = (col: import('three').Color, alpha: number) =>
      `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${alpha})`;

    // dark panel background with a soft vertical falloff
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0e0a15');
    bg.addColorStop(0.55, '#0a0710');
    bg.addColorStop(1, '#07050b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // speckle noise
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      ctx.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // Manhattan-routed traces
    const TRACES = 110;
    for (let i = 0; i < TRACES; i++) {
      let x = Math.random() * W;
      let y = 40 + Math.random() * (H - 80);
      const col = hueAtZ(zAtX(x));
      const isBus = Math.random() < 0.18;
      ctx.lineWidth = isBus ? 4 : 2;
      ctx.strokeStyle = css(col, isBus ? 0.2 : 0.11 + Math.random() * 0.08);
      ctx.shadowColor = css(col, 0.5);
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segments = 3 + Math.floor(Math.random() * 5);
      for (let s = 0; s < segments; s++) {
        if (s % 2 === 0) {
          x += (Math.random() < 0.5 ? -1 : 1) * (100 + Math.random() * 360);
        } else {
          y += (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 110);
          y = Math.max(24, Math.min(H - 24, y));
        }
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // node at the end of the run
      ctx.fillStyle = css(col, 0.4);
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }

    // vias — small open rings
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W;
      const y = 30 + Math.random() * (H - 60);
      const col = hueAtZ(zAtX(x));
      ctx.strokeStyle = css(col, 0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 3 + Math.random() * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // IC chips — rectangles with pin stubs
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * (W - 80);
      const y = 60 + Math.random() * (H - 160);
      const col = hueAtZ(zAtX(x));
      const w = 44 + Math.random() * 40;
      const h = 22 + Math.random() * 18;
      ctx.strokeStyle = css(col, 0.32);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 1.5;
      for (let px = x + 6; px < x + w - 4; px += 9) {
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y - 5);
        ctx.moveTo(px, y + h);
        ctx.lineTo(px, y + h + 5);
        ctx.stroke();
      }
    }

    // glints — the only marks bright enough to catch the bloom
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * W;
      const y = 30 + Math.random() * (H - 60);
      const col = hueAtZ(zAtX(x)).lerp(new THREE.Color('#ffffff'), 0.55);
      ctx.fillStyle = css(col, 0.85);
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + Math.random() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  const wallGeo = new THREE.PlaneGeometry(streetLen, 16);
  const leftWall = new THREE.Mesh(
    wallGeo,
    new THREE.MeshBasicMaterial({ map: makeWallArtTexture(false) })
  );
  leftWall.position.set(-WALL_X, 8, wallCenterZ);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(
    wallGeo,
    new THREE.MeshBasicMaterial({ map: makeWallArtTexture(true) })
  );
  rightWall.position.set(WALL_X, 8, wallCenterZ);
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

  const endTitle = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 2.1),
    new THREE.MeshBasicMaterial({
      map: makeTextTexture("the street ends, the work doesn't", '#fc5553', 88, '"Neonderthaw", cursive'),
      transparent: true,
      fog: false,
    })
  );
  endTitle.position.set(0, 6.6, endZ - 5.8);
  scene.add(endTitle);

  // text meshes that stay hidden until the visitor walks past the marquee
  const endTexts: import('three').Mesh[] = [endTitle];

  const links: Array<{ text: string; url: string; color: string; y: number }> = [
    { text: 'github.com/rakeshgangwar', url: 'https://github.com/rakeshgangwar', color: '#bfee21', y: 4.4 },
    { text: 'github.com/SuperJackfruitLabs', url: 'https://github.com/SuperJackfruitLabs', color: '#09e6f2', y: 2.9 },
  ];
  for (const link of links) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 1.65),
      new THREE.MeshBasicMaterial({ map: makeTextTexture(link.text, link.color), transparent: true, fog: false })
    );
    mesh.position.set(0, link.y, endZ - 5.8);
    mesh.userData.url = link.url;
    scene.add(mesh);
    clickables.push(mesh);
    endTexts.push(mesh);
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
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42,
    0.32,
    0.5
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- movement & interaction ----------

  let targetZ = CAM_START_Z;
  let mouseX = 0;
  const minZ = endZ + 8;
  const clampZ = () => {
    targetZ = Math.max(minZ, Math.min(CAM_START_Z, targetZ));
  };

  // "enter the shop" focus mode — set on sign click, cleared when the panel closes
  let focusPose: { pos: import('three').Vector3; look: import('three').Vector3 } | null = null;
  let focusedMesh: import('three').Object3D | null = null;
  const panelOpen = () => document.body.classList.contains('panel-open');

  function focusOnSign(mesh: import('three').Object3D): void {
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation).normalize();
    const pos = mesh.position.clone().addScaledVector(normal, 6.8);
    pos.y = SIGN_Y - 0.2;
    const forward = mesh.position.clone().sub(pos).normalize();
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    // aim right of the sign so it settles on the left half, clear of the panel
    const look = mesh.position.clone().addScaledVector(right, 1.15);
    focusPose = { pos, look };
    focusedMesh = mesh;
  }

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (panelOpen()) return;
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
    if (!dragging || panelOpen()) return;
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
    // Raycaster ignores `visible`, so filter out text hidden behind the marquee
    const hit = raycaster.intersectObjects(clickables.filter((o) => o.visible), false)[0];
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
      focusOnSign(obj);
      // let the camera start its glide before the panel slides in
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('project:open', {
            detail: { project: obj.userData.project, accent: obj.userData.accent },
          })
        );
      }, 380);
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
  const white = new THREE.Color(0xffffff);
  const startTime = performance.now();
  const lookTarget = new THREE.Vector3(0, CAM_Y - 0.3, CAM_START_Z - 12);
  const desiredLook = new THREE.Vector3();
  let panelWasOpen = false;
  let reflectionsHidden = false;

  renderer.setAnimationLoop(() => {
    if (document.hidden) return;
    const t = (performance.now() - startTime) / 1000;

    // step back onto the street once the panel closes
    if (panelOpen()) panelWasOpen = true;
    else if (panelWasOpen) {
      panelWasOpen = false;
      focusPose = null;
      focusedMesh = null;
    }

    if (focusPose) {
      camera.position.lerp(focusPose.pos, 0.06);
      desiredLook.copy(focusPose.look);
    } else {
      camera.position.z += (targetZ - camera.position.z) * 0.06;
      camera.position.x += (mouseX * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (CAM_Y - camera.position.y) * 0.06;
      desiredLook.set(camera.position.x * 0.4, CAM_Y - 0.3, camera.position.z - 12);
    }
    lookTarget.lerp(desiredLook, 0.08);
    camera.lookAt(lookTarget);

    const progress = Math.min(1, Math.max(0, (CAM_START_Z - camera.position.z) / 18));
    window.dispatchEvent(new CustomEvent('street3d:progress', { detail: { progress } }));

    // the marquee owns the entrance: scene text stays hidden until the
    // visitor walks past it, then the alley fades in
    const reveal = Math.min(1, Math.max(0, (progress - 0.3) / 0.35));
    const textVisible = reveal > 0.02;

    // status behavior
    for (const s of signs) {
      const m = s.mesh.material as import('three').MeshBasicMaterial;
      const rm = s.reflection.material as import('three').MeshBasicMaterial;
      m.opacity = reveal;
      s.mesh.visible = textVisible;
      s.reflection.visible = textVisible && !reflectionsHidden;
      if (s.mesh === focusedMesh) {
        // the shopkeeper turns the sign fully on when you step to the window
        m.color.copy(white);
        rm.opacity = 0.16 * reveal;
      } else if (s.status === 'wip') {
        // irregular flicker: mostly on, occasional dropouts
        const n = Math.sin(t * 7 + s.seed) * Math.sin(t * 13.7 + s.seed * 2) * Math.sin(t * 3.1 + s.seed);
        const on = n > -0.88;
        m.color.copy(on ? white : dim);
        rm.opacity = (on ? 0.16 : 0.05) * reveal;
      } else if (s.status === 'experiment') {
        const buzz = 0.62 + 0.1 * Math.sin(t * 40 + s.seed) + 0.06 * Math.sin(t * 9 + s.seed);
        m.color.copy(white).multiplyScalar(buzz);
        rm.opacity = 0.1 * reveal;
      } else {
        rm.opacity = 0.16 * reveal;
      }
    }

    // gates fade out as you walk up to them instead of blooming across the view
    for (const gate of gates) {
      const dist = camera.position.z - gate.position.z;
      const mat = gate.material as import('three').MeshBasicMaterial;
      mat.opacity = Math.max(0, Math.min(1, (dist - 8) / 14)) * reveal;
      gate.visible = textVisible;
    }

    for (const textMesh of endTexts) {
      (textMesh.material as import('three').MeshBasicMaterial).opacity = reveal;
      textMesh.visible = textVisible;
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
    setBloom: (strength: number) => {
      bloom.strength = strength;
    },
    teleportFacing: (slug: string, dist: number) => {
      const s = signs.find((x) => x.project.slug === slug);
      if (!s) return false;
      const normal = new THREE.Vector3(0, 0, 1).applyEuler(s.mesh.rotation).normalize();
      const pos = s.mesh.position.clone().addScaledVector(normal, dist);
      focusPose = { pos, look: s.mesh.position.clone() };
      camera.position.copy(pos);
      lookTarget.copy(s.mesh.position);
      return true;
    },
    hideReflections: (hide: boolean) => {
      reflectionsHidden = hide;
    },
    signTexture: (slug: string) => {
      const s = signs.find((x) => x.project.slug === slug);
      const img = (s?.mesh.material as import('three').MeshBasicMaterial | undefined)?.map?.image;
      return img instanceof HTMLCanvasElement ? img.toDataURL('image/png') : null;
    },
    focusInfo: () => {
      const s = signs.find((x) => x.mesh === focusedMesh);
      if (!s) return null;
      const m = s.mesh.material as import('three').MeshBasicMaterial;
      return {
        slug: s.project.slug,
        color: m.color.getHexString(),
        fog: m.fog,
        scale: s.mesh.scale.x,
        camDist: camera.position.distanceTo(s.mesh.position),
      };
    },
  };

  return true;
}
