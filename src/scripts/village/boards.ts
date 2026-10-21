// Signboards: project boards at the kerb, district gates, and info boards on
// the square. Each is drawn twice into a canvas — warm paper for daylight,
// neon-on-ink for after dark — and swaps map + emissive as night comes in.
import type * as T from 'three';
import type { Three } from './types';
import type { District, Project } from '../../data/projects';


interface ThemedBoard {
  mat: T.MeshLambertMaterial;
  dayTex: T.CanvasTexture;
  nightTex: T.CanvasTexture;
}

export interface BoardKit {
  projectBoard(project: Project, accent: string, x: number, z: number, facing: number): void;
  suiteBoard(step: number, project: Project, x: number, z: number, facing: number, logo?: HTMLImageElement): void;
  districtBoard(d: District, gx: number, gz: number, facing: number): void;
  infoBoard(title: string, sub: string, accent: string, x: number, z: number, facing: number, big?: { logo?: HTMLImageElement; width: number; scale: number; gate?: boolean; backTitle?: string }): void;
  /** Main Street: a round sign swinging from an iron bracket */
  hangingSign(project: Project, x: number, z: number, facing: number, logo?: HTMLImageElement): void;
  /** the Agent Quarter: a flag on a tall pole */
  flag(project: Project, x: number, z: number, facing: number, logo?: HTMLImageElement, opts?: { baseY?: number; emblem?: boolean }): void;
  /** MCP Alley: a little terminal on a post, with a status light and a cable into the ground */
  kiosk(project: Project, accent: string, x: number, z: number, facing: number): void;
  /** the Odd Shop: a rough plank with the name carved in */
  plank(project: Project, accent: string, x: number, z: number, facing: number): void;
  /** the lab: a stone block with a brass plaque */
  monument(title: string, sub: string, x: number, z: number, facing: number, logo?: HTMLImageElement): void;
  /** a post of arrow boards; `dir` is −1 for left, +1 for right, 0 for straight on */
  fingerpost(arrows: Array<{ text: string; accent: string; dir: -1 | 0 | 1 }>, x: number, z: number, facing: number): void;
  /** a chalk A-board on the pavement */
  chalkboard(title: string, lines: string[], x: number, z: number, facing: number): void;
  /** over a street's mouth: stone pillars, a beam, and a name board hung from it */
  streetArch(title: string, sub: string, accent: string, x: number, z: number, facing: number, span: number): void;
  /** a string of flags in the suite's colours, across the road between two poles */
  bunting(ax: number, az: number, bx: number, bz: number, colours: string[]): void;
  applyNight(nightFactor: number): void;
  /** the swaying and flapping */
  tick(t: number): void;
}

export function statusDotColor(status: string): string {
  return status === 'stable' || status === 'released' || status === 'live' ? '#3f9e3f' : status === 'wip' ? '#d98a1f' : '#8a5fc9';
}

export function createBoards(
  THREE: Three,
  scene: T.Scene,
  maxAniso: number,
  addCollider: (x: number, z: number, hx: number, hz: number, rotY: number) => void
): BoardKit {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const themed: ThemedBoard[] = [];
  let nightMode = false;

  function texture(
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 640, h = 360
  ): T.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  function themedMaterial(
    draw: (night: boolean) => (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    w?: number, h?: number
  ): T.MeshLambertMaterial {
    const dayTex = texture(draw(false), w, h);
    const nightTex = texture(draw(true), w, h);
    const mat = new THREE.MeshLambertMaterial({ map: dayTex, emissiveMap: nightTex, emissive: 0x000000 });
    themed.push({ mat, dayTex, nightTex });
    return mat;
  }

  // small lamps on the posts, lit with the boards when night falls
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff1c4, emissive: 0x000000 });
  const capGeo = new THREE.SphereGeometry(1, 12, 8);
  function posts(group: T.Group, xs: number[], height: number, thickness: number, z: number): void {
    for (const px of xs) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, thickness), wood);
      post.position.set(px, height / 2, z);
      post.castShadow = true;
      const cap = new THREE.Mesh(capGeo, wood);
      cap.scale.setScalar(thickness * 0.85);
      cap.position.set(px, height, z);
      const lamp = new THREE.Mesh(capGeo, lampMat);
      lamp.scale.setScalar(thickness * 0.75);
      lamp.position.set(px, height + thickness * 1.4, z);
      group.add(post, cap, lamp);
    }
  }
  // a painted rim a shade darker than the board, inset from its edge
  function rim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(18, 18, w - 36, h - 36, 22);
    ctx.stroke();
    ctx.restore();
  }


  // Every sign in the village is one style: a tall board in its own colour,
  // big enough to read from the far end of the block — an optional lead (the
  // suite's step number, an arrow), a title, and a line under it.
  function bigBoard(
    o: { lead?: string; logo?: HTMLImageElement; title: string; sub: string; accent: string; fg?: string },
    x: number, z: number, facing: number,
    /** panel width in metres (the canvas widens with it, so the type keeps its shape) and overall scale */
    size: { width: number; scale: number; gate?: boolean; backTitle?: string } = { width: 4.2, scale: 1 }
  ): void {
    const { lead, logo, title, sub, accent, fg } = o;
    // a gate with a mark is taller, so the mark can sit above the name
    const tall = size.gate && logo ? 486 : 320;
    const panelH = (1.31 * tall) / 320;
    // painted once per face that needs its own words (a pointer's arrow flips on the back)
    const paint = (title: string) => themedMaterial(
      (night) => (ctx, w, h) => {
        ctx.fillStyle = night ? '#131828' : accent;
        ctx.fillRect(0, 0, w, h);
        if (night) {
          ctx.strokeStyle = accent;
          ctx.lineWidth = 16;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 24;
          ctx.strokeRect(12, 12, w - 24, h - 24);
          ctx.shadowBlur = 0;
        }
        if (!night) rim(ctx, w, h);
        ctx.fillStyle = night ? '#ffffff' : (fg ?? '#fffaf0');
        if (size.gate) {
          // an arch is read head-on above the road: everything centred, the mark above the name
          ctx.textAlign = 'center';
          let y = 0;
          if (logo) {
            ctx.fillStyle = night ? '#252c42' : '#ffffff';
            ctx.beginPath();
            ctx.roundRect(w / 2 - 78, 38, 156, 156, 30);
            ctx.fill();
            ctx.drawImage(logo, w / 2 - 66, 50, 132, 132);
            ctx.fillStyle = night ? '#ffffff' : (fg ?? '#fffaf0');
            y = 166;
          }
          ctx.font = '800 112px "Bricolage Grotesque Variable", sans-serif';
          ctx.fillText(title, w / 2, y + 150, w - 100);
          ctx.globalAlpha = 0.88;
          ctx.font = '600 54px "Figtree Variable", sans-serif';
          ctx.fillText(sub, w / 2, y + 228, w - 100);
          ctx.globalAlpha = 1;
          return;
        }
        ctx.textAlign = 'left';
        let left = 56;
        if (logo) {
          // the mark sits on its own white tile, so a yellow logo still reads on an olive board;
          // after dark a white tile would glare, so it's a lifted shade of the ink instead
          ctx.fillStyle = night ? '#252c42' : '#ffffff';
          ctx.beginPath();
          ctx.roundRect(36, 40, 240, 240, 36);
          ctx.fill();
          ctx.drawImage(logo, 56, 60, 200, 200);
          ctx.fillStyle = night ? '#ffffff' : (fg ?? '#fffaf0');
          left = 316;
        } else if (lead) {
          ctx.font = '800 210px "Bricolage Grotesque Variable", sans-serif';
          ctx.fillText(lead, 56, 250);
          left = 56 + ctx.measureText(lead).width + 40;
        }
        ctx.font = '800 112px "Bricolage Grotesque Variable", sans-serif';
        ctx.fillText(title, left, 190, w - left - 40);
        ctx.globalAlpha = 0.88;
        ctx.font = '600 54px "Figtree Variable", sans-serif';
        ctx.fillText(sub, left + 4, 262, w - left - 40);
        ctx.globalAlpha = 1;
      },
      Math.round((1024 * size.width) / 4.2),
      tall
    );
    const mat = paint(title);

    const group = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(size.width, panelH), mat);
    // an arch is raised clear of the chase camera (about 4 m up). An ordinary board
    // already is: its panel spans ~2.25–3.55 m, over the car and under the lens
    const lift = size.gate ? 1.2 : 0;
    panel.position.set(0, 2.9 + lift + (panelH - 1.31) / 2, 0.06);
    panel.castShadow = true;
    const panelBack = panel.clone();
    if (size.backTitle) panelBack.material = paint(size.backTitle);
    panelBack.rotation.y = Math.PI;
    panelBack.position.z = -0.06;
    posts(group, [-(size.width / 2 - 0.2), size.width / 2 - 0.2], 3.6 + lift + (panelH - 1.31), 0.13, 0);
    group.add(panel, panelBack);
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    group.scale.setScalar(size.scale);
    scene.add(group);
    // only the posts are solid, so the car drives underneath any panel
    const off = (size.width / 2 - 0.2) * size.scale;
    for (const k of [-1, 1]) addCollider(x + Math.cos(facing) * off * k, z - Math.sin(facing) * off * k, 0.3, 0.3, facing);
  }

  // ---------- the street furniture: one kind of sign per place ----------
  const iron = new THREE.MeshLambertMaterial({ color: 0x2d2f33 });
  const steel = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
  const timber = new THREE.MeshLambertMaterial({ color: 0x7a5534 });
  const stone = new THREE.MeshLambertMaterial({ color: 0xb9b2a4 });
  const stoneDark = new THREE.MeshLambertMaterial({ color: 0x8f887a });
  const swingers: Array<{ o: T.Object3D; phase: number; amp: number }> = [];
  const flags: Array<{ front: T.BufferGeometry; back: T.BufferGeometry; base: Float32Array; phase: number; fly: T.Object3D; w: number; hang: number }> = [];
  const glowMats: Array<{ mat: T.MeshLambertMaterial; color: number }> = [];

  const place = (group: T.Group, x: number, z: number, facing: number, scale = 1) => {
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    group.scale.setScalar(scale);
    group.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; });
    scene.add(group);
  };
  const box = (w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };
  /** a painted face, front and back, so a sign reads from both directions */
  const faces = (mat: T.Material, w: number, h: number, depth: number, geo?: T.BufferGeometry, backMat?: T.Material) => {
    const g = new THREE.Group();
    const front = new THREE.Mesh(geo ?? new THREE.PlaneGeometry(w, h), mat);
    front.position.z = depth / 2 + 0.005;
    const back = front.clone();
    if (backMat) back.material = backMat;
    back.rotation.y = Math.PI;
    back.position.z = -depth / 2 - 0.005;
    g.add(front, back);
    return g;
  };
  const font = (weight: number, px: number, family = '"Bricolage Grotesque Variable", sans-serif') => `${weight} ${px}px ${family}`;
  const logoTile = (ctx: CanvasRenderingContext2D, logo: HTMLImageElement | undefined, x: number, y: number, size: number, night: boolean) => {
    if (!logo) return;
    ctx.fillStyle = night ? '#252c42' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, size * 0.18);
    ctx.fill();
    ctx.drawImage(logo, x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.8);
  };
  const neon = (ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, round = false) => {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 14;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    if (round) ctx.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2);
    else ctx.roundRect(10, 10, w - 20, h - 20, 18);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  const shortLine = (p: Project) => p.tagline.split(' — ').pop() ?? p.tagline;

  // --- hanging blade sign ---
  function hangingSign(project: Project, x: number, z: number, facing: number, logo?: HTMLImageElement): void {
    const accent = project.accent ?? '#d98a1f';
    const fg = project.accentFg ?? '#fffaf0';
    const mat = themedMaterial((night) => (ctx, w, h) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.fillStyle = night ? '#131828' : '#f3e6c4';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 26, 0, Math.PI * 2);
      ctx.fillStyle = night ? '#131828' : accent;
      ctx.fill();
      if (night) neon(ctx, w, h, accent, true);
      logoTile(ctx, logo, w / 2 - 110, 150, 220, night);
      ctx.fillStyle = night ? '#ffffff' : fg;
      ctx.textAlign = 'center';
      ctx.font = font(800, 92);
      ctx.fillText(project.name, w / 2, 470, w - 150);
      ctx.globalAlpha = 0.85;
      ctx.font = font(600, 44, '"Figtree Variable", sans-serif');
      ctx.fillText(shortLine(project), w / 2, 540, w - 230);
      ctx.restore();
    }, 720, 720);
    mat.transparent = true;
    mat.alphaTest = 0.5;
    const g = new THREE.Group();
    g.add(box(0.16, 4.6, 0.16, iron, 0, 2.3, 0));
    g.add(box(0.2, 0.2, 0.2, iron, 0, 4.66, 0));
    // the bracket reaches out over the pavement, a curl of iron under it
    g.add(box(2.1, 0.09, 0.09, iron, 1.05, 4.3, 0));
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 6, 16, Math.PI * 1.4), iron);
    curl.position.set(0.42, 3.98, 0);
    g.add(curl);
    const swing = new THREE.Group();
    swing.position.set(1.25, 4.3, 0);
    for (const cx of [-0.5, 0.5]) swing.add(box(0.03, 0.42, 0.03, iron, cx, -0.21, 0));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.09, 40), new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }));
    disc.rotation.x = Math.PI / 2;
    disc.position.y = -1.32;
    const face = faces(mat, 1.8, 1.8, 0.1);
    face.position.y = -1.32;
    swing.add(disc, face);
    g.add(swing);
    swingers.push({ o: swing, phase: Math.random() * 6.28, amp: 0.06 });
    place(g, x, z, facing, 1.25);
    addCollider(x, z, 0.25, 0.25, facing);
  }

  // --- flag ---
  function flag(project: Project, x: number, z: number, facing: number, logo?: HTMLImageElement, opts: { baseY?: number; emblem?: boolean } = {}): void {
    const accent = project.accent ?? '#d98a1f';
    const fg = project.accentFg ?? '#fffaf0';
    const mat = themedMaterial((nightTime) => (ctx, w, h) => {
      // the lab's banner is the same black cloth by day and by night
      const night = opts.emblem ? true : nightTime;
      ctx.fillStyle = opts.emblem ? '#111318' : night ? '#131828' : accent;
      ctx.fillRect(0, 0, w, h);
      if (night && !opts.emblem) neon(ctx, w, h, accent);
      if (opts.emblem) {
        // a banner, not a sign: the mark centred, a band of the suite's colours along the hoist
        const band = ['#8549ef', '#ffc21a', '#f2704e', '#0ea875', '#2196f3', '#f74783'];
        band.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(0, (h / band.length) * i, 70, h / band.length + 1);
        });
        logoTile(ctx, logo, w / 2 - 110 + 35, h / 2 - 110, 220, true);
        return;
      }
      logoTile(ctx, logo, 50, 60, 220, night);
      ctx.fillStyle = night ? '#ffffff' : fg;
      ctx.textAlign = 'left';
      ctx.font = font(800, 104);
      ctx.fillText(project.name, 300, 175, w - 330);
      ctx.globalAlpha = 0.88;
      ctx.font = font(600, 46, '"Figtree Variable", sans-serif');
      ctx.fillText(shortLine(project), 304, 245, w - 330);
    }, 1024, 340);
    mat.side = THREE.FrontSide;
    // the lab's banner is cloth, not a lit sign: out of the day/night swap, so it never glows or changes
    if (opts.emblem) themed.splice(themed.findIndex((tb) => tb.mat === mat), 1);
    const W = opts.emblem ? 2.6 : 3.6, H = opts.emblem ? 1.6 : 1.2;
    const geo = () => {
      const gg = new THREE.PlaneGeometry(W, H, 16, 4);
      gg.translate(W / 2, 0, 0);
      return gg;
    };
    const front = geo();
    const back = geo();
    // the back reads the right way round from behind
    const backUv = back.getAttribute('uv') as T.BufferAttribute;
    for (let i = 0; i < backUv.count; i++) backUv.setX(i, 1 - backUv.getX(i));
    const g = new THREE.Group();
    g.add(box(0.12, 5.4, 0.12, steel, 0, 2.7, 0));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshLambertMaterial({ color: 0xd9b24a }));
    ball.position.y = 5.45;
    g.add(ball);
    const fm = new THREE.Mesh(front, mat);
    const bm = new THREE.Mesh(back, mat);
    bm.rotation.y = Math.PI;
    bm.scale.x = -1;
    // the cloth hangs from a swivel on the pole, so the wind can swing it round
    const fly = new THREE.Group();
    fly.position.set(0, 4.7, 0);
    for (const m of [fm, bm]) m.position.set(0.06, 0, 0);
    fly.add(fm, bm);
    g.add(fly);
    flags.push({ front, back, base: (front.getAttribute('position').array as Float32Array).slice(), phase: Math.random() * 6.28, fly, w: W, hang: 0 });
    // a low plinth so the pole stands on something
    if (opts.baseY) {
      // on a roof: no plinth and nothing for the car to hit
      g.position.y = opts.baseY;
      g.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; });
      g.position.x = x;
      g.position.z = z;
      g.rotation.y = facing;
      scene.add(g);
      return;
    }
    g.add(box(0.7, 0.3, 0.7, stoneDark, 0, 0.15, 0));
    place(g, x, z, facing);
    addCollider(x, z, 0.4, 0.4, facing);
  }

  // --- kiosk ---
  function kiosk(project: Project, accent: string, x: number, z: number, facing: number): void {
    const mat = themedMaterial((night) => (ctx, w, h) => {
      ctx.fillStyle = night ? '#0b0f18' : '#141a26';
      ctx.fillRect(0, 0, w, h);
      // scanlines
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#7fe0ff';
      for (let yy = 0; yy < h; yy += 6) ctx.fillRect(0, yy, w, 1);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.fillStyle = accent;
      ctx.font = font(700, 40, '"IBM Plex Mono", ui-monospace, monospace');
      ctx.fillText('$ mcp connect', 36, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = font(800, 92);
      ctx.fillText(project.name, 36, 200, w - 72);
      ctx.fillStyle = '#9fe8ff';
      ctx.font = font(500, 40, '"IBM Plex Mono", ui-monospace, monospace');
      const words = shortLine(project).split(' ');
      let line = '';
      let yy = 280;
      for (const word of words) {
        if (ctx.measureText(line + word).width > w - 72 && line) {
          ctx.fillText(line, 36, yy);
          line = '';
          yy += 52;
        }
        line += word + ' ';
      }
      ctx.fillText(line, 36, yy);
      ctx.fillStyle = '#3fd18a';
      ctx.fillText('● online', 36, h - 40);
    }, 640, 520);
    const g = new THREE.Group();
    const body = new THREE.MeshLambertMaterial({ color: 0x2b303b });
    g.add(box(0.22, 1.2, 0.22, body, 0, 0.6, 0));
    g.add(box(1.5, 1.3, 0.34, body, 0, 1.85, 0));
    g.add(box(1.62, 0.1, 0.46, iron, 0, 2.55, 0));
    const screen = faces(mat, 1.3, 1.06, 0.34);
    screen.position.y = 1.85;
    g.add(screen);
    const ledMat = new THREE.MeshLambertMaterial({ color: 0x3fd18a, emissive: 0x3fd18a, emissiveIntensity: 0.6 });
    glowMats.push({ mat: ledMat, color: 0x3fd18a });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), ledMat);
    led.position.set(0.62, 2.62, 0);
    g.add(led);
    // the cable: out of the back and into the ground, in the street's colour
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.6, 1.4, -0.17), new THREE.Vector3(0.95, 0.9, -0.5), new THREE.Vector3(1.2, 0.2, -0.9), new THREE.Vector3(1.3, -0.05, -1.3),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.045, 6), new THREE.MeshLambertMaterial({ color: new THREE.Color(accent) })));
    place(g, x, z, facing, 1.35);
    addCollider(x, z, 0.9, 0.3, facing);
  }

  // --- carved plank: a rough-edged board hung on chains from a ranch-style crossbar ---
  function plank(project: Project, accent: string, x: number, z: number, facing: number): void {
    // the outline wobbles a little, as if cut by hand; the same wobble on day and night faces
    const seed = [...project.slug].reduce((n, ch) => n + ch.charCodeAt(0), 0);
    const wob = (i: number) => Math.sin(seed * 0.7 + i * 2.3) * 7;
    const mat = themedMaterial((night) => (ctx, w, h) => {
      ctx.beginPath();
      const steps = 8;
      ctx.moveTo(24, 20 + wob(0));
      for (let i = 1; i <= steps; i++) ctx.lineTo(24 + ((w - 48) * i) / steps, 20 + wob(i));
      ctx.lineTo(w - 10, h / 2);
      for (let i = steps; i >= 0; i--) ctx.lineTo(24 + ((w - 48) * i) / steps, h - 20 + wob(i + 9));
      ctx.lineTo(10, h / 2);
      ctx.closePath();
      ctx.fillStyle = night ? '#2a1d12' : '#c08f57';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = night ? 'rgba(255,200,140,0.07)' : 'rgba(95,58,26,0.28)';
      ctx.lineWidth = 3;
      for (let yy = 30; yy < h; yy += 26) {
        ctx.beginPath();
        ctx.moveTo(0, yy);
        for (let xx = 0; xx <= w; xx += 70) ctx.lineTo(xx, yy + Math.sin(xx * 0.012 + yy + seed) * 5);
        ctx.stroke();
      }
      ctx.restore();
      // a darker burnt edge
      ctx.strokeStyle = night ? accent : '#6e4520';
      ctx.lineWidth = night ? 10 : 8;
      if (night) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 18;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // nail heads where the chains hold it
      ctx.fillStyle = '#3a2a1a';
      for (const nx of [w * 0.14, w * 0.86]) {
        ctx.beginPath();
        ctx.arc(nx, 44, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = 'center';
      // fit the name to the board rather than squash it
      let size = 104;
      ctx.font = font(700, size, 'Georgia, "Times New Roman", serif');
      while (ctx.measureText(project.name).width > w - 170 && size > 56) {
        size -= 4;
        ctx.font = font(700, size, 'Georgia, "Times New Roman", serif');
      }
      if (!night) {
        ctx.fillStyle = 'rgba(255,236,205,0.6)';
        ctx.fillText(project.name, w / 2 + 2, 168 + 3);
      }
      ctx.fillStyle = night ? '#ffe9c8' : '#3a230e';
      ctx.fillText(project.name, w / 2, 168);
      ctx.font = font(400, 46, 'Georgia, "Times New Roman", serif');
      ctx.fillStyle = night ? '#e3cba8' : '#5a3a1c';
      ctx.fillText(shortLine(project), w / 2, 244, w - 190);
    }, 1024, 300);
    mat.transparent = true;
    mat.alphaTest = 0.5;
    const g = new THREE.Group();
    // two posts and a crossbar, behind and above the board so nothing crosses its words
    for (const px of [-2.05, 2.05]) g.add(box(0.2, 3.7, 0.2, timber, px, 1.85, -0.2));
    g.add(box(4.6, 0.2, 0.22, timber, 0, 3.6, -0.2));
    const hang = new THREE.Group();
    hang.position.set(0, 3.5, 0);
    for (const cx of [-1.32, 1.32]) {
      hang.add(box(0.03, 0.42, 0.03, iron, cx, -0.21, -0.1));
    }
    const board = faces(mat, 3.6, 1.05, 0.08);
    board.position.y = -0.95;
    board.rotation.z = Math.sin(seed) * 0.03;
    hang.add(board);
    g.add(hang);
    swingers.push({ o: hang, phase: seed, amp: 0.04 });
    // a dab of the street's colour on a little flag at one post top
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshLambertMaterial({ color: new THREE.Color(accent), side: THREE.DoubleSide }));
    pennant.position.set(2.32, 3.55, -0.2);
    g.add(pennant, box(0.04, 0.5, 0.04, timber, 2.07, 3.95, -0.2));
    place(g, x, z, facing);
    for (const k of [-1, 1]) addCollider(x + Math.cos(facing) * 2.05 * k, z - Math.sin(facing) * 2.05 * k, 0.25, 0.25, facing);
  }

  // --- monument ---
  function monument(title: string, sub: string, x: number, z: number, facing: number, logo?: HTMLImageElement): void {
    const mat = themedMaterial((night) => (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, night ? '#3a2c12' : '#e0b864');
      grad.addColorStop(1, night ? '#2a1f0c' : '#b48a3c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = night ? '#d98a1f' : '#7a5a22';
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, w - 40, h - 40);
      if (night) neon(ctx, w, h, '#d98a1f');
      logoTile(ctx, logo, w / 2 - 80, 50, 160, night);
      ctx.textAlign = 'center';
      ctx.fillStyle = night ? '#ffe7b8' : '#3d2a10';
      ctx.font = font(800, 86, 'Georgia, "Times New Roman", serif');
      ctx.fillText(title, w / 2, 300, w - 80);
      ctx.font = font(400, 44, 'Georgia, "Times New Roman", serif');
      ctx.fillText(sub, w / 2, 370, w - 100);
    }, 1024, 430);
    const g = new THREE.Group();
    g.add(box(6.2, 0.5, 2.6, stoneDark, 0, 0.25, 0));
    g.add(box(5.4, 0.35, 2.1, stone, 0, 0.67, 0));
    g.add(box(4.6, 2.6, 1.5, stone, 0, 2.15, 0));
    g.add(box(4.9, 0.3, 1.75, stoneDark, 0, 3.6, 0));
    const plaque = faces(mat, 3.9, 1.64, 1.5);
    plaque.position.y = 2.15;
    g.add(plaque);
    place(g, x, z, facing, 1.5);
    addCollider(x, z, 4.7, 2, facing);
  }

  // --- fingerpost ---
  function fingerpost(arrows: Array<{ text: string; accent: string; dir: -1 | 0 | 1 }>, x: number, z: number, facing: number): void {
    const g = new THREE.Group();
    const top = 2.2 + arrows.length * 0.62;
    g.add(box(0.16, top + 0.3, 0.16, timber, 0, (top + 0.3) / 2, 0));
    arrows.forEach((a, i) => {
      // painted per face: whatever a board points to, a driver reading its back has already passed it
      const paint = (dir: -1 | 0 | 1, back: boolean) => themedMaterial((night) => (ctx, w, h) => {
        const tip = 70;
        const left = dir === -1;
        ctx.beginPath();
        if (dir === 0) ctx.roundRect(0, 0, w, h, 14);
        else if (left) {
          ctx.moveTo(tip, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(tip, h); ctx.lineTo(0, h / 2); ctx.closePath();
        } else {
          ctx.moveTo(0, 0); ctx.lineTo(w - tip, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w - tip, h); ctx.lineTo(0, h); ctx.closePath();
        }
        ctx.fillStyle = night ? '#131828' : a.accent;
        ctx.fill();
        if (night) {
          ctx.strokeStyle = a.accent;
          ctx.lineWidth = 8;
          ctx.shadowColor = a.accent;
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = font(800, 64);
        ctx.textAlign = 'center';
        const label = dir === 0 ? `${back ? '↩' : '↑'} ${a.text}` : a.text;
        ctx.fillText(label, w / 2 + (dir === 0 ? 0 : left ? tip / 2 : -tip / 2), h / 2 + 22, w - tip - 40);
      }, 720, 110);
      const mat = paint(a.dir, false);
      const backMat = paint(0, true);
      for (const m of [mat, backMat]) {
        m.transparent = true;
        m.alphaTest = 0.5;
      }
      const arm = faces(mat, 2.3, 0.36, 0.06, undefined, backMat);
      arm.add(box(2.3 - 0.25, 0.36, 0.06, timber, (a.dir === 1 ? -1 : a.dir === -1 ? 1 : 0) * 0.12, 0, 0));
      // a straight-on board hangs to one side of the post, so the post doesn't cut its words
      arm.position.set(a.dir === 0 ? 1.25 : a.dir * 1.05, top - 0.3 - i * 0.62, 0);
      g.add(arm);
    });
    place(g, x, z, facing);
    addCollider(x, z, 0.2, 0.2, facing);
  }

  // --- chalk A-board ---
  function chalkboard(title: string, lines: string[], x: number, z: number, facing: number): void {
    const mat = themedMaterial((night) => (ctx, w, h) => {
      ctx.fillStyle = '#26332c';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 400; i++) ctx.fillRect((i * 97) % w, (i * 53) % h, 18, 2);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.fillStyle = night ? '#bff5c8' : '#f4f1e6';
      ctx.font = font(700, 96, '"Comic Sans MS", "Chalkboard SE", cursive');
      ctx.fillText(title, w / 2, 150, w - 60);
      ctx.fillStyle = '#ffd66b';
      ctx.font = font(400, 46, '"Comic Sans MS", "Chalkboard SE", cursive');
      lines.forEach((l, i) => ctx.fillText(l, w / 2, 260 + i * 66, w - 70));
    }, 600, 760);
    const g = new THREE.Group();
    // two leaves hinged together at the top, feet apart: an A seen from the side
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.y = 1.62;
      // feet splay outward, so each leaf's chalk side faces out
      hinge.rotation.x = -side * 0.24;
      const leaf = new THREE.Group();
      leaf.position.set(0, -0.8, side * 0.04);
      leaf.add(box(1.25, 1.6, 0.06, timber, 0, 0, 0));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.4), mat);
      // each leaf's chalk faces outward
      face.position.z = side * 0.035;
      if (side === -1) face.rotation.y = Math.PI;
      leaf.add(face);
      hinge.add(leaf);
      g.add(hinge);
    }
    place(g, x, z, facing, 1.4);
    addCollider(x, z, 0.9, 0.6, facing);
  }

  // --- street arch: stone pillars, a timber beam, and a name board hung beneath it ---
  function streetArch(title: string, sub: string, accent: string, x: number, z: number, facing: number, span: number): void {
    const mat = themedMaterial((night) => (ctx, w, h) => {
      ctx.fillStyle = night ? '#1a140d' : '#c79a62';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = night ? 'rgba(255,200,140,0.08)' : 'rgba(90,55,25,0.3)';
      ctx.lineWidth = 3;
      for (let yy = 16; yy < h; yy += 24) {
        ctx.beginPath();
        ctx.moveTo(0, yy);
        for (let xx = 0; xx <= w; xx += 90) ctx.lineTo(xx, yy + Math.sin(xx * 0.01 + yy) * 4);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, w, 18);
      ctx.fillRect(0, h - 18, w, 18);
      if (night) neon(ctx, w, h, accent);
      ctx.textAlign = 'center';
      ctx.fillStyle = night ? '#ffffff' : '#2e1d0c';
      ctx.font = font(800, 120);
      ctx.fillText(title, w / 2, 170, w - 80);
      ctx.globalAlpha = 0.85;
      ctx.font = font(600, 50, '"Figtree Variable", sans-serif');
      ctx.fillText(sub, w / 2, 245, w - 100);
      ctx.globalAlpha = 1;
    }, 1200, 300);
    const g = new THREE.Group();
    const half = span / 2;
    for (const px of [-half, half]) {
      g.add(box(0.9, 0.5, 0.9, stoneDark, px, 0.25, 0));
      g.add(box(0.7, 6.4, 0.7, stone, px, 3.45, 0));
      g.add(box(0.9, 0.3, 0.9, stoneDark, px, 6.8, 0));
      // a lantern on each pillar, lit with the boards
      const lantern = new THREE.Mesh(capGeo, lampMat);
      lantern.scale.setScalar(0.22);
      lantern.position.set(px, 7.15, 0);
      g.add(lantern);
    }
    g.add(box(span + 1.2, 0.36, 0.42, timber, 0, 6.55, 0));
    const bw = Math.min(span * 0.62, 7);
    const bh = (bw * 300) / 1200;
    for (const cx of [-bw / 2 + 0.3, bw / 2 - 0.3]) g.add(box(0.04, 0.5, 0.04, iron, cx, 6.13, 0));
    const board = new THREE.Group();
    board.add(box(bw, bh, 0.1, timber, 0, 0, 0));
    board.add(faces(mat, bw, bh, 0.1));
    board.position.y = 5.88 - bh / 2;
    g.add(board);
    swingers.push({ o: board, phase: Math.random() * 6.28, amp: 0.025 });
    place(g, x, z, facing);
    for (const k of [-1, 1]) addCollider(x + Math.cos(facing) * half * k, z - Math.sin(facing) * half * k, 0.5, 0.5, facing);
  }

  // --- bunting ---
  function bunting(ax: number, az: number, bx: number, bz: number, colours: string[]): void {
    const H = 5.2;
    for (const [px, pz] of [[ax, az], [bx, bz]]) {
      const pole = box(0.12, H + 0.2, 0.12, timber, px, (H + 0.2) / 2, pz);
      pole.castShadow = true;
      scene.add(pole);
      addCollider(px, pz, 0.2, 0.2, 0);
    }
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(6, Math.round(len / 0.75));
    const pts: number[] = [];
    const cols: number[] = [];
    const at = (k: number) => {
      const f = k / n;
      return { x: ax + (bx - ax) * f, y: H - Math.sin(f * Math.PI) * 1.1, z: az + (bz - az) * f };
    };
    const c = new THREE.Color();
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    for (let k = 0; k < n; k++) {
      const a = at(k + 0.15);
      const b = at(k + 0.85);
      const m = at(k + 0.5);
      c.set(colours[k % colours.length]);
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z, m.x + dx * 0.0, m.y - 0.55, m.z + dz * 0.0);
      for (let v = 0; v < 3; v++) cols.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const tri = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    scene.add(tri);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: n + 1 }, (_, k) => { const p = at(k); return new THREE.Vector3(p.x, p.y, p.z); })),
      new THREE.LineBasicMaterial({ color: 0x3a3a3a })
    );
    scene.add(line);
  }

  return {
    streetArch,
    hangingSign,
    flag,
    kiosk,
    plank,
    monument,
    fingerpost,
    chalkboard,
    bunting,

    tick(t: number): void {
      for (const s of swingers) s.o.rotation.x = Math.sin(t * 1.3 + s.phase) * s.amp;
      // One wind for the whole village, slow: strength wanders over tens of seconds,
      // with real lulls when the flag hangs down against its pole, and the direction
      // drifts round over a minute or two. The cloth ripples gently, a little faster
      // and wider as the wind picks up.
      const raw = 0.5 + 0.32 * Math.sin(t * 0.11 + 0.4) + 0.18 * Math.sin(t * 0.047 + 2.1) + 0.1 * Math.sin(t * 0.29);
      const wind = Math.min(1, Math.max(0, (raw - 0.12) / 0.75)); // calm about a fifth of the time
      const windDir = Math.sin(t * 0.035) * 1.2 + Math.sin(t * 0.09 + 2) * 0.35;
      for (const f of flags) {
        f.fly.rotation.y += (windDir + Math.sin(t * 0.3 + f.phase) * 0.12 - f.fly.rotation.y) * 0.02;
        // calm: the cloth falls; wind lifts it out. The hoist edge (x = 0) never moves,
        // so the flag stays on its pole however far it droops
        f.hang += ((1 - wind) * (1 - wind) * 1.2 - f.hang) * 0.03;
        const ch = Math.cos(f.hang);
        const sh = Math.sin(f.hang);
        const amp = 0.02 + 0.1 * wind;
        const speed = 1.6 + 2.4 * wind;
        for (const [geo, sign] of [[f.front, 1], [f.back, -1]] as const) {
          const pos = geo.getAttribute('position') as T.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const x = f.base[i * 3];
            const y = f.base[i * 3 + 1];
            const k = x / f.w; // 0 at the pole, 1 at the free end
            const wave =
              Math.sin(x * 1.8 - t * speed + f.phase) * amp +
              Math.sin(x * 3.1 - t * speed * 1.4 + y * 1.2 + f.phase) * amp * 0.25;
            pos.setX(i, x * ch);
            pos.setY(i, y - x * sh + Math.sin(x * 2 - t * speed * 0.8 + f.phase) * 0.02 * k);
            pos.setZ(i, sign * wave * k);
          }
          pos.needsUpdate = true;
          geo.computeVertexNormals();
        }
      }
    },

    suiteBoard(_step, project, x, z, facing, logo): void {
      const stepText = project.tagline.split(' — ')[0].replace(/^\d+ · /, '');
      bigBoard(
        { logo, title: project.name, sub: stepText, accent: project.accent ?? '#d98a1f', fg: project.accentFg },
        x, z, facing
      );
    },

    projectBoard(project, accent, x, z, facing): void {
      bigBoard({ title: project.name, sub: project.tagline, accent }, x, z, facing);
    },

    districtBoard(d, gx, gz, facing): void {
      bigBoard({ title: d.name, sub: d.blurb, accent: d.accent }, gx, gz, facing);
    },

    infoBoard(title, sub, accent, x, z, facing, big): void {
      bigBoard({ title, sub, accent, logo: big?.logo }, x, z, facing, big ?? undefined);
    },

    applyNight(nightFactor: number): void {
      // hysteresis, so a board can't strobe while the sky is mid-transition
      const wantNight = nightMode ? nightFactor > 0.45 : nightFactor > 0.55;
      if (wantNight !== nightMode) {
        nightMode = wantNight;
        for (const tb of themed) {
          tb.mat.map = wantNight ? tb.nightTex : tb.dayTex;
          tb.mat.needsUpdate = true;
        }
      }
      for (const tb of themed) tb.mat.emissive.setScalar(nightMode ? Math.min(1, nightFactor * 1.1) : 0);
      lampMat.emissive.setHex(nightMode ? 0xffd27a : 0x000000);
      for (const g of glowMats) g.mat.emissiveIntensity = nightMode ? 1.4 : 0.6;
    },
  };
}
