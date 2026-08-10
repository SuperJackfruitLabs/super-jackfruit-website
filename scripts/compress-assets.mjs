// Meshopt-compresses every model in assets-src/raw into public/assets/village,
// which is what the browser actually downloads. Roughly a 3× saving, and the
// decoder ships inside three's addons, so it costs no extra hosting.
//
//   node scripts/compress-assets.mjs
import { readdir, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const SRC = 'assets-src/raw';
const DST = 'public/assets/village';

await MeshoptEncoder.ready;
await mkdir(DST, { recursive: true });

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const files = (await readdir(SRC)).filter((f) => f.endsWith('.glb')).sort();
let before = 0;
let after = 0;

for (const file of files) {
  const src = join(SRC, file);
  const dst = join(DST, file);
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    prune(),
    // The default meshopt preset packs normals to 8 bits, which is fine for
    // smooth-shaded models and ruinous here: this village is flat-shaded
    // low-poly, so the hard shading break between neighbouring facets IS the
    // art. At 8 bits the facets smear into soft bands and a conifer reads as a
    // smooth cone. 16 bits keeps the facets crisp and still compresses well.
    quantize({
      quantizePosition: 16,
      quantizeNormal: 16,
      quantizeTexcoord: 16,
      quantizeColor: 16,
    })
  );
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(dst, doc);
  before += statSync(src).size;
  after += statSync(dst).size;
}

const kb = (n) => `${Math.round(n / 1024)}KB`;
console.log(`${files.length} models: ${kb(before)} → ${kb(after)} (${(before / after).toFixed(1)}× smaller)`);
