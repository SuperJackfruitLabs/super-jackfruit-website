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
  intensity: number;
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
  const { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect } = await import('postprocessing');

  // fonts must be ready before we draw sign textures
  await Promise.all([
    document.fonts.load('90px "Tilt Neon"'),
    document.fonts.load('40px "Inconsolata Variable"'),
    document.fonts.load('64px "Tilt Neon"'),
  ]).catch(() => {});

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.FogExp2(INK, 0.042);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, CAM_Y, CAM_START_Z);


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
    // transparent background — the sign is just tube, text, and glow on the wall

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
    ctx.font = '84px "Tilt Neon", sans-serif';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(239,233,220,0.92)';
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px';
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
      // 1.75 off the wall: the tilt swings the wall-side corner ~1.47 back,
      // and the 1.05 hover scale adds more — this keeps it clear of the wall
      mesh.position.set(side * (WALL_X - 1.75), SIGN_Y, z);
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
      signs.push({ mesh, reflection: refl, project, baseColor, status: project.status, seed: Math.random() * 100, intensity: 1 });
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

  // aurora-smoke walls: live GPU shader — domain-warped fbm noise drifting
  // slowly, colored by a district-hue lookup along the street. Float
  // precision + dithering means no banding, and it actually moves.
  const hueCanvas = document.createElement('canvas');
  hueCanvas.width = 512;
  hueCanvas.height = 1;
  {
    const hctx = hueCanvas.getContext('2d')!;
    for (let x = 0; x < 512; x++) {
      const zWorld = wallZNear - (x / 511) * streetLen;
      const col = hueAtZ(zWorld);
      hctx.fillStyle = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
      hctx.fillRect(x, 0, 1, 1);
    }
  }
  const hueTex = new THREE.CanvasTexture(hueCanvas);
  hueTex.colorSpace = THREE.SRGBColorSpace;
  hueTex.wrapS = hueTex.wrapT = THREE.ClampToEdgeWrapping;

  const auroraVertex = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const auroraFragment = /* glsl */ `
    uniform float uTime;
    uniform float uZNear;
    uniform float uLen;
    uniform sampler2D uHue;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying vec2 vUv;
    varying vec3 vWorld;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p *= 2.03;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      // world-space pattern: one continuous volume of haze across every
      // surface (side walls, ceiling), not a per-plane wallpaper
      float along = clamp((uZNear - vWorld.z) / uLen, 0.0, 1.0);
      vec3 hue = texture2D(uHue, vec2(along, 0.5)).rgb;

      // the x-term keeps the pattern 2D on the end wall, where z is constant
      vec2 p = vec2((uZNear - vWorld.z) * 0.09 + vWorld.x * 0.11, (vWorld.y + vWorld.x) * 0.15);
      float t = uTime * 0.045;
      vec2 q = vec2(
        fbm(p + vec2(t * 0.7, t * 0.25)),
        fbm(p + vec2(-t * 0.4, t * 0.55) + 5.2)
      );
      float n = fbm(p + 2.2 * q);
      float band = smoothstep(0.42, 0.9, n);
      float glow = band * (0.12 + 0.5 * n) * 0.55;

      float height = clamp(vWorld.y / 16.0, 0.0, 1.0);
      vec3 base = mix(vec3(0.020, 0.014, 0.030), vec3(0.008, 0.006, 0.014), height);
      vec3 col = base + hue * glow;

      float d = distance(cameraPosition, vWorld);
      float f = clamp(1.0 - exp(-uFogDensity * d), 0.0, 1.0);
      col = mix(col, uFogColor, f);

      // static spatial dither keeps the darks band-free without temporal noise
      col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const auroraMaterial = new THREE.ShaderMaterial({
    vertexShader: auroraVertex,
    fragmentShader: auroraFragment,
    uniforms: {
      uTime: { value: 0 },
      uZNear: { value: wallZNear },
      uLen: { value: streetLen },
      uHue: { value: hueTex },
      uFogColor: { value: new THREE.Color(INK) },
      uFogDensity: { value: 0.042 },
    },
  });

  const wallGeo = new THREE.PlaneGeometry(streetLen, 16);
  const leftWall = new THREE.Mesh(wallGeo, auroraMaterial);
  leftWall.position.set(-WALL_X, 8, wallCenterZ);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(wallGeo, auroraMaterial);
  rightWall.position.set(WALL_X, 8, wallCenterZ);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // ceiling: the same haze volume wraps overhead
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, streetLen), auroraMaterial);
  ceiling.position.set(0, 16, wallCenterZ);
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // ground: semi-transparent so reflections beneath show through
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_X * 2, streetLen),
    new THREE.MeshBasicMaterial({ color: 0x0b0b12, transparent: true, opacity: 0.8 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, endZ / 2 + CAM_START_Z / 2);
  scene.add(ground);

  // end wall: same ember aurora smoke as the rest of the corridor
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X * 2, 16), auroraMaterial);
  endWall.position.set(0, 8, endZ - 6);
  scene.add(endWall);

  // scanline sun — the street ends at a synthwave horizon
  function makeSunTexture(): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const ctx = c.getContext('2d')!;
    const cx = 512;
    const cy = 470;
    const r = 340;

    // soft halo behind the disc
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.5);
    halo.addColorStop(0, 'rgba(252, 85, 83, 0.30)');
    halo.addColorStop(1, 'rgba(252, 85, 83, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 1024, 1024);

    // ember → amber disc
    const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    grad.addColorStop(0, '#fc5553');
    grad.addColorStop(0.55, '#f2822e');
    grad.addColorStop(1, '#f2a707');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // scanline gaps widening toward the horizon
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    let y = cy + r * 0.05;
    let gap = 7;
    while (y < cy + r) {
      ctx.fillRect(0, y, 1024, gap);
      y += gap + Math.max(14, 44 - gap * 2.2);
      gap += 7;
    }
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(8.2, 8.2),
    new THREE.MeshBasicMaterial({ map: makeSunTexture(), transparent: true, fog: false })
  );
  sun.position.set(0, 9.6, endZ - 5.95);
  scene.add(sun);

  const endTitle = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 2.1),
    new THREE.MeshBasicMaterial({
      map: makeTextTexture("the street ends, the work doesn't", '#fc5553', 76, '"Tilt Neon", sans-serif'),
      transparent: true,
      fog: false,
    })
  );
  endTitle.position.set(0, 5.3, endZ - 5.8);
  scene.add(endTitle);

  // meshes that stay hidden until the visitor walks past the marquee
  const endTexts: import('three').Mesh[] = [endTitle, sun];

  const links: Array<{ text: string; url: string; color: string; y: number }> = [
    { text: 'github.com/rakeshgangwar', url: 'https://github.com/rakeshgangwar', color: '#bfee21', y: 3.6 },
    { text: 'github.com/SuperJackfruitLabs', url: 'https://github.com/SuperJackfruitLabs', color: '#09e6f2', y: 2.4 },
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

  // ---------- post-processing ----------

  // pmndrs postprocessing: mipmap-blurred bloom is temporally stable (no
  // half-res shimmer) and SMAA removes edge crawl during motion
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({
    intensity: 0.55,
    luminanceThreshold: 0.45,
    luminanceSmoothing: 0.25,
    mipmapBlur: true,
    radius: 0.65,
  });
  composer.addPass(new EffectPass(camera, bloom, new SMAAEffect()));

  // ---------- movement & interaction ----------

  let targetZ = CAM_START_Z;
  let mouseX = 0;
  const minZ = endZ + 8;
  const clampZ = () => {
    targetZ = Math.max(minZ, Math.min(CAM_START_Z, targetZ));
  };

  // "enter the shop" focus mode — set on sign click; details appear on an
  // in-world info board on the wall beside the sign, not a DOM overlay
  let focusPose: { pos: import('three').Vector3; look: import('three').Vector3 } | null = null;
  let focusedMesh: import('three').Object3D | null = null;

  const STATUS_COPY: Record<string, string> = {
    stable: 'lit & steady · open for business',
    wip: 'wet paint · mind the sparks',
    experiment: 'half-lit · enter at your own risk',
  };
  const STATUS_COLOR: Record<string, string> = {
    stable: '#0fe513',
    wip: '#f2a707',
    experiment: '#a12cf9',
  };

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = probe;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function makeBoardTexture(project: Project, accent: string): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1350;
    c.height = 1000;
    const ctx = c.getContext('2d')!;

    // whisper of backing so the text reads over the aurora
    ctx.fillStyle = 'rgba(4, 4, 10, 0.55)';
    roundRect(ctx, 8, 8, c.width - 16, c.height - 16, 44);
    ctx.fill();
    ctx.strokeStyle = `${accent}55`;
    ctx.lineWidth = 3;
    roundRect(ctx, 8, 8, c.width - 16, c.height - 16, 44);
    ctx.stroke();

    let y = 130;
    // status line
    ctx.fillStyle = STATUS_COLOR[project.status] ?? '#0fe513';
    ctx.beginPath();
    ctx.arc(90, y - 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '52px "Inconsolata Variable", monospace';
    ctx.fillStyle = 'rgba(239,233,220,0.7)';
    ctx.fillText(STATUS_COPY[project.status] ?? '', 130, y);
    y += 110;

    // description
    ctx.font = '58px "Inconsolata Variable", monospace';
    ctx.fillStyle = '#efe9dc';
    const lines = wrapText(ctx, project.description, c.width - 180);
    for (const line of lines.slice(0, 8)) {
      ctx.fillText(line, 90, y);
      y += 86;
    }

    // tags
    y = Math.min(y + 40, c.height - 90);
    ctx.font = '48px "Inconsolata Variable", monospace';
    ctx.fillStyle = 'rgba(239,233,220,0.6)';
    ctx.fillText(project.tags.map((tag) => `[${tag}]`).join('  '), 90, y);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  function makeButtonTexture(label: string, accent: string): import('three').CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 220;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    roundRect(ctx, 14, 14, c.width - 28, c.height - 28, 36);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.font = '82px "Inconsolata Variable", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, c.width / 2, c.height / 2 + 4);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  // reusable board + buttons, retextured per project
  const BOARD_DZ = 7.9; // how far past the sign, along the wall
  const boardMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.85),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, fog: false })
  );
  const githubBtn = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.78),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, fog: false })
  );
  const demoBtn = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.78),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, fog: false })
  );
  boardMesh.visible = githubBtn.visible = demoBtn.visible = false;
  scene.add(boardMesh, githubBtn, demoBtn);
  clickables.push(githubBtn, demoBtn);
  let boardTargetOpacity = 0;
  let boardOpacity = 0;

  function closeBoard(): void {
    boardTargetOpacity = 0;
    focusPose = null;
    focusedMesh = null;
  }

  function focusOnSign(mesh: import('three').Object3D): void {
    const project = mesh.userData.project as Project;
    const accent = mesh.userData.accent as string;
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation).normalize();

    // dress the board and its buttons for this project
    const bm = boardMesh.material as import('three').MeshBasicMaterial;
    bm.map?.dispose();
    bm.map = makeBoardTexture(project, accent);
    bm.needsUpdate = true;
    boardMesh.position.copy(mesh.position);
    boardMesh.position.z -= BOARD_DZ;
    boardMesh.position.y = SIGN_Y - 0.2;
    // lift slightly off the wall so the sign's tilted far edge can't occlude it
    boardMesh.position.addScaledVector(normal, 0.45);
    boardMesh.rotation.copy(mesh.rotation);

    const gm = githubBtn.material as import('three').MeshBasicMaterial;
    gm.map?.dispose();
    gm.map = makeButtonTexture('view source →', accent);
    gm.needsUpdate = true;
    githubBtn.position.copy(boardMesh.position);
    githubBtn.position.y = SIGN_Y - 2.65;
    githubBtn.rotation.copy(mesh.rotation);
    githubBtn.userData.url = project.github;

    if (project.demo) {
      const dm = demoBtn.material as import('three').MeshBasicMaterial;
      dm.map?.dispose();
      dm.map = makeButtonTexture('live demo →', accent);
      dm.needsUpdate = true;
      demoBtn.position.copy(boardMesh.position);
      demoBtn.position.y = SIGN_Y - 3.6;
      demoBtn.rotation.copy(mesh.rotation);
      demoBtn.userData.url = project.demo;
    }
    demoBtn.visible = Boolean(project.demo);
    boardMesh.visible = githubBtn.visible = true;
    boardTargetOpacity = 1;

    // frame the sign + board pair like reading a shop's menu
    const mid = mesh.position.clone().lerp(boardMesh.position, 0.5);
    mid.y = SIGN_Y - 0.9;
    const pos = mid.clone().addScaledVector(normal, 9.2);
    pos.y = SIGN_Y - 0.4;
    focusPose = { pos, look: mid };
    focusedMesh = mesh;
  }

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (focusedMesh) closeBoard(); // walking away dismisses the board
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
    if (moved > 6 && focusedMesh) closeBoard();
    targetZ = dragStartZ + dy * 0.05;
    clampZ();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  const KEY_STEP = 6;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focusedMesh) {
      closeBoard();
      return;
    }
    const fwd = ['ArrowUp', 'w', 'W', 'ArrowRight'].includes(e.key);
    const back = ['ArrowDown', 's', 'S', 'ArrowLeft'].includes(e.key);
    if (!fwd && !back) return;
    if (focusedMesh) closeBoard(); // walking away dismisses the board
    targetZ += fwd ? -KEY_STEP : KEY_STEP;
    clampZ();
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
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- render loop ----------

  const white = new THREE.Color(0xffffff);
  const startTime = performance.now();
  let lastT = 0;

  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const u = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return u * u * (3 - 2 * u);
  };
  const lookTarget = new THREE.Vector3(0, CAM_Y - 0.3, CAM_START_Z - 12);
  const desiredLook = new THREE.Vector3();
  let reflectionsHidden = false;

  renderer.setAnimationLoop(() => {
    if (document.hidden) return;
    const t = (performance.now() - startTime) / 1000;

    const dt = Math.min(0.1, Math.max(0.001, t - lastT));
    lastT = t;

    if (focusPose) {
      camera.position.lerp(focusPose.pos, 0.06);
      desiredLook.copy(focusPose.look);
    } else {
      // holding a key can't glitch the walk: the target never runs far
      // ahead of the camera, and speed is capped in real units/second
      targetZ = Math.max(camera.position.z - 26, Math.min(camera.position.z + 26, targetZ));
      let dz = (targetZ - camera.position.z) * 0.06;
      const maxStep = 40 * dt;
      dz = Math.max(-maxStep, Math.min(maxStep, dz));
      camera.position.z += dz;
      camera.position.x += (mouseX * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (CAM_Y - camera.position.y) * 0.06;
      desiredLook.set(camera.position.x * 0.4, CAM_Y - 0.3, camera.position.z - 12);
    }
    lookTarget.lerp(desiredLook, 0.08);
    if (!focusPose) {
      // z must track the camera rigidly: any lag here shortens the look
      // distance while walking and pitches the camera down with speed (bob)
      lookTarget.z = desiredLook.z;
      lookTarget.y = desiredLook.y;
    }
    camera.lookAt(lookTarget);

    const progress = Math.min(1, Math.max(0, (CAM_START_Z - camera.position.z) / 18));
    window.dispatchEvent(new CustomEvent('street3d:progress', { detail: { progress } }));

    // the marquee owns the entrance: scene text stays hidden until the
    // visitor walks past it, then the alley fades in
    const reveal = Math.min(1, Math.max(0, (progress - 0.3) / 0.35));
    const textVisible = reveal > 0.02;

    // status behavior — a continuous intensity signal per sign: noise shaped
    // through smoothstep (dips ease in and out) then low-pass filtered so the
    // tube dims and re-ignites with inertia instead of snapping between frames
    const ease = 1 - Math.exp(-9 * dt);
    for (const s of signs) {
      const m = s.mesh.material as import('three').MeshBasicMaterial;
      const rm = s.reflection.material as import('three').MeshBasicMaterial;
      s.mesh.visible = textVisible;
      s.reflection.visible = textVisible && !reflectionsHidden;

      let target: number;
      if (s.mesh === focusedMesh) {
        // the shopkeeper turns the sign fully on when you step to the window
        target = 1;
      } else if (s.status === 'wip') {
        // mostly lit, with occasional dips that ramp down and recover
        const n = Math.sin(t * 7 + s.seed) * Math.sin(t * 13.7 + s.seed * 2) * Math.sin(t * 3.1 + s.seed);
        const lit = smoothstep(-0.92, -0.5, n);
        target = (0.45 + 0.55 * lit) * (0.97 + 0.03 * Math.sin(t * 2.3 + s.seed));
      } else if (s.status === 'experiment') {
        // half-lit hum: slow wander + faint fast shimmer, occasional sag
        const sag = smoothstep(-0.95, -0.7, Math.sin(t * 1.9 + s.seed * 3) * Math.sin(t * 5.3 + s.seed));
        target = (0.5 + 0.16 * sag) + 0.06 * Math.sin(t * 8 + s.seed) + 0.03 * Math.sin(t * 19.3 + s.seed * 2);
      } else {
        // stable: steady with the faintest breathing so it reads as gas, not pixels
        target = 0.985 + 0.015 * Math.sin(t * 1.7 + s.seed);
      }

      // slew-limited: even on a dropped frame the step stays gentle
      const maxStep = 2.2 * dt;
      const step = (target - s.intensity) * ease;
      s.intensity += Math.max(-maxStep, Math.min(maxStep, step));
      m.color.copy(white).multiplyScalar(s.intensity);
      m.opacity = reveal;
      rm.opacity = 0.16 * s.intensity * reveal;
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

    // aurora drift
    auroraMaterial.uniforms.uTime.value = t;

    // info board fade
    boardOpacity += (boardTargetOpacity - boardOpacity) * (1 - Math.exp(-10 * dt));
    for (const m of [boardMesh, githubBtn, demoBtn]) {
      (m.material as import('three').MeshBasicMaterial).opacity = boardOpacity;
    }
    if (boardTargetOpacity === 0 && boardOpacity < 0.02) {
      boardMesh.visible = githubBtn.visible = demoBtn.visible = false;
    }


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
    pitch: () => camera.rotation.x,
    intensityOf: (slug: string) => signs.find((x) => x.project.slug === slug)?.intensity ?? null,
    setBloom: (strength: number) => {
      bloom.intensity = strength;
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
