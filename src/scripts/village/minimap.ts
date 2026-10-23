// The minimap: a small round map in the corner, heading-up, centred on the car.
//
// The streets are drawn once, to an offscreen canvas, straight from the
// RoadNetwork's tiles and turning circles. Each frame then costs one rotated
// drawImage and a few dots: the suite's houses in their own colours (ticked
// once visited), the square, Captain Jack's house, the other cars, and the
// car itself as an arrow pointing up. Canvas 2D only; no second render.
import type { RoadNetwork } from './road';
import { TILE } from './road';

export interface MapPlace {
  x: number;
  z: number;
  color: string;
  /** a suite house, ticked once visited */
  slug?: string;
  kind: 'suite' | 'hq' | 'guide';
}

export interface Minimap {
  update(x: number, z: number, heading: number, night: boolean, cars: ReadonlyArray<{ x: number; z: number; active: boolean }>): void;
}

/** metres from the car to the map's rim */
const VIEW = 95;
/** offscreen resolution, pixels per metre */
const RES = 2;

export function createMinimap(
  canvas: HTMLCanvasElement,
  road: RoadNetwork,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  places: MapPlace[],
  visited: () => ReadonlySet<string>
): Minimap {
  // ---------- the streets, once ----------
  // x runs right and z runs down the image, which is the town seen from above
  // with north (+z) at the bottom; the map turns with the car anyway.
  const pad = 20;
  const minX = bounds.minX - pad;
  const minZ = bounds.minZ - pad;
  const w = Math.ceil((bounds.maxX - bounds.minX + pad * 2) * RES);
  const h = Math.ceil((bounds.maxZ - bounds.minZ + pad * 2) * RES);
  const sheets = new Map<boolean, HTMLCanvasElement>();
  function sheet(night: boolean): HTMLCanvasElement {
    let c = sheets.get(night);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = night ? '#1d2a22' : '#a9c98a';
    g.fillRect(0, 0, w, h);
    const px = (x: number) => (x - minX) * RES;
    const pz = (z: number) => (z - minZ) * RES;
    // pavement first, a little wider, then the tarmac over it
    for (const [color, grow] of [[night ? '#5d6470' : '#e4e1d8', 2.4], [night ? '#39404a' : '#6b7079', 0]] as const) {
      g.fillStyle = color;
      const half = (TILE / 2 + grow) * RES;
      for (const t of road.tiles) g.fillRect(px(t.x) - half, pz(t.z) - half, half * 2, half * 2);
      for (const c0 of road.circles) {
        g.beginPath();
        g.arc(px(c0.x), pz(c0.z), (c0.r + grow) * RES, 0, Math.PI * 2);
        g.fill();
      }
    }
    sheets.set(night, c);
    return c;
  }

  const ctx = canvas.getContext('2d')!;
  let size = 0;
  function fit(): void {
    const css = canvas.clientWidth || 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const want = Math.round(css * dpr);
    if (want !== size) {
      size = want;
      canvas.width = canvas.height = size;
    }
  }

  return {
    update(x, z, heading, night, cars): void {
      if (canvas.offsetParent === null) return; // hidden: nothing to draw
      fit();
      const r = size / 2;
      const scale = r / VIEW; // canvas pixels per metre
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r - 1, 0, Math.PI * 2);
      ctx.clip();

      // the car's heading, (sin h, cos h) in x/z, is (sin h, cos h) in the image too; turn it to point up
      const turn = -Math.PI / 2 - Math.atan2(Math.cos(heading), Math.sin(heading));
      ctx.translate(r, r);
      ctx.rotate(turn);
      ctx.scale(scale, scale);
      // world → map: metres relative to the car
      ctx.drawImage(sheet(night), (minX - x), (minZ - z), w / RES, h / RES);

      const seen = visited();
      for (const p of places) {
        const dx = p.x - x;
        const dz = p.z - z;
        if (dx * dx + dz * dz > (VIEW * 1.5) ** 2) continue;
        ctx.save();
        ctx.translate(dx, dz);
        ctx.rotate(-turn); // markers stay upright
        const s = 1 / scale;
        ctx.scale(s, s);
        const rad = p.kind === 'suite' ? 6.5 : 5.5;
        ctx.beginPath();
        if (p.kind === 'hq') ctx.rect(-rad, -rad, rad * 2, rad * 2);
        else ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = night ? '#0d1118' : '#ffffff';
        ctx.stroke();
        if (p.slug && seen.has(p.slug)) {
          ctx.beginPath();
          ctx.moveTo(-3, 0);
          ctx.lineTo(-0.8, 2.6);
          ctx.lineTo(3.4, -2.6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // the other cars: small dots, if they're near
      ctx.fillStyle = night ? 'rgba(255, 240, 200, 0.9)' : 'rgba(40, 50, 60, 0.75)';
      for (const c of cars) {
        if (!c.active) continue;
        const dx = c.x - x;
        const dz = c.z - z;
        if (Math.abs(dx) > VIEW * 1.5 || Math.abs(dz) > VIEW * 1.5) continue;
        ctx.beginPath();
        ctx.arc(dx, dz, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // the car, always in the middle and pointing up
      ctx.setTransform(1, 0, 0, 1, r, r);
      const a = size / 22;
      ctx.beginPath();
      ctx.moveTo(0, -a * 1.3);
      ctx.lineTo(a, a);
      ctx.lineTo(0, a * 0.45);
      ctx.lineTo(-a, a);
      ctx.closePath();
      ctx.fillStyle = '#d98a1f';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, size / 110);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    },
  };
}
