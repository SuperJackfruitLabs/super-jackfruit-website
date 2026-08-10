// Fireworks: a volley over the square when you've seen every project, and
// ambient shells that climb over the far hills once it's properly dark.
import type * as T from 'three';
import type { Three } from './types';

const SHELL_HUES = [0x2ee6ff, 0xffc531, 0xc45cff, 0xff5470, 0xaaff4d, 0xff8a3d, 0x4d7bff];

interface Burst {
  points: T.Points;
  vel: Float32Array;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
}

interface Shell {
  sprite: T.Sprite;
  peak: number;
  palette: number[];
}

export interface Fx {
  celebrate(x: number, z: number): void;
  launchShell(px: number, pz: number, heading: number): void;
  update(dt: number, nightFactor: number, px: number, pz: number, heading: number): void;
  counts(): { rising: number; bursts: number };
}

export function createFx(THREE: Three, scene: T.Scene): Fx {
  // a soft round spark — untextured points render as hard squares, which is
  // what made the first version look pixelated
  const sparkTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const bursts: Burst[] = [];
  const rising: Shell[] = [];
  let shellTimer = 3 + Math.random() * 4;

  function burst(
    cx: number, cy: number, cz: number,
    o: { palette: number[]; count?: number; speed?: number; size?: number; life?: number; gravity?: number; drag?: number; distant?: boolean }
  ): void {
    const N = o.count ?? 70;
    const life = o.life ?? 1.6;
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < N; i++) {
      pos[i * 3] = cx;
      pos[i * 3 + 1] = cy;
      pos[i * 3 + 2] = cz;
      // spherical shell with a hollow-ish core, the way a real one opens
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const sp = (o.speed ?? 4 + Math.random() * 5) * (0.72 + Math.random() * 0.28);
      vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      vel[i * 3 + 1] = Math.cos(ph) * sp + 1.5;
      vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      tint.setHex(o.palette[(Math.random() * o.palette.length) | 0]);
      const jitter = 0.75 + Math.random() * 0.45;
      col[i * 3] = tint.r * jitter;
      col[i * 3 + 1] = tint.g * jitter;
      col[i * 3 + 2] = tint.b * jitter;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      map: sparkTex,
      vertexColors: true,
      size: o.size ?? 0.28,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      // distant shells sit past the fog's far plane; without this they'd be
      // swallowed by the night fog before they ever opened
      fog: !o.distant,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    // the bounding sphere is computed once, while every particle still sits at
    // the launch point — leaving culling on makes opening shells vanish
    pts.frustumCulled = false;
    scene.add(pts);
    bursts.push({ points: pts, vel, life, maxLife: life, gravity: o.gravity ?? 9, drag: o.drag ?? 0 });
  }

  function launchShell(px: number, pz: number, heading: number): void {
    // biased into the camera's forward arc — a show nobody sees is no show.
    // The camera sees roughly ±38° horizontally, so keep inside that.
    const ang = heading + (Math.random() - 0.5) * 1.4;
    const dist = 150 + Math.random() * 110;
    // the chase camera looks slightly down, so only a narrow band of sky is on
    // screen: tie burst height to distance and every shell opens low, on the
    // horizon, instead of above the top edge
    const peak = dist * (0.055 + Math.random() * 0.045);
    const a = SHELL_HUES[(Math.random() * SHELL_HUES.length) | 0];
    let b = SHELL_HUES[(Math.random() * SHELL_HUES.length) | 0];
    if (b === a) b = 0xffffff;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: sparkTex, color: a, transparent: true, opacity: 0.85, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    );
    sprite.scale.setScalar(2.4);
    sprite.position.set(px + Math.sin(ang) * dist, 2, pz + Math.cos(ang) * dist);
    scene.add(sprite);
    // weighted so the shell keeps its two hues and only glints white
    rising.push({ sprite, peak, palette: [a, a, a, b, b, 0xffffff] });
  }

  return {
    launchShell,

    celebrate(x: number, z: number): void {
      for (let b = 0; b < 7; b++) {
        setTimeout(() => {
          burst(
            x + (Math.random() - 0.5) * 14,
            14 + Math.random() * 8,
            z + (Math.random() - 0.5) * 14,
            { palette: [SHELL_HUES[b % SHELL_HUES.length], 0xffffff] }
          );
        }, b * 420);
      }
    },

    update(dt, nightFactor, px, pz, heading): void {
      if (nightFactor > 0.55) {
        shellTimer -= dt;
        // one at a time — a shell waits until the sky is clear again
        if (shellTimer <= 0 && rising.length === 0 && bursts.length === 0) {
          launchShell(px, pz, heading);
          shellTimer = 5 + Math.random() * 5;
        }
      }

      for (let i = rising.length - 1; i >= 0; i--) {
        const sh = rising[i];
        sh.sprite.position.y += sh.peak * 1.3 * dt;
        const climb = sh.sprite.position.y / sh.peak;
        sh.sprite.material.opacity = 0.85 * (1 - climb * 0.55);
        if (sh.sprite.position.y >= sh.peak) {
          // far away, so the shell needs real size and slow, lingering embers
          burst(sh.sprite.position.x, sh.sprite.position.y, sh.sprite.position.z, {
            palette: sh.palette,
            count: 130, speed: 19, size: 3.2, life: 3.4, gravity: 2.4, drag: 0.55, distant: true,
          });
          scene.remove(sh.sprite);
          sh.sprite.material.dispose();
          rising.splice(i, 1);
        }
      }

      for (let i = bursts.length - 1; i >= 0; i--) {
        const fw = bursts[i];
        fw.life -= dt;
        const posAttr = fw.points.geometry.getAttribute('position') as T.BufferAttribute;
        for (let j = 0; j < fw.vel.length / 3; j++) {
          const dm = fw.drag ? Math.max(0, 1 - fw.drag * dt) : 1;
          fw.vel[j * 3] *= dm;
          fw.vel[j * 3 + 2] *= dm;
          fw.vel[j * 3 + 1] = fw.vel[j * 3 + 1] * dm - fw.gravity * dt;
          posAttr.setXYZ(
            j,
            posAttr.getX(j) + fw.vel[j * 3] * dt,
            posAttr.getY(j) + fw.vel[j * 3 + 1] * dt,
            posAttr.getZ(j) + fw.vel[j * 3 + 2] * dt
          );
        }
        posAttr.needsUpdate = true;
        const k = Math.max(0, fw.life / fw.maxLife);
        (fw.points.material as T.PointsMaterial).opacity = Math.pow(k, 0.55);
        if (fw.life <= 0) {
          scene.remove(fw.points);
          fw.points.geometry.dispose();
          (fw.points.material as T.PointsMaterial).dispose();
          bursts.splice(i, 1);
        }
      }
    },

    counts: () => ({ rising: rising.length, bursts: bursts.length }),
  };
}
