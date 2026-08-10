// Meshopt-compresses every model in assets-src/raw into public/assets/village,
// which is what the browser actually downloads. Roughly a 3× saving, and the
// decoder ships inside three's addons, so it costs no extra hosting.
//
//   node scripts/compress-assets.mjs
import { readdir, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const SRC = 'assets-src/raw';
const DST = 'public/assets/village';

await MeshoptEncoder.ready;
await mkdir(DST, { recursive: true });

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const files = (await readdir(SRC)).filter((f) => f.endsWith('.glb')).sort();
let before = 0;
let after = 0;

for (const file of files) {
  const src = join(SRC, file);
  const dst = join(DST, file);
  const doc = await io.read(src);
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder }));
  await io.write(dst, doc);
  before += statSync(src).size;
  after += statSync(dst).size;
}

const kb = (n) => `${Math.round(n / 1024)}KB`;
console.log(`${files.length} models: ${kb(before)} → ${kb(after)} (${(before / after).toFixed(1)}× smaller)`);
