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

// find the paint variant anywhere in the tree, then keep only its branch
let variant = null;
scene.traverse((node) => {
  if (!variant && norm(node.getName()) === KEEP) variant = node;
});
if (!variant) throw new Error(`offroad-car: no node named ${KEEP}`);

let dropped = 0;
let branch = variant;
for (let parent = variant.getParentNode(); parent; parent = parent.getParentNode()) {
  for (const child of parent.listChildren()) {
    if (child === branch) continue;
    child.dispose();
    dropped++;
  }
  branch = parent;
}

for (const child of variant.listChildren()) {
  if (!/^Cylinder/.test(child.getName()) || child.getTranslation()[1] > -0.5) continue;
  const [x, , z] = child.getTranslation();
  child.setName(`wheel-${z > 0 ? 'front' : 'back'}-${x > 0 ? 'right' : 'left'}`);
}

await doc.transform(prune(), dedup());
await io.write(DST, doc);

console.log(`dropped ${dropped} sibling nodes; kept the "${variant.getName()}" branch`);
