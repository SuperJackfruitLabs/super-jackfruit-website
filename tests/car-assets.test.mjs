import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const models = ['offroad-car', 'car-sedan', 'car-sports', 'car-taxi', 'car-police', 'car-van', 'car-truck', 'car-race'];
const expectedWheels = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'];

for (const name of models) {
  test(`${name} is a bounded, rigged, material-rich vehicle`, async () => {
    const doc = await io.read(`public/assets/village/${name}.glb`);
    const root = doc.getRoot().listScenes()[0];
    const nodes = doc.getRoot().listNodes();
    const names = new Set(nodes.map((node) => node.getName()));
    for (const wheel of expectedWheels) assert.ok(names.has(wheel), `missing ${wheel}`);

    const bounds = getBounds(root);
    const size = bounds.max.map((value, index) => value - bounds.min[index]);
    assert.ok(bounds.min.concat(bounds.max).every(Number.isFinite));
    assert.ok(size[2] > 2.4 && size[2] < 4.2, `length ${size[2]}`);
    assert.ok(size[0] < 2.4, `width ${size[0]}`);
    assert.ok(size[1] < 2.5, `height ${size[1]}`);
    assert.ok(bounds.min[1] > -0.1, `below ground ${bounds.min[1]}`);

    let triangles = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
        for (const value of primitive.getAttribute('POSITION').getArray()) assert.ok(Number.isFinite(value));
      }
    }
    assert.ok(triangles > 1500 && triangles < 12000, `triangles ${triangles}`);

    const materials = doc.getRoot().listMaterials();
    const materialNames = new Set(materials.map((material) => material.getName()));
    for (const role of ['car-glass', 'car-rubber', 'car-metal']) assert.ok(materialNames.has(role), `missing ${role}`);
    assert.ok([...materialNames].some((material) => material === 'Material' || material.startsWith('car-paint')));
    const paint = materials.find((material) => material.getName() === 'Material' || material.getName().startsWith('car-paint'));
    assert.ok(paint.getExtension(KHRMaterialsClearcoat.EXTENSION_NAME));
    if (name === 'car-police') {
      assert.ok(materialNames.has('police-red'));
      assert.ok(materialNames.has('police-blue'));
    }
  });
}
