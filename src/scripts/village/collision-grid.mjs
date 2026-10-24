const cellKey = (x, z) => `${x},${z}`;

/** A uniform broad-phase grid for oriented boxes in the XZ plane. */
export function createCollisionGrid(cellSize = 12) {
  if (!(cellSize > 0)) throw new RangeError('cellSize must be positive');

  const entries = [];
  const cells = new Map();

  function add(collider) {
    const index = entries.length;
    entries.push(collider);
    const ex = Math.abs(collider.cos) * collider.hx + Math.abs(collider.sin) * collider.hz;
    const ez = Math.abs(collider.sin) * collider.hx + Math.abs(collider.cos) * collider.hz;
    const minX = Math.floor((collider.cx - ex) / cellSize);
    const maxX = Math.floor((collider.cx + ex) / cellSize);
    const minZ = Math.floor((collider.cz - ez) / cellSize);
    const maxZ = Math.floor((collider.cz + ez) / cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const key = cellKey(x, z);
        let list = cells.get(key);
        if (!list) cells.set(key, (list = []));
        list.push(index);
      }
    }
  }

  function query(x, z, radius) {
    const seen = new Set();
    const indices = [];
    const minX = Math.floor((x - radius) / cellSize);
    const maxX = Math.floor((x + radius) / cellSize);
    const minZ = Math.floor((z - radius) / cellSize);
    const maxZ = Math.floor((z + radius) / cellSize);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const list = cells.get(cellKey(cx, cz));
        if (!list) continue;
        for (const index of list) {
          if (!seen.has(index)) {
            seen.add(index);
            indices.push(index);
          }
        }
      }
    }

    indices.sort((a, b) => a - b);
    return indices.map((index) => entries[index]);
  }

  return { add, query };
}
