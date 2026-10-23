// The back streets: a town grown round the named streets, on the road tiles' grid.
//
// Each open stretch of ground gets a lattice that has been knocked about: rows
// and columns at uneven spacings, every crossing nudged a cell one way or the
// other, so a street between two crossings jogs sideways part way along (two
// of the kit's curved corners, an S-bend) instead of running ruler-straight.
// A spanning pass joins every crossing it can reach to the named streets, then
// only some of the remaining links are laid, which leaves T-junctions, the odd
// loop and blocks that aren't rectangles. A crossing left with one street ends
// in a turning circle, or the street is dropped if there's no room for one.
//
// Everything here is cells (one road tile, TILE metres) and pure data, so it is
// tested on its own (tests/streets.test.mjs). The seed fixes the layout: every
// visitor gets the same town.

/** @typedef {[number, number]} Cell */
/**
 * @typedef {{ x0: number, x1: number, z0: number, z1: number,
 *   connect: Array<{ from: Cell, dir: Cell }> }} Region
 * x0..x1 and z1..z0 bound the region's crossings, in cells, edges included;
 * `connect` names cells on the named streets that a back street may leave from,
 * heading `dir`.
 */
/**
 * @typedef {{ id: string, cells: Cell[], from: Cell, to?: Cell, culDeSac: number }} BackStreet
 */

const key = (x, z) => `${x},${z}`;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The cells between a and b, leaving a along the axis of `dir` (or the longer
 * axis), turning across half way, and arriving at b along the first axis.
 * Null when there isn't room to do that.
 * @returns {Cell[] | null}
 */
export function route(a, b, dir) {
  const horizontal = dir ? dir[0] !== 0 : Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
  const [ai, aj] = horizontal ? a : [a[1], a[0]];
  const [bi, bj] = horizontal ? b : [b[1], b[0]];
  const span = bi - ai;
  const step = Math.sign(span);
  if (Math.abs(span) < 2) return null;
  if (dir && step !== (horizontal ? dir[0] : dir[1])) return null;
  const shift = bj - aj;
  // a sideways shift needs a straight cell either side of the S-bend
  if (shift !== 0 && Math.abs(span) < 4) return null;
  const mid = ai + step * Math.floor(Math.abs(span) / 2);
  const out = [];
  for (let i = ai + step; i !== mid + step; i += step) out.push([i, aj]);
  for (let j = aj + Math.sign(shift); shift !== 0 && j !== bj + Math.sign(shift); j += Math.sign(shift)) out.push([mid, j]);
  for (let i = mid + step; i !== bi; i += step) out.push([i, bj]);
  return horizontal ? out : out.map(([i, j]) => [j, i]);
}

/**
 * @param {{ taken: Cell[], regions: Region[], keepOut?: Array<[number, number, number, number]>,
 *   seed: number, prefix?: string, minStep?: number, maxStep?: number, loops?: number }} o
 * `loops` is the chance that a link beyond the spanning pass is laid too.
 * @returns {BackStreet[]}
 */
export function layStreets(o) {
  const rand = rng(o.seed);
  const minStep = o.minStep ?? 4;
  const maxStep = o.maxStep ?? 6;
  const prefix = o.prefix ?? 'lane-';
  const taken = new Set(o.taken.map(([x, z]) => key(x, z)));
  /** cells the back streets have laid so far */
  const laid = new Set();
  const occupied = (x, z) => taken.has(key(x, z)) || laid.has(key(x, z));
  const kept = (x, z) =>
    (o.keepOut ?? []).some(([x0, z0, x1, z1]) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && z >= Math.min(z0, z1) && z <= Math.max(z0, z1));
  // the named streets keep two cells of clear ground either side, for their houses and signs
  const nearNamed = (x, z, r = 2) => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (taken.has(key(x + dx, z + dz))) return true;
    return false;
  };
  const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

  /** may these cells be laid as a street from a to b? */
  function fits(cells, a, b, fromNamed) {
    const own = new Set(cells.map(([x, z]) => key(x, z)));
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      if (occupied(c[0], c[1]) || kept(c[0], c[1])) return false;
      // a street leaving a named one may cross that street's verge on its way out
      if (nearNamed(c[0], c[1]) && !(fromNamed && k < 2)) return false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const n = [c[0] + dx, c[1] + dz];
          if ((dx === 0 && dz === 0) || own.has(key(n[0], n[1])) || !occupied(n[0], n[1])) continue;
          // touching the crossings it joins, and the other streets at them, is the point
          const nearA = cheb(n, a) <= 1 && cheb(c, a) <= 1;
          const nearB = b && cheb(n, b) <= 1 && cheb(c, b) <= 1;
          if (!nearA && !nearB) return false;
        }
      }
    }
    return true;
  }

  /** @type {Array<{ cells: Cell[], from: Cell, to: Cell, a: string, b: string }>} */
  const edges = [];
  function lay(cells, from, to) {
    for (const [x, z] of [...cells, from, to]) if (!taken.has(key(x, z))) laid.add(key(x, z));
    edges.push({ cells, from, to, a: key(...from), b: key(...to) });
  }

  for (const region of o.regions) {
    // uneven rows and columns, then every crossing nudged
    const lines = (lo, hi) => {
      const out = [];
      for (let v = lo + Math.floor(rand() * 2); v <= hi; v += minStep + Math.floor(rand() * (maxStep - minStep + 1))) out.push(v);
      return out;
    };
    const xs = lines(region.x0, region.x1);
    const zs = lines(region.z1, region.z0).reverse(); // north first
    const nudge = () => (rand() < 0.45 ? 0 : rand() < 0.5 ? -1 : 1);
    /** @type {Cell[][]} */
    const node = xs.map((x) => zs.map((z) => [
      Math.max(region.x0, Math.min(region.x1, x + nudge())),
      Math.max(region.z1, Math.min(region.z0, z + nudge())),
    ]));
    const free = (c) => !occupied(c[0], c[1]) && !kept(c[0], c[1]) && !nearNamed(c[0], c[1]);
    const joined = new Set();
    const nodeKey = (i, j) => `${i}:${j}`;

    // from the named streets in to the nearest crossing that will take a street
    for (const c of region.connect) {
      const options = [];
      xs.forEach((_, i) => zs.forEach((_, j) => options.push({ i, j, d: cheb(node[i][j], c.from) })));
      options.sort((p, q) => p.d - q.d);
      for (const { i, j } of options) {
        const n = node[i][j];
        if (!free(n) && !laid.has(key(...n))) continue;
        const cells = route(c.from, n, c.dir);
        if (!cells || !fits(cells, c.from, n, true)) continue;
        lay(cells, c.from, n);
        joined.add(nodeKey(i, j));
        break;
      }
    }

    // a spanning pass out from what's joined, in a shuffled order, then a few more links for loops
    const links = [];
    xs.forEach((_, i) => zs.forEach((_, j) => {
      if (i + 1 < xs.length) links.push([i, j, i + 1, j]);
      if (j + 1 < zs.length) links.push([i, j, i, j + 1]);
    }));
    for (let k = links.length - 1; k > 0; k--) {
      const r = Math.floor(rand() * (k + 1));
      [links[k], links[r]] = [links[r], links[k]];
    }
    const tryLink = ([i, j, p, q]) => {
      const a = node[i][j];
      const b = node[p][q];
      if (!laid.has(key(...b)) && !free(b)) return false;
      const cells = route(a, b);
      if (!cells || !fits(cells, a, b, false)) return false;
      lay(cells, a, b);
      return true;
    };
    for (let grew = true; grew; ) {
      grew = false;
      for (const l of links) {
        const ja = joined.has(nodeKey(l[0], l[1]));
        const jb = joined.has(nodeKey(l[2], l[3]));
        if (ja === jb) continue;
        const link = ja ? l : [l[2], l[3], l[0], l[1]];
        if (tryLink(link)) {
          joined.add(nodeKey(l[0], l[1]));
          joined.add(nodeKey(l[2], l[3]));
          grew = true;
        }
      }
    }
    for (const l of links) {
      if (!joined.has(nodeKey(l[0], l[1])) || !joined.has(nodeKey(l[2], l[3]))) continue;
      if (edges.some((e) => (e.a === key(...node[l[0]][l[1]]) && e.b === key(...node[l[2]][l[3]])) || (e.b === key(...node[l[0]][l[1]]) && e.a === key(...node[l[2]][l[3]])))) continue;
      if (rand() < (o.loops ?? 0.7)) tryLink(l);
    }
  }

  // ---------- loose ends: a turning circle, or nothing ----------
  // Repeat until settled: dropping one street can leave another with a loose end.
  const active = new Set(edges);
  /** edges that end in a turning circle, by which end: 'a' or 'b' */
  const capped = new Map();
  for (let changed = true; changed; ) {
    changed = false;
    const deg = new Map();
    for (const e of active) for (const k of [e.a, e.b]) deg.set(k, (deg.get(k) ?? 0) + 1);
    const cellsOf = (skip) => {
      const set = new Set();
      for (const e of active) {
        if (e === skip) continue;
        for (const [x, z] of [...e.cells, e.from, e.to]) set.add(key(x, z));
      }
      return set;
    };
    for (const e of [...active]) {
      const looseA = deg.get(e.a) === 1 && !taken.has(e.a);
      const looseB = deg.get(e.b) === 1 && !taken.has(e.b);
      const want = looseB ? 'b' : looseA ? 'a' : null;
      if (capped.has(e) && capped.get(e) === want && !(looseA && looseB)) continue;
      if (!want) {
        if (capped.has(e)) { capped.delete(e); changed = true; }
        continue;
      }
      if (looseA && looseB) {
        active.delete(e);
        capped.delete(e);
        changed = true;
        continue;
      }
      // the circle's middle sits about 1.25 cells past the end, and reaches ~1.1 cells round
      const [end, prev] = want === 'b' ? [e.to, e.cells[e.cells.length - 1] ?? e.from] : [e.from, e.cells[0] ?? e.to];
      const dir = [Math.sign(end[0] - prev[0]), Math.sign(end[1] - prev[1])];
      const cx = end[0] + dir[0] * 1.25;
      const cz = end[1] + dir[1] * 1.25;
      const others = cellsOf(e);
      let room = !kept(Math.round(cx), Math.round(cz));
      for (let dx = -3; dx <= 3 && room; dx++) {
        for (let dz = -3; dz <= 3 && room; dz++) {
          const x = Math.round(cx) + dx;
          const z = Math.round(cz) + dz;
          if (Math.hypot(x - cx, z - cz) > 2.4) continue;
          if (taken.has(key(x, z)) || others.has(key(x, z))) room = false;
        }
      }
      for (const [f, side] of capped) {
        if (f === e || !active.has(f)) continue;
        const fe = side === 'b' ? f.to : f.from;
        const fp = side === 'b' ? f.cells[f.cells.length - 1] ?? f.from : f.cells[0] ?? f.to;
        const fx = fe[0] + Math.sign(fe[0] - fp[0]) * 1.25;
        const fz = fe[1] + Math.sign(fe[1] - fp[1]) * 1.25;
        if (Math.hypot(fx - cx, fz - cz) < 3) room = false;
      }
      if (room) capped.set(e, want);
      else {
        active.delete(e);
        capped.delete(e);
      }
      changed = true;
    }
  }

  /** @type {BackStreet[]} */
  const out = [];
  let n = 0;
  for (const e of edges) {
    if (!active.has(e)) continue;
    const id = `${prefix}${++n}`;
    const side = capped.get(e);
    if (!side) out.push({ id, cells: e.cells, from: e.from, to: e.to, culDeSac: 0 });
    // run on through the loose crossing and finish in a turning circle
    else if (side === 'b') out.push({ id, cells: [...e.cells, e.to], from: e.from, culDeSac: 9 });
    else out.push({ id, cells: [...[...e.cells].reverse(), e.from], from: e.to, culDeSac: 9 });
  }
  return out;
}
