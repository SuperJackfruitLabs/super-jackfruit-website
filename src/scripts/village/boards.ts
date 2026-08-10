// Signboards: project boards at the kerb, district gates, and info boards on
// the square. Each is drawn twice into a canvas — warm paper for daylight,
// neon-on-ink for after dark — and swaps map + emissive as night comes in.
import type * as T from 'three';
import type { Three } from './types';
import type { District, Project } from '../../data/projects';

const CREAM = '#f6f0e2';
const INK = '#2c2a26';

interface ThemedBoard {
  mat: T.MeshLambertMaterial;
  dayTex: T.CanvasTexture;
  nightTex: T.CanvasTexture;
}

export interface BoardKit {
  projectBoard(project: Project, accent: string, x: number, z: number, facing: number): void;
  districtBoard(d: District, gx: number, gz: number, facing: number): void;
  infoBoard(title: string, sub: string, accent: string, x: number, z: number, facing: number): void;
  applyNight(nightFactor: number): void;
}

export function statusDotColor(status: string): string {
  return status === 'stable' ? '#3f9e3f' : status === 'wip' ? '#d98a1f' : '#8a5fc9';
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

  function posts(group: T.Group, xs: number[], height: number, thickness: number, z: number): void {
    for (const px of xs) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, thickness), wood);
      post.position.set(px, height / 2, z);
      post.castShadow = true;
      group.add(post);
    }
  }

  return {
    projectBoard(project, accent, x, z, facing): void {
      const mat = themedMaterial((night) => (ctx, w, h) => {
        ctx.fillStyle = night ? '#131828' : CREAM;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 14;
        if (night) {
          ctx.shadowColor = accent;
          ctx.shadowBlur = 18;
        }
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.font = '700 68px "Inconsolata Variable", monospace';
        if (night) {
          ctx.shadowColor = accent;
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = INK;
        }
        ctx.fillText(project.name, w / 2, 120, w - 80);
        ctx.shadowBlur = 0;
        ctx.font = '38px "Inconsolata Variable", monospace';
        ctx.fillStyle = night ? 'rgba(230,236,255,0.85)' : 'rgba(44,42,38,0.75)';
        ctx.fillText(project.tagline, w / 2, 190, w - 80);
        ctx.fillStyle = statusDotColor(project.status);
        ctx.beginPath();
        ctx.arc(w / 2 - 90, 265, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = night ? 'rgba(230,236,255,0.7)' : 'rgba(44,42,38,0.6)';
        ctx.font = '34px "Inconsolata Variable", monospace';
        ctx.fillText(project.status, w / 2 + 20, 277);
      });

      const group = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.07), mat);
      panel.position.y = 1.45;
      panel.castShadow = true;
      const backing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.17, 0.06), wood);
      backing.position.set(0, 1.45, -0.045);
      backing.castShadow = true;
      // fully behind the backing board — a coplanar post face z-fights the facia
      posts(group, [-0.8, 0.8], 1.5, 0.09, -0.125);
      group.add(panel, backing);
      group.position.set(x, 0, z);
      group.rotation.y = facing;
      scene.add(group);
      addCollider(x, z, 1.0, 0.3, facing);
    },

    districtBoard(d, gx, gz, facing): void {
      const mat = themedMaterial(
        (night) => (ctx, w, h) => {
          ctx.fillStyle = night ? '#131828' : d.accent;
          ctx.fillRect(0, 0, w, h);
          ctx.textAlign = 'center';
          ctx.font = '700 74px "Inconsolata Variable", monospace';
          if (night) {
            ctx.shadowColor = d.accent;
            ctx.shadowBlur = 20;
            ctx.fillStyle = d.accent;
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
          }
          ctx.fillText(d.name.toUpperCase(), w / 2, 150, w - 60);
          ctx.shadowBlur = 0;
          ctx.font = '40px "Inconsolata Variable", monospace';
          ctx.fillStyle = night ? 'rgba(230,236,255,0.85)' : 'rgba(255,255,255,0.85)';
          ctx.fillText(d.blurb, w / 2, 235, w - 60);
        },
        760,
        300
      );

      const group = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.15), mat);
      panel.position.set(0, 2.0, 0.06);
      panel.castShadow = true;
      const panelBack = panel.clone();
      panelBack.rotation.y = Math.PI;
      panelBack.position.z = -0.06;
      posts(group, [-1.3, 1.3], 2.6, 0.11, 0);
      group.add(panel, panelBack);
      group.position.set(gx, 0, gz);
      group.rotation.y = facing;
      scene.add(group);
    },

    infoBoard(title, sub, accent, x, z, facing): void {
      const mat = themedMaterial((night) => (ctx, w, h) => {
        ctx.fillStyle = night ? '#131828' : CREAM;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 14;
        if (night) { ctx.shadowColor = accent; ctx.shadowBlur = 18; }
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.font = '700 58px "Inconsolata Variable", monospace';
        if (night) { ctx.shadowColor = accent; ctx.shadowBlur = 14; ctx.fillStyle = '#ffffff'; }
        else ctx.fillStyle = INK;
        ctx.fillText(title, w / 2, 150, w - 70);
        ctx.shadowBlur = 0;
        ctx.font = '36px "Inconsolata Variable", monospace';
        ctx.fillStyle = night ? 'rgba(230,236,255,0.85)' : 'rgba(44,42,38,0.75)';
        ctx.fillText(sub, w / 2, 225, w - 70);
      });

      const group = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), mat);
      panel.position.y = 1.7;
      panel.castShadow = true;
      const backing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.45, 0.06), wood);
      backing.position.set(0, 1.7, -0.045);
      backing.castShadow = true;
      posts(group, [-1.0, 1.0], 1.8, 0.1, -0.125);
      group.add(panel, backing);
      group.position.set(x, 0, z);
      group.rotation.y = facing;
      scene.add(group);
      addCollider(x, z, 1.25, 0.32, facing);
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
    },
  };
}
