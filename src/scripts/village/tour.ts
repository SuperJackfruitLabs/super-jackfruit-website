// Captain Jack's tour: he takes the wheel and drives the whole village, saying a
// line at each board. It starts only from the tour button, and any steering key,
// Esc or the caption's End hands the wheel straight back.
//
// The route follows the streets in the order the village is read: Main Street,
// straight on through the Agent Quarter, out and back along the Odd Shop, round
// the square past HQ, then back up the road to MCP Alley. He drives it the way a
// visitor would, through the same car and input, steering for a point a few
// metres ahead on the route and holding a gentle speed.

import type * as T from 'three';
import type { RoadNetwork, RoadSegment } from './road';
import type { InputState } from './input';
import { TOUR } from '../../data/tour';

export interface TourSpot {
  x: number;
  z: number;
}

export interface Tour {
  readonly active: boolean;
  start(): void;
  stop(): void;
  /** skip the line being spoken */
  skip(): void;
  /** the input to drive with this frame, or null when the visitor is driving */
  drive(dt: number, pos: T.Vector3, heading: number, speed: number, user: InputState): InputState | null;
}

const STEP = 2; // metres between route points
const CRUISE = 5.5; // m/s
const AHEAD = 4; // route points to steer for
const EARLY = 6; // route points before a stop that its line starts

export function createTour(
  road: RoadNetwork,
  spots: Map<string, TourSpot>,
  plaza: { x: number; z: number; r: number }
): Tour {
  const route: Array<{ x: number; z: number }> = [];

  const along = (seg: RoadSegment, t0: number, t1: number): void => {
    const n = Math.max(2, Math.ceil((Math.abs(t1 - t0) * seg.length) / STEP));
    for (let i = 0; i <= n; i++) {
      const p = seg.curve.getPointAt(Math.min(1, Math.max(0, t0 + ((t1 - t0) * i) / n)));
      route.push({ x: p.x, z: p.z });
    }
  };
  // once round a turning circle, from wherever the route arrived, and back out the way it came
  const roundAbout = (cx: number, cz: number, r: number): void => {
    const last = route[route.length - 1];
    const a0 = Math.atan2(last.x - cx, last.z - cz);
    const n = Math.ceil((2 * Math.PI * r) / STEP);
    for (let i = 1; i <= n; i++) {
      const a = a0 - (2 * Math.PI * i) / n;
      route.push({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r });
    }
  };
  const tOnMain = (x: number, z: number): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 600; i++) {
      const p = road.main.curve.getPointAt(i / 600);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) [bestD, best] = [d, i / 600];
    }
    return best;
  };
  const junction = (id: string): number => road.junctions.find((j) => j.id === id)?.t ?? 0;
  const outAndBack = (id: string): void => {
    const s = road.get(id);
    along(s, 0, 0.97);
    roundAbout(s.end.x, s.end.z, Math.max(3, s.end.r * 0.55));
    along(s, 0.97, 0);
  };

  const quarter = road.get('straight-on');
  const qEnd = quarter.curve.getPointAt(1);
  const tRejoin = tOnMain(qEnd.x, qEnd.z);
  const tOdd = junction('odd-shop');
  const tMcp = junction('mcp-alley');
  along(road.main, 0.012, junction('straight-on'));
  along(quarter, 0, 1);
  along(road.main, tRejoin, tOdd);
  outAndBack('odd-shop');
  along(road.main, tOdd, 0.985);
  roundAbout(plaza.x, plaza.z, plaza.r * 0.55);
  along(road.main, 0.985, tMcp);
  outAndBack('mcp-alley');

  // where on the route each line is due: the nearest point to its spot, searched
  // forward from the last, so a stretch driven twice keeps its order
  const due: number[] = [];
  {
    let from = 0;
    for (const line of TOUR) {
      const s = spots.get(line.id);
      if (line.id === 'start') { due.push(0); continue; }
      if (line.id === 'end' || !s) { due.push(route.length - 1); continue; }
      // a side street is driven out and back: take the first pass, not the closer lane home
      let bestD = Infinity;
      for (let i = from; i < route.length; i++) bestD = Math.min(bestD, Math.hypot(route[i].x - s.x, route[i].z - s.z));
      let best = from;
      while (best < route.length - 1 && Math.hypot(route[best].x - s.x, route[best].z - s.z) > bestD + 2) best++;
      due.push(Math.max(0, best - EARLY));
      from = best;
    }
  }

  let active = false;
  let at = 0; // route point the car is nearest
  let next = 0; // the next line to speak
  let voice: HTMLAudioElement | null = null;
  let speaking = false;

  const emit = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

  const say = (i: number): void => {
    const line = TOUR[i];
    voice?.pause();
    speaking = true;
    emit('village:tour-line', { text: line.text, index: i, total: TOUR.length });
    const a = new Audio(`/assets/village/tour/${line.id}.mp3`);
    voice = a;
    const done = () => {
      if (voice !== a) return;
      speaking = false;
      if (line.id === 'end') stop();
    };
    a.addEventListener('ended', done);
    a.addEventListener('error', () => setTimeout(done, 2500));
    a.play().catch(() => setTimeout(done, 2500));
  };

  const stop = (): void => {
    if (!active) return;
    active = false;
    speaking = false;
    voice?.pause();
    voice = null;
    emit('village:tour-state', { active: false });
  };

  return {
    get active() {
      return active;
    },
    start() {
      if (active) return;
      active = true;
      at = 0;
      next = 0;
      emit('village:tour-state', { active: true });
    },
    stop,
    skip() {
      if (!voice) return;
      voice.pause();
      voice.dispatchEvent(new Event('ended'));
    },
    drive(dt, pos, heading, speed, user) {
      if (!active) return null;
      if (Math.abs(user.ix) > 0.1 || Math.abs(user.iz) > 0.1) {
        stop();
        return null;
      }
      // the car's place on the route, looking a little either side of the last
      let best = at;
      let bestD = Infinity;
      for (let i = Math.max(0, at - 3); i < Math.min(route.length, at + 12); i++) {
        const d = Math.hypot(route[i].x - pos.x, route[i].z - pos.z);
        if (d < bestD) [bestD, best] = [d, i];
      }
      at = best;

      // the next line starts when it's due and the last one has finished;
      // until then the car waits short of it
      let target = CRUISE;
      if (next < TOUR.length && at >= due[next]) {
        if (!speaking) say(next++);
        else target = 0;
      }
      const last = at >= route.length - 2;
      if (last) target = 0;

      const aim = route[Math.min(route.length - 1, at + AHEAD)];
      const want = Math.atan2(aim.x - pos.x, aim.z - pos.z);
      let err = want - heading;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      const steer = Math.max(-1, Math.min(1, err * 2.2));
      // slow for a sharp bend so the car doesn't run wide
      if (Math.abs(err) > 0.5) target = Math.min(target, 3);
      const gap = target - speed;
      const pedal = gap > 0 ? Math.min(1, gap * 0.6) : Math.max(-1, gap * 0.8);
      void dt;
      return { ix: -steer, iz: -pedal, nitro: false };
    },
  };
}
