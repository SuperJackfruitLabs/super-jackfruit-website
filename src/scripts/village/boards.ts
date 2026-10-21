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
  infoBoard(title: string, sub: string, accent: string, x: number, z: number, facing: number, big?: { logo?: HTMLImageElement; width: number; scale: number; gate?: boolean }): void;
  applyNight(nightFactor: number): void;
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
    size: { width: number; scale: number; gate?: boolean } = { width: 4.2, scale: 1 }
  ): void {
    const { lead, logo, title, sub, accent, fg } = o;
    // a gate with a mark is taller, so the mark can sit above the name
    const tall = size.gate && logo ? 486 : 320;
    const panelH = (1.31 * tall) / 320;
    const mat = themedMaterial(
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
            ctx.fillStyle = '#ffffff';
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
          // the mark sits on its own white tile, so a yellow logo still reads on an olive board
          ctx.fillStyle = '#ffffff';
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

    const group = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(size.width, panelH), mat);
    // an arch is raised clear of the chase camera (about 4 m up), not just the car
    const lift = size.gate ? 1.2 : 0;
    panel.position.set(0, 2.9 + lift + (panelH - 1.31) / 2, 0.06);
    panel.castShadow = true;
    const panelBack = panel.clone();
    panelBack.rotation.y = Math.PI;
    panelBack.position.z = -0.06;
    posts(group, [-(size.width / 2 - 0.2), size.width / 2 - 0.2], 3.6 + lift + (panelH - 1.31), 0.13, 0);
    group.add(panel, panelBack);
    group.position.set(x, 0, z);
    group.rotation.y = facing;
    group.scale.setScalar(size.scale);
    scene.add(group);
    if (size.gate) {
      // an arch over the road: only its posts are solid, so the car drives underneath
      const off = (size.width / 2 - 0.2) * size.scale;
      for (const k of [-1, 1]) addCollider(x + Math.cos(facing) * off * k, z - Math.sin(facing) * off * k, 0.3, 0.3, facing);
    } else addCollider(x, z, (size.width / 2) * size.scale, 0.3, facing);
  }

  return {
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
    },
  };
}
