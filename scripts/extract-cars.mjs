// Kenney's Car Kit (CC0) points every car at one shared Textures/colormap.png
// beside the file. The village's houses use a different colormap at that same
// path, so each car is written with its texture embedded instead.
//
//   node scripts/extract-cars.mjs
import { mkdir } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';

const SRC = 'assets-src/car-kit';
const DST = 'assets-src/raw';
/** kit file → the name the village loads it by */
const CARS = {
  sedan: 'car-sedan',
  'sedan-sports': 'car-sports',
  taxi: 'car-taxi',
  police: 'car-police',
  van: 'car-van',
  truck: 'car-truck',
  race: 'car-race',
};

await mkdir(DST, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const [file, name] of Object.entries(CARS)) {
  const doc = await io.read(`${SRC}/${file}.glb`);
  for (const tex of doc.getRoot().listTextures()) tex.setURI('');
  // lit like the rest of the village, not full-bright after dark
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_unlit') ext.dispose();
  }
  await doc.transform(dedup(), prune());
  await io.write(`${DST}/${name}.glb`, doc);
}
console.log(`${Object.keys(CARS).length} cars written`);
