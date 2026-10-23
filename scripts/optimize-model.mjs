// Squeezes one model further than compress-assets.mjs does, for a model that
// is worth a closer look: welds duplicate vertices, optionally simplifies,
// reorders for the GPU's vertex cache and for compression, then meshopt-
// compresses with the same filters. It writes a new file and reports sizes and triangle counts; it
// never touches public/assets, so a result is shipped only once it has been
// compared and found identical.
//
//   node scripts/optimize-model.mjs <in.glb> <out.glb> [--ratio 0.5] [--webp [--tex 1024] [--q 88]]
//
//   --ratio  keep this share of the triangles (meshopt's simplifier); 1, the
//            default, leaves the shape alone, which a flat-shaded low-poly
//            model almost always wants
//   --webp   re-encode textures as WebP (needs sharp, which isn't one of our
//            dependencies; Kenney's palettes are tiny PNGs and rarely gain)
//
// It keeps 16-bit normals, as compress-assets.mjs does and for the same reason:
// the village is flat-shaded, the hard break between facets is the art, and
// 8- or 10-bit normals smear the facets into soft bands.
//
// Adapted from dioramas, scripts/optimize.mjs, https://github.com/blendi-remade/dioramas
//
// MIT License
//
// Copyright (c) 2026 Blendi
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
import { mkdirSync, statSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, weld, simplify, reorder, quantize, textureCompress, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [, , input, output, ...rest] = process.argv;
if (!input || !output) {
  console.error('usage: node scripts/optimize-model.mjs <in.glb> <out.glb> [--ratio 0.5] [--webp [--tex 1024] [--q 88]]');
  process.exit(1);
}
const flag = (k) => rest.includes(`--${k}`);
const opt = (k, d) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : d;
};
const ratio = Number(opt('ratio', 1));
const tex = Number(opt('tex', 1024));
const quality = Number(opt('q', 88));

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const triangles = (doc) =>
  doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0), 0);

const doc = await io.read(input);
const trisBefore = triangles(doc);
const ops = [dedup(), weld()];
if (ratio < 1) ops.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008, lockBorder: true }));
if (flag('webp')) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('--webp needs sharp, which is not installed here');
    process.exit(1);
  }
  ops.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality }));
}
ops.push(prune());
await doc.transform(...ops);
// meshopt()'s own 'high' level would cap the normals at 8 bits, so do its three steps by hand:
// reorder for the vertex cache and the compressor, quantize everything to 16 bits, and let the
// encoder's filters do the rest
await doc.transform(
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
  quantize({ quantizePosition: 16, quantizeNormal: 16, quantizeTexcoord: 16, quantizeColor: 16 })
);
doc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
mkdirSync(dirname(output), { recursive: true });
await io.write(output, doc);

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(
  `${basename(output)}: ${kb(statSync(input).size)} -> ${kb(statSync(output).size)}, ` +
    `${Math.round(trisBefore)} -> ${Math.round(triangles(doc))} triangles`
);
