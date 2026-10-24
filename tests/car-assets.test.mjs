import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const models = ['offroad-car', 'car-sedan', 'car-sedan-wagon', 'car-sports', 'car-taxi', 'car-van', 'car-van-suv', 'car-truck', 'car-race'];
const expectedWheels = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'];
const materialRoles = {
  'car-sedan': ['car-paint', 'car-glass', 'car-rubber', 'car-metal'],
  'car-sedan-wagon': ['car-paint', 'car-glass', 'car-rubber', 'car-metal'],
  'car-sports': ['car-paint', 'car-glass', 'car-rubber', 'car-metal'],
  'car-van': ['car-paint', 'car-glass', 'car-rubber', 'car-metal'],
  'car-van-suv': ['car-paint', 'car-glass', 'car-rubber', 'car-metal'],
  'car-truck': ['car-paint', 'car-glass', 'car-rubber', 'car-metal'],
};
const atlasPaints = { 'car-taxi': 'red', 'car-race': 'red' };

for (const name of models) {
  test(`${name} is a bounded, rigged authored vehicle`, async () => {
    const doc = await io.read(`public/assets/village/${name}.glb`);
    const root = doc.getRoot().listScenes()[0];
    const nodes = doc.getRoot().listNodes();
    const names = new Set(nodes.map((node) => node.getName()));
    for (const wheel of expectedWheels) assert.ok(names.has(wheel), `missing ${wheel}`);

    const bounds = getBounds(root);
    const size = bounds.max.map((value, index) => value - bounds.min[index]);
    assert.ok(bounds.min.concat(bounds.max).every(Number.isFinite));
    assert.ok(size[2] > size[0] * 1.1, `length ${size[2]} vs width ${size[0]}`);
    assert.ok(size[1] > 0.4 && size[1] < size[2], `height ${size[1]}`);
    assert.ok(bounds.min[1] > -0.1, `below ground ${bounds.min[1]}`);

    let triangles = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
        for (const value of primitive.getAttribute('POSITION').getArray()) assert.ok(Number.isFinite(value));
      }
    }
    assert.ok(triangles > 1000 && triangles < 20000, `triangles ${triangles}`);

    const materials = doc.getRoot().listMaterials();
    const materialNames = new Set(materials.map((material) => material.getName()));
    for (const role of materialRoles[name] ?? []) assert.ok(materialNames.has(role), `missing ${role}`);
    if (name === 'offroad-car') {
      assert.ok(names.has('Cube_5'), 'original Jimny branch was replaced');
      assert.ok(materials.length >= 5, 'original Jimny materials were flattened');
    }
    if (atlasPaints[name]) {
      assert.ok(materials.some((material) => material.getBaseColorTexture()), 'authored texture is missing');
      const atlas = materials.find((material) => material.getExtras().carPaintChannel === atlasPaints[name]);
      assert.ok(atlas, 'selective paint channel is missing');
      assert.notEqual(atlas.getExtras().carRole, 'paint', 'texture atlas must not be treated as glossy paint');
    }
  });
}
