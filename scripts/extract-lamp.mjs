// street-lamp.glb ships as a showroom: ~100 lamp variants standing side by
// side, 6.5MB and 796k vertices, of which the village uses exactly one.
//
// This mirrors the selection the runtime does (descend past wrappers, take the
// tallest slim node, gather the parts standing at its spot) and writes out just
// those parts, so the browser downloads one lamp instead of the catalogue.
//
//   node scripts/extract-lamp.mjs
import { NodeIO, getBounds } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';

const SRC = 'assets-src/street-lamp-kit.glb';
const DST = 'assets-src/raw/street-lamp.glb';
/** parts closer than this to the anchor pole, in XZ, belong to the same lamp */
const CLUSTER_RADIUS = 1.6;

const io = new NodeIO();
const doc = await io.read(SRC);

let parent = doc.getRoot().listScenes()[0];
let children = parent.listChildren();
while (children.length === 1) {
  parent = children[0];
  children = parent.listChildren();
}

const infos = children.map((node) => {
  const b = getBounds(node);
  return {
    node,
    size: b.max.map((v, i) => v - b.min[i]),
    center: b.max.map((v, i) => (v + b.min[i]) / 2),
  };
});

// a lamp post is tall and thin; the showroom floor and signage are not
const slim = infos.filter((i) => i.size[1] > Math.max(i.size[0], i.size[2]) * 1.5);
const anchor = (slim.length ? slim : infos).sort((a, b) => b.size[1] - a.size[1])[0];
const members = infos.filter(
  (i) => Math.hypot(i.center[0] - anchor.center[0], i.center[2] - anchor.center[2]) < CLUSTER_RADIUS
);
const keep = new Set(members.map((m) => m.node));

for (const info of infos) {
  if (!keep.has(info.node)) info.node.dispose();
}

await doc.transform(prune(), dedup());
await io.write(DST, doc);

console.log(
  `kept ${members.length} of ${infos.length} parts · anchor height ${anchor.size[1].toFixed(2)}`
);
