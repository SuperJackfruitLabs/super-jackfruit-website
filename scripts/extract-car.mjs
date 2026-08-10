// offroad-car.glb ships as a three-paint showroom: three complete cars stacked
// at the origin plus a baked ground decal each. The village drives one of them
// (the olive-green paint, node "Cube5"), so this drops the other two.
//
//   node scripts/extract-car.mjs
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';

const SRC = 'assets-src/offroad-car-kit.glb';
const DST = 'assets-src/raw/offroad-car.glb';
/** the paint the village drives — matched the way the runtime matches it */
const KEEP = 'cube5';

const norm = (s) => (s ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const io = new NodeIO();
const doc = await io.read(SRC);
const scene = doc.getRoot().listScenes()[0];

// find the paint variant anywhere in the tree, then keep only the branch it
// sits on — every other root child is another car or its decal
let variant = null;
scene.traverse((node) => {
  if (!variant && norm(node.getName()) === KEEP) variant = node;
});
if (!variant) throw new Error(`offroad-car: no node named ${KEEP}`);

const keepRoot = new Set();
for (let n = variant; n; n = n.getParentNode?.()) keepRoot.add(n);

let dropped = 0;
for (const child of scene.listChildren()) {
  if (keepRoot.has(child)) continue;
  child.dispose();
  dropped++;
}

await doc.transform(prune(), dedup());
await io.write(DST, doc);

console.log(`dropped ${dropped} sibling nodes; kept the "${variant.getName()}" branch`);
