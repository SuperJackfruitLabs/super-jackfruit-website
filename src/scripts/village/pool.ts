// A fixed population that follows the visitor round the village.
//
// Every actor is built once, up front; nothing is created mid-drive. An actor
// that has fallen far behind, and is out of view, is moved to somewhere ahead
// of the visitor's notice instead: a little way off and off-screen, so nobody
// sees it vanish or appear. Moves are rationed per frame and the scan resumes
// where it stopped, so a burst of retirements spreads over several frames and
// one awkward actor can't hog a frame.
//
// A teleport (the 1–6/H/R keys) is the one time the budget is lifted: the old
// neighbourhood is gone, so everyone is placed around the new spot at once.

/** what the pool needs to know about any actor */
export interface PoolActor {
  /** false until first placed, or when a placement found nowhere to go */
  active: boolean;
  x: number;
  z: number;
}

/** where a placement may land, from the visitor's point of view */
export interface SpawnRules {
  focusX: number;
  focusZ: number;
  /** which way the visitor is heading, unit length: places ahead are worth more than places behind */
  headX: number;
  headZ: number;
  /** nearest and furthest from the visitor a new place may be */
  minDist: number;
  maxDist: number;
  /** after a teleport the view is new anyway, so placing in sight is allowed */
  mayBeSeen: boolean;
  /** past this, deep in the fog, an actor may appear in sight */
  farView: number;
  inView(x: number, z: number, r: number): boolean;
}

export interface PoolOptions<A extends PoolActor> {
  actors: A[];
  /** past this, and out of view, an actor is recycled */
  retireRadius: number;
  /** recycled actors land this far off */
  spawnMin: number;
  spawnMax: number;
  /** far enough into the fog that appearing in sight goes unnoticed */
  farView: number;
  /** placements attempted per frame, successful or not */
  budget: number;
  /** a focus that moves further than this in one frame counts as a teleport */
  jumpDistance?: number;
  /** puts the actor somewhere that obeys the rules; false if it found nowhere */
  place(actor: A, rules: SpawnRules): boolean;
}

export interface ActorPool<A extends PoolActor> {
  readonly actors: A[];
  /** call once a frame, before the actors move */
  update(focusX: number, focusZ: number, heading: number, inView: SpawnRules['inView']): void;
  /** the visitor was moved: re-seed everyone on the next update */
  reseed(): void;
  /** placements made since the last call, for the debug hook */
  takeStats(): { placed: number; reseeds: number };
}

export function createPool<A extends PoolActor>(o: PoolOptions<A>): ActorPool<A> {
  const jumpDistance = o.jumpDistance ?? 40;
  let cursor = 0;
  let lastX = NaN;
  let lastZ = NaN;
  let pendingJump = true; // the first frame seeds the village
  let placed = 0;
  let reseeds = 0;

  return {
    actors: o.actors,

    update(focusX, focusZ, heading, inView): void {
      const n = o.actors.length;
      if (n === 0) return;
      const jump = pendingJump || !(Math.hypot(focusX - lastX, focusZ - lastZ) <= jumpDistance);
      pendingJump = false;
      lastX = focusX;
      lastZ = focusZ;
      if (jump) reseeds++;

      // on a teleport, keep anyone who already happens to be near the new spot, but not on top of it
      const keep = jump ? o.spawnMin : o.retireRadius;
      const clear = jump ? Math.min(12, o.spawnMin) : 0;
      const rules: SpawnRules = {
        focusX,
        focusZ,
        headX: Math.sin(heading),
        headZ: Math.cos(heading),
        minDist: jump ? clear : o.spawnMin,
        maxDist: o.spawnMax,
        mayBeSeen: jump,
        farView: o.farView,
        inView,
      };
      let budget = jump ? n : o.budget;
      for (let scanned = 0; scanned < n && budget > 0; scanned++) {
        const a = o.actors[cursor];
        cursor = (cursor + 1) % n;
        if (a.active) {
          const d = Math.hypot(a.x - focusX, a.z - focusZ);
          if (d <= keep && d >= clear) continue;
          if (!jump && inView(a.x, a.z, 3)) continue; // never pull one out from under the visitor's eyes
        }
        budget--;
        if (o.place(a, rules)) {
          a.active = true;
          placed++;
        }
      }
    },

    reseed(): void {
      pendingJump = true;
    },

    takeStats() {
      const s = { placed, reseeds };
      placed = 0;
      reseeds = 0;
      return s;
    },
  };
}
