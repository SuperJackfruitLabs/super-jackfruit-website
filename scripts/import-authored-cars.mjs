// Select and rig Han66st's authored vehicles without reshaping their bodywork.
// Original downloads, including every unused variant, remain in authored-cars.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';

const SRC = 'assets-src/authored-cars';
const DST = 'assets-src/raw';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const COMMON_ROLES = {
  'car-paint': 'paint',
  'car-glass': 'glass',
  'car-rubber': 'rubber',
  'car-metal': 'metal',
  'car-headlight': 'headlight',
  'car-taillight': 'taillight',
};

const SEDAN_ROLES = { 'windows.001': 'car-glass', 'tire.001': 'car-rubber', 'rims.001': 'car-metal', 'headlight.001': 'car-headlight', 'taillight.001': 'car-taillight', 'taillight.002': 'car-taillight' };
const MPV_ROLES = { windows: 'car-glass', tire: 'car-rubber', rims: 'car-metal', chrm: 'car-metal', headlight: 'car-headlight', taillight: 'car-taillight' };
const specs = [
  {
    file: 'lowpoly_sedan__wagon.glb', output: 'car-sedan', variant: 'body_sedan_9', angle: 0,
    roles: { ...SEDAN_ROLES, body: 'car-paint' },
  },
  {
    file: 'lowpoly_sedan__wagon.glb', output: 'car-sedan-wagon', variant: 'body_wagon_4', angle: 0,
    roles: { ...SEDAN_ROLES, 'body.001': 'car-paint' },
  },
  {
    file: 'generic_sport_car_low_poly.glb', output: 'car-sports', variant: 'mc.Body_4', angle: -Math.PI / 2,
    roles: { 'Material.217': 'car-paint', 'Material.215': 'car-glass', 'Material.228': 'car-rubber', 'Material.227': 'car-metal', 'light.003': 'car-headlight', 'brake.002': 'car-taillight' },
  },
  {
    file: 'low_poly_hongkong_taxi.glb', output: 'car-taxi', variant: 'Cube', angle: 0,
    roles: { 'Material.010': 'car-taillight', 'Material.008': 'car-headlight' }, atlas: { Material: 'red' },
  },
  {
    file: 'lowpoly_mpvsuv.glb', output: 'car-van', variant: 'body1_9', angle: 0.088,
    roles: { ...MPV_ROLES, paint: 'car-paint' },
  },
  {
    file: 'lowpoly_mpvsuv.glb', output: 'car-van-suv', variant: 'body2_4', angle: -0.08,
    roles: { ...MPV_ROLES, paint: 'car-paint', 'paint.001': 'car-paint' },
  },
  { file: 'l300_pickup.glb', output: 'car-truck', partition: 'truck', angle: 0,
    roles: { Material: 'car-paint', 'Material.001': 'car-metal', 'Material.002': 'car-rubber', 'Material.003': 'car-glass', 'Material.004': 'car-headlight', 'Material.006': 'car-taillight' },
  },
  { file: 'low-poly_vintage_f1.glb', output: 'car-race', variant: 'body_64', angle: -Math.PI / 2, deepWheels: true, roles: {}, atlas: { material_0: 'red' } },
];

const multiply = (a, b) => {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
};

const centerOf = (node) => {
  const { min, max } = getBounds(node);
  return min.map((value, i) => (value + max[i]) / 2);
};

function rebasedWheel(doc, car, source, worlds) {
  const wheel = doc.createNode('wheel');
  car.addChild(wheel);
  for (const child of source.listChildren()) {
    wheel.addChild(child);
    child.setMatrix(worlds.get(child));
  }
  const center = centerOf(wheel);
  wheel.setTranslation(center);
  for (const child of wheel.listChildren()) {
    const matrix = [...worlds.get(child)];
    for (let i = 0; i < 3; i++) matrix[12 + i] -= center[i];
    child.setMatrix(matrix);
  }
  return wheel;
}

function extractVariant(doc, spec, car, worlds) {
  const source = doc.getRoot().listNodes().find((node) => node.getName() === spec.variant);
  if (!source) throw new Error(`${spec.file}: missing ${spec.variant}`);
  if (spec.deepWheels) {
    const wheels = [];
    source.traverse((node) => {
      if (/^(front|rear)_(left|right)_\d+$/.test(node.getName())) wheels.push(node);
    });
    for (const wheel of wheels) rebasedWheel(doc, car, wheel, worlds);
  }
  for (const child of [...source.listChildren()]) {
    if (/^(wheel|mc-wheel|Cylinder)/i.test(child.getName())) {
      rebasedWheel(doc, car, child, worlds);
    } else {
      car.addChild(child);
      child.setName(`Body_${child.getName()}`);
      child.setMatrix(worlds.get(child));
    }
  }
}

function components(primitive) {
  const positions = primitive.getAttribute('POSITION').getArray();
  const indices = primitive.getIndices().getArray();
  const parents = Array.from({ length: indices.length / 3 }, (_, i) => i);
  const find = (i) => parents[i] === i ? i : (parents[i] = find(parents[i]));
  const join = (a, b) => {
    a = find(a); b = find(b);
    if (a !== b) parents[b] = a;
  };
  const welded = new Map();
  for (let triangle = 0; triangle < parents.length; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const vertex = indices[triangle * 3 + corner];
      const key = [0, 1, 2].map((axis) => Math.round(positions[vertex * 3 + axis] * 1e5)).join(',');
      if (welded.has(key)) join(triangle, welded.get(key));
      else welded.set(key, triangle);
    }
  }
  const groups = new Map();
  for (let triangle = 0; triangle < parents.length; triangle++) {
    const root = find(triangle);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(triangle);
  }
  return [...groups.values()].map((triangles) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const triangle of triangles) {
      for (let corner = 0; corner < 3; corner++) {
        const vertex = indices[triangle * 3 + corner];
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], positions[vertex * 3 + axis]);
          max[axis] = Math.max(max[axis], positions[vertex * 3 + axis]);
        }
      }
    }
    return { triangles, min, max, center: min.map((value, i) => (value + max[i]) / 2) };
  });
}

function partitionVehicle(doc, spec, car, worlds) {
  const groups = new Map();
  for (const source of doc.getRoot().listNodes()) {
    if (!source.getMesh()) continue;
    for (const primitive of source.getMesh().listPrimitives()) {
      if (primitive.getMode() !== 4) continue;
      for (const component of components(primitive)) {
        const [x, y, z] = component.center;
        if (spec.partition === 'police' && (spec.side === 'negative' ? x >= 0 : x <= 0)) continue;
        let category = 'body';
        if (spec.partition === 'police') {
          const left = spec.side === 'negative' ? x < -1.5 : x < 1.5;
          const roadWheel = spec.side === 'negative' ? [140, 196].includes(component.triangles.length) : component.triangles.length === 236;
          if (roadWheel) category = left ? (y < 0 ? 'front-left' : 'rear-left') : (y < 0 ? 'front-right' : 'rear-right');
          if (component.triangles.length === 332) category = 'lightbar';
        } else {
          const wheelHeight = z > -0.1 && z < 1.8;
          const wheelAxle = (y > -2.6 && y < -0.6) || (y > 4 && y < 5.9);
          if (Math.abs(x) > 1.5 && wheelHeight && wheelAxle) {
            category = `${y < 0 ? 'front' : 'rear'}-${x < 0 ? 'left' : 'right'}`;
          }
        }
        const key = `${source.getName()}:${category}:${groups.size}`;
        if (!groups.has(category)) groups.set(category, []);
        const mesh = doc.createMesh(`${category}-geometry`);
        const next = primitive.clone();
        const triangles = component.triangles.flatMap((triangle) => [...primitive.getIndices().getArray().slice(triangle * 3, triangle * 3 + 3)]);
        next.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(triangles)));
        mesh.addPrimitive(next);
        const node = doc.createNode(`${category}-${key}`).setMesh(mesh).setMatrix(worlds.get(source));
        groups.get(category).push(node);
      }
    }
  }
  for (const [category, nodes] of groups) {
    if (category === 'body' || category === 'lightbar') {
      for (const node of nodes) car.addChild(node);
      continue;
    }
    const wheel = doc.createNode(`wheel-${category}`);
    car.addChild(wheel);
    for (const node of nodes) wheel.addChild(node);
    const center = centerOf(wheel);
    wheel.setTranslation(center);
    for (const node of wheel.listChildren()) {
      const matrix = node.getMatrix();
      for (let i = 0; i < 3; i++) matrix[12 + i] -= center[i];
      node.setMatrix(matrix);
    }
  }
  if (![...groups.keys()].some((key) => key.startsWith('front'))) throw new Error(`${spec.file}: no front wheels found`);
}

for (const spec of specs) {
  const doc = await io.read(`${SRC}/${spec.file}`);
  const worlds = new Map(doc.getRoot().listNodes().map((node) => [node, node.getWorldMatrix()]));
  const oldScenes = doc.getRoot().listScenes();
  const scene = doc.createScene(spec.output);
  const car = doc.createNode('Vehicle');
  scene.addChild(car);
  if (spec.partition) partitionVehicle(doc, spec, car, worlds);
  else extractVariant(doc, spec, car, worlds);

  car.setRotation([0, Math.sin(spec.angle / 2), 0, Math.cos(spec.angle / 2)]);
  const bounds = getBounds(scene);
  car.setTranslation([
    -(bounds.min[0] + bounds.max[0]) / 2,
    -bounds.min[1],
    -(bounds.min[2] + bounds.max[2]) / 2,
  ]);
  for (const wheel of car.listChildren().filter((node) => /^wheel/i.test(node.getName()))) {
    const center = centerOf(wheel);
    const axle = center[2] > 0 ? 'front' : 'back';
    const side = center[0] > 0 ? 'right' : 'left';
    wheel.setName(`wheel-${axle}-${side}`);
  }
  for (const child of [...car.listChildren()]) {
    scene.addChild(child);
    child.setMatrix(multiply(car.getMatrix(), child.getMatrix()));
  }
  scene.removeChild(car);
  for (const old of oldScenes) {
    for (const child of old.listChildren()) old.removeChild(child);
    old.dispose();
  }
  doc.getRoot().setDefaultScene(scene);

  for (const material of doc.getRoot().listMaterials()) {
    const sourceName = material.getName();
    const role = spec.roles[sourceName];
    if (role) {
      material.setName(role);
      material.setExtras({ ...material.getExtras(), carRole: COMMON_ROLES[role] ?? 'trim' });
    }
    const channel = spec.atlas?.[sourceName];
    if (channel) material.setExtras({ ...material.getExtras(), carPaintChannel: channel });
  }
  await doc.transform(dedup(), prune());
  const wheels = doc.getRoot().listNodes().filter((node) => /^wheel/i.test(node.getName()));
  if (wheels.length !== 4) throw new Error(`${spec.output}: expected four wheels, got ${wheels.length}`);
  await io.write(`${DST}/${spec.output}.glb`, doc);
  console.log(`${spec.output}: ${spec.file}, four independent wheels`);
}
