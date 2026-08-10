// Kenney's Blocky Characters ship 27 animation clips each — idle, walk, sit,
// but also shooting, kicking and a wheelchair set the village has no use for.
// Animation data is most of the file, so keep the three the village plays.
//
// The characters are node-animated rather than skinned (leg-left, arm-right and
// so on are plain meshes with transform tracks), which is why they are cheap
// enough to have a crowd of.
//
//   node scripts/extract-npcs.mjs
import { readdir, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';

const SRC = 'assets-src/npc-kit';
const DST = 'assets-src/raw';
const KEEP = new Set(['idle', 'walk']);

await mkdir(DST, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const files = (await readdir(SRC)).filter((f) => f.endsWith('.glb')).sort();
let before = 0;
let after = 0;

for (const file of files) {
  const letter = file.replace(/^character-|\.glb$/g, '');
  const src = join(SRC, file);
  const dst = join(DST, `npc-${letter}.glb`);

  const doc = await io.read(src);

  const kept = [];
  for (const anim of doc.getRoot().listAnimations()) {
    if (KEEP.has(anim.getName())) kept.push(anim.getName());
    else anim.dispose();
  }
  if (kept.length !== KEEP.size) {
    throw new Error(`${file}: expected ${[...KEEP]}, kept ${kept}`);
  }

  // The pack marks its materials KHR_materials_unlit, which three honours by
  // giving them MeshBasicMaterial — villagers would stay fully bright after
  // dark while the village around them went dim. Drop it so they light like
  // everything else.
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_unlit') ext.dispose();
  }

  await doc.transform(dedup(), prune());
  await io.write(dst, doc);
  before += statSync(src).size;
  after += statSync(dst).size;
}

const kb = (n) => `${Math.round(n / 1024)}KB`;
console.log(`${files.length} villagers: ${kb(before)} → ${kb(after)} (clips: ${[...KEEP].join(', ')})`);
