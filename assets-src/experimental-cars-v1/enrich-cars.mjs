import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';

const OUT = 'assets-src/raw';
await mkdir(OUT, { recursive: true });

const C = {
  glass: [0.075, 0.12, 0.18, 1],
  rubber: [0.025, 0.028, 0.032, 1],
  metal: [0.55, 0.59, 0.63, 1],
  darkMetal: [0.075, 0.085, 0.095, 1],
  trim: [0.035, 0.045, 0.055, 1],
  headlight: [1, 0.91, 0.65, 1],
  taillight: [0.65, 0.018, 0.012, 1],
  white: [0.88, 0.9, 0.88, 1],
  black: [0.025, 0.035, 0.045, 1],
  yellow: [0.96, 0.58, 0.045, 1],
  red: [0.65, 0.035, 0.025, 1],
  blue: [0.025, 0.12, 0.38, 1],
};

const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); },
};

class Geometry {
  constructor() { this.parts = new Map(); }
  data(mat) {
    if (!this.parts.has(mat)) this.parts.set(mat, { positions: [], normals: [], uvs: [], indices: [] });
    return this.parts.get(mat);
  }
  poly(mat, vertices, uv) {
    const d = this.data(mat);
    const n = v3.norm(v3.cross(v3.sub(vertices[1], vertices[0]), v3.sub(vertices[2], vertices[0])));
    const start = d.positions.length / 3;
    for (let i = 0; i < vertices.length; i++) {
      d.positions.push(...vertices[i]);
      d.normals.push(...n);
      d.uvs.push(...(uv?.[i] ?? [0, 0]));
    }
    for (let i = 1; i < vertices.length - 1; i++) d.indices.push(start, start + i, start + i + 1);
  }
  box(mat, center, size, rotation = [0, 0, 0]) {
    const [sx, sy, sz] = size.map((v) => v / 2);
    const pts = [
      [-sx, -sy, -sz], [sx, -sy, -sz], [sx, sy, -sz], [-sx, sy, -sz],
      [-sx, -sy, sz], [sx, -sy, sz], [sx, sy, sz], [-sx, sy, sz],
    ].map((p) => transform(p, center, rotation));
    for (const [a, b, c, d] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) {
      this.poly(mat, [pts[a], pts[b], pts[c], pts[d]]);
    }
  }
  cylinder(mat, center, radius, depth, axis = 'y', segments = 20, radiusTop = radius) {
    const point = (r, a, h) => {
      const u = Math.cos(a) * r, v = Math.sin(a) * r;
      const p = axis === 'x' ? [h, u, v] : axis === 'z' ? [u, v, h] : [u, h, v];
      return v3.add(center, p);
    };
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
      const p0 = point(radius, a, -depth / 2), p1 = point(radius, b, -depth / 2);
      const p2 = point(radiusTop, b, depth / 2), p3 = point(radiusTop, a, depth / 2);
      this.poly(mat, [p0, p1, p2, p3]);
      const topCenter = v3.add(center, axis === 'x' ? [depth / 2, 0, 0] : axis === 'z' ? [0, 0, depth / 2] : [0, depth / 2, 0]);
      const bottomCenter = v3.add(center, axis === 'x' ? [-depth / 2, 0, 0] : axis === 'z' ? [0, 0, -depth / 2] : [0, -depth / 2, 0]);
      this.poly(mat, [topCenter, point(radiusTop, b, depth / 2), point(radiusTop, a, depth / 2)]);
      this.poly(mat, [bottomCenter, point(radius, a, -depth / 2), point(radius, b, -depth / 2)]);
    }
  }
  rod(mat, a, b, radius = 0.025, segments = 8) {
    const dir = v3.norm(v3.sub(b, a));
    const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = v3.norm(v3.cross(dir, ref)), v = v3.norm(v3.cross(dir, u));
    const ring = (p, i) => v3.add(p, v3.add(v3.scale(u, Math.cos(i * Math.PI * 2 / segments) * radius), v3.scale(v, Math.sin(i * Math.PI * 2 / segments) * radius)));
    for (let i = 0; i < segments; i++) {
      const j = i + 1;
      this.poly(mat, [ring(a, i), ring(b, i), ring(b, j), ring(a, j)]);
    }
  }
  torus(mat, center, major, minor, axis = 'x', segments = 20, sides = 6) {
    const point = (i, j) => {
      const a = i * Math.PI * 2 / segments, b = j * Math.PI * 2 / sides;
      const r = major + minor * Math.cos(b);
      const p = axis === 'x' ? [minor * Math.sin(b), r * Math.cos(a), r * Math.sin(a)] : axis === 'z' ? [r * Math.cos(a), r * Math.sin(a), minor * Math.sin(b)] : [r * Math.cos(a), minor * Math.sin(b), r * Math.sin(a)];
      return v3.add(center, p);
    };
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) this.poly(mat, [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)]);
  }
  sections(mat, sections) {
    const ring = (s) => [
      [-s.width, s.bottom, s.z], [s.width, s.bottom, s.z],
      [s.topWidth ?? s.width, s.top, s.z], [-(s.topWidth ?? s.width), s.top, s.z],
    ];
    for (let i = 0; i < sections.length - 1; i++) {
      const a = ring(sections[i]), b = ring(sections[i + 1]);
      for (const [x, y, z, w] of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) this.poly(mat, [a[x], a[y], b[z % 4], b[w % 4]]);
    }
    const first = ring(sections[0]), last = ring(sections.at(-1));
    this.poly(mat, [first[0], first[3], first[2], first[1]]);
    this.poly(mat, [last[0], last[1], last[2], last[3]]);
  }
}

function transform(p, center, rotation) {
  let [x, y, z] = p;
  const [rx, ry, rz] = rotation;
  if (rx) { const c = Math.cos(rx), s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c]; }
  if (ry) { const c = Math.cos(ry), s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c]; }
  if (rz) { const c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c]; }
  return [x + center[0], y + center[1], z + center[2]];
}

function createModel(name) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(name);
  const root = doc.createNode(name === 'offroad-car' ? 'Cube_5' : 'body');
  scene.addChild(root);
  const materials = new Map();
  const material = (name, color, metalness = 0, roughness = 0.55, emissive = null) => {
    if (materials.has(name)) return materials.get(name);
    const m = doc.createMaterial(name).setBaseColorFactor(color).setMetallicFactor(metalness).setRoughnessFactor(roughness);
    if (name === 'Material' || name.startsWith('car-paint')) {
      const clearcoat = doc.createExtension(KHRMaterialsClearcoat).createClearcoat().setClearcoatFactor(0.55).setClearcoatRoughnessFactor(0.24);
      m.setExtension(KHRMaterialsClearcoat.EXTENSION_NAME, clearcoat);
    }
    if (emissive) m.setEmissiveFactor(emissive);
    materials.set(name, m);
    return m;
  };
  const roles = {
    paint: material(name === 'offroad-car' ? 'Material' : 'car-paint', C.red, 0.12, 0.28),
    glass: material('car-glass', C.glass, 0.18, 0.12),
    rubber: material('car-rubber', C.rubber, 0, 0.94),
    metal: material('car-metal', C.metal, 0.72, 0.25),
    darkMetal: material('car-dark-metal', C.darkMetal, 0.45, 0.42),
    trim: material('car-trim', C.trim, 0.05, 0.65),
    headlight: material('car-headlight', C.headlight, 0.1, 0.18, [1, 0.82, 0.42]),
    taillight: material('car-taillight', C.taillight, 0.05, 0.24, [0.8, 0.01, 0.005]),
    white: material('car-paint-white', C.white, 0.08, 0.32),
    black: material('car-paint-black', C.black, 0.12, 0.3),
    yellow: material('car-paint-yellow', C.yellow, 0.08, 0.3),
    red: material('police-red', [0.8, 0.015, 0.02, 1], 0.1, 0.2, [0.8, 0.01, 0.01]),
    blue: material('police-blue', [0.015, 0.12, 0.85, 1], 0.1, 0.2, [0.01, 0.1, 0.8]),
  };
  const body = new Geometry();
  const labels = [];
  const textMaterial = (text, color = '#ffffff', background = 'transparent', width = 512) => {
    const key = `${text}|${color}|${background}|${width}`;
    if (materials.has(key)) return materials.get(key);
    const m = doc.createMaterial(`label-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).setRoughnessFactor(0.6).setMetallicFactor(0).setDoubleSided(true);
    m.setAlphaMode('BLEND');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="128"><rect width="100%" height="100%" fill="${background}"/><text x="50%" y="88" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="76" font-weight="800" letter-spacing="4" fill="${color}">${text}</text></svg>`;
    labels.push(sharp(Buffer.from(svg)).png().toBuffer().then((image) => {
      const texture = doc.createTexture().setImage(image).setMimeType('image/png');
      m.setBaseColorTexture(texture);
    }));
    materials.set(key, m);
    return m;
  };
  const label = (text, color, background, center, w, h, facing = 'front') => {
    const mat = textMaterial(text, color, background);
    let points, uv;
    if (facing === 'side') {
      points = [[center[0], center[1] - h / 2, center[2] + w / 2], [center[0], center[1] - h / 2, center[2] - w / 2], [center[0], center[1] + h / 2, center[2] - w / 2], [center[0], center[1] + h / 2, center[2] + w / 2]];
      uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
    } else if (facing === 'top') {
      points = [[center[0] - w / 2, center[1], center[2] - h / 2], [center[0] + w / 2, center[1], center[2] - h / 2], [center[0] + w / 2, center[1], center[2] + h / 2], [center[0] - w / 2, center[1], center[2] + h / 2]];
      uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    } else {
      points = [[center[0] - w / 2, center[1] - h / 2, center[2]], [center[0] + w / 2, center[1] - h / 2, center[2]], [center[0] + w / 2, center[1] + h / 2, center[2]], [center[0] - w / 2, center[1] + h / 2, center[2]]];
      uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
    }
    body.poly(mat, points, uv);
  };
  const wheel = (id, x, z, radius = 0.32, width = 0.22, chunky = false) => {
    const g = new Geometry();
    const side = Math.sign(x) || 1;
    g.cylinder(roles.rubber, [0, 0, 0], radius, width, 'x', chunky ? 16 : 24);
    g.torus(roles.rubber, [side * width * 0.32, 0, 0], radius * 0.83, radius * 0.15, 'x', 24, 8);
    const outer = side * (width / 2 + 0.006);
    g.cylinder(roles.darkMetal, [outer, 0, 0], radius * 0.64, 0.025, 'x', 24);
    g.cylinder(roles.metal, [outer + side * 0.015, 0, 0], radius * 0.48, 0.02, 'x', 20);
    g.cylinder(roles.trim, [outer + side * 0.028, 0, 0], radius * 0.25, 0.018, 'x', 16);
    g.cylinder(roles.metal, [outer + side * 0.04, 0, 0], radius * 0.1, 0.025, 'x', 12);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      g.rod(roles.darkMetal, [outer + side * 0.03, Math.cos(a) * radius * 0.15, Math.sin(a) * radius * 0.15], [outer + side * 0.03, Math.cos(a) * radius * 0.43, Math.sin(a) * radius * 0.43], 0.012, 5);
    }
    if (chunky) for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 2 / 16;
      g.box(roles.rubber, [0, Math.cos(a) * radius, Math.sin(a) * radius], [width * 0.88, 0.055, 0.09], [a, 0, 0]);
    }
    return { id, g, position: [x, radius, z] };
  };
  const wheels = [];
  const addWheel = (...args) => wheels.push(wheel(...args));
  const common = {
    lamps(frontZ, rearZ, y, halfW, round = false) {
      for (const side of [-1, 1]) {
        if (round) {
          body.cylinder(roles.metal, [side * halfW, y, frontZ], 0.13, 0.055, 'z', 24);
          body.cylinder(roles.headlight, [side * halfW, y, frontZ + 0.035], 0.105, 0.035, 'z', 24);
        } else {
          body.box(roles.headlight, [side * halfW, y, frontZ], [0.3, 0.11, 0.055]);
        }
        body.box(roles.taillight, [side * halfW, y, rearZ], [0.25, 0.13, 0.05]);
      }
    },
    bumper(z, y, width, metal = true) {
      body.box(metal ? roles.metal : roles.trim, [0, y, z], [width, 0.12, 0.12]);
      body.box(roles.trim, [0, y + 0.12, z], [0.42, 0.12, 0.025]);
    },
    mirrors(y, z, halfW) {
      for (const side of [-1, 1]) {
        body.rod(roles.darkMetal, [side * (halfW - 0.05), y, z], [side * (halfW + 0.14), y + 0.025, z], 0.018);
        body.box(roles.paint, [side * (halfW + 0.16), y + 0.03, z], [0.13, 0.1, 0.18]);
        body.box(roles.glass, [side * (halfW + 0.17), y + 0.03, z - 0.025], [0.1, 0.065, 0.015]);
      }
    },
    exhaust(rearZ, y = 0.27, count = 2) {
      for (let i = 0; i < count; i++) body.cylinder(roles.metal, [(i - (count - 1) / 2) * 0.18, y, rearZ], 0.045, 0.16, 'z', 12);
    },
  };
  const finish = async (paint) => {
    roles.paint.setBaseColorFactor(paint);
    const emit = (parent, nodeName, geometry) => {
      const mesh = doc.createMesh(nodeName);
      for (const [mat, data] of geometry.parts) {
        if (!data.indices.length) continue;
        const primitive = doc.createPrimitive().setMaterial(mat);
        for (const [key, type, values] of [['POSITION', 'VEC3', data.positions], ['NORMAL', 'VEC3', data.normals], ['TEXCOORD_0', 'VEC2', data.uvs]]) {
          primitive.setAttribute(key, doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer));
        }
        primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(data.indices)).setBuffer(buffer));
        mesh.addPrimitive(primitive);
      }
      const node = doc.createNode(nodeName).setMesh(mesh);
      parent.addChild(node);
      return node;
    };
    emit(root, 'body-detail', body);
    for (const w of wheels) emit(root, w.id, w.g).setTranslation(w.position);
    await Promise.all(labels);
    await doc.transform(dedup(), prune());
    return doc;
  };
  return { body, roles, wheels, addWheel, common, label, finish, doc };
}

function jimny() {
  const m = createModel('offroad-car');
  const { body: b, roles: r, common: c } = m;
  b.sections(r.paint, [
    { z: -1.42, width: 0.64, topWidth: 0.68, bottom: 0.35, top: 0.86 },
    { z: -1.05, width: 0.72, topWidth: 0.7, bottom: 0.32, top: 0.9 },
    { z: 0.7, width: 0.72, topWidth: 0.69, bottom: 0.32, top: 0.9 },
    { z: 1.32, width: 0.65, topWidth: 0.62, bottom: 0.4, top: 0.76 },
  ]);
  b.sections(r.glass, [
    { z: -1.12, width: 0.62, topWidth: 0.59, bottom: 0.88, top: 1.52 },
    { z: -0.94, width: 0.64, topWidth: 0.6, bottom: 0.9, top: 1.68 },
    { z: 0.45, width: 0.64, topWidth: 0.6, bottom: 0.9, top: 1.68 },
    { z: 0.65, width: 0.61, topWidth: 0.59, bottom: 0.9, top: 1.5 },
  ]);
  b.box(r.paint, [0, 1.69, -0.25], [1.34, 0.12, 1.65]);
  b.box(r.paint, [0, 0.86, 0.99], [1.3, 0.13, 0.78]);
  b.box(r.trim, [0, 0.94, 1.0], [1.13, 0.018, 0.56]);
  for (const side of [-1, 1]) {
    b.box(r.paint, [side * 0.64, 1.21, -0.25], [0.055, 0.65, 0.07]);
    b.box(r.paint, [side * 0.64, 1.2, -1.02], [0.055, 0.62, 0.07]);
    b.box(r.trim, [side * 0.728, 0.42, -0.05], [0.07, 0.09, 2.25]);
    b.box(r.darkMetal, [side * 0.47, 1.79, -0.25], [0.045, 0.06, 1.42]);
    for (const z of [-0.92, 0.77]) {
      const center = [side * 0.73, 0.37, z];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * i / 6, next = Math.PI * (i + 1) / 6;
        b.rod(r.trim, [center[0], center[1] + Math.sin(a) * 0.43, center[2] + Math.cos(a) * 0.43], [center[0], center[1] + Math.sin(next) * 0.43, center[2] + Math.cos(next) * 0.43], 0.065, 4);
      }
    }
    b.box(r.trim, [side * 0.655, 0.91, -0.18], [0.018, 0.63, 0.018]);
    b.box(r.metal, [side * 0.666, 0.93, -0.43], [0.025, 0.035, 0.18]);
  }
  b.box(r.trim, [0, 0.58, 1.39], [0.65, 0.34, 0.07]);
  for (let i = -2; i <= 2; i++) b.box(r.darkMetal, [i * 0.105, 0.59, 1.435], [0.055, 0.27, 0.025]);
  c.lamps(1.42, -1.46, 0.72, 0.49, true);
  c.bumper(1.47, 0.35, 1.42);
  c.bumper(-1.49, 0.36, 1.38);
  b.box(r.metal, [0, 0.25, 1.46], [0.8, 0.07, 0.18], [0.25, 0, 0]);
  c.mirrors(1.08, 0.49, 0.71);
  b.cylinder(r.rubber, [0, 0.86, -1.55], 0.34, 0.2, 'z', 20);
  b.cylinder(r.darkMetal, [0, 0.86, -1.67], 0.21, 0.05, 'z', 20);
  b.cylinder(r.metal, [0, 0.86, -1.71], 0.1, 0.035, 'z', 16);
  b.box(r.metal, [0.42, 0.83, -1.5], [0.07, 0.34, 0.08]);
  m.label('JIMMY', '#f2f2e8', null, [0, 0.38, -1.565], 0.35, 0.1);
  m.addWheel('wheel-front-left', -0.75, 0.91, 0.36, 0.25, true);
  m.addWheel('wheel-front-right', 0.75, 0.91, 0.36, 0.25, true);
  m.addWheel('wheel-back-left', -0.75, -0.92, 0.36, 0.25, true);
  m.addWheel('wheel-back-right', 0.75, -0.92, 0.36, 0.25, true);
  c.exhaust(-1.47, 0.26, 1);
  return m.finish([0.42, 0.48, 0.07, 1]);
}

function sedanModel(kind) {
  const names = { sedan: 'car-sedan', sports: 'car-sports', taxi: 'car-taxi', police: 'car-police' };
  const m = createModel(names[kind]);
  const { body: b, roles: r, common: c } = m;
  const sports = kind === 'sports', taxi = kind === 'taxi', police = kind === 'police';
  const length = police ? 3.2 : 3;
  const rear = -length / 2, front = length / 2;
  const cabinTop = taxi ? 1.42 : sports ? 1.04 : 1.28;
  const mainPaint = police ? r.white : taxi ? r.yellow : r.paint;
  b.sections(mainPaint, [
    { z: rear, width: 0.62, topWidth: 0.65, bottom: 0.34, top: sports ? 0.55 : 0.65 },
    { z: rear + 0.25, width: 0.73, topWidth: 0.71, bottom: 0.3, top: 0.72 },
    { z: front - 0.28, width: 0.73, topWidth: 0.7, bottom: 0.3, top: sports ? 0.61 : 0.7 },
    { z: front, width: 0.65, topWidth: 0.62, bottom: 0.36, top: sports ? 0.5 : 0.59 },
  ]);
  b.sections(r.glass, [
    { z: rear + 0.42, width: 0.61, topWidth: 0.53, bottom: 0.7, top: cabinTop - 0.2 },
    { z: rear + 0.72, width: 0.63, topWidth: 0.54, bottom: 0.72, top: cabinTop },
    { z: sports ? 0.05 : 0.35, width: 0.63, topWidth: 0.54, bottom: 0.7, top: cabinTop },
    { z: sports ? 0.48 : 0.72, width: 0.6, topWidth: 0.54, bottom: 0.66, top: cabinTop - 0.22 },
  ]);
  const roofLength = sports ? 0.75 : taxi ? 1.25 : 1.05;
  b.box(mainPaint, [0, cabinTop + 0.035, sports ? -0.35 : -0.15], [1.15, 0.07, roofLength]);
  for (const side of [-1, 1]) {
    b.box(mainPaint, [side * 0.61, (cabinTop + 0.73) / 2, -0.15], [0.045, cabinTop - 0.7, 0.07]);
    b.box(r.trim, [side * 0.737, 0.38, -0.05], [0.035, 0.06, length - 0.55]);
    for (const z of [-0.42, 0.35]) {
      b.box(r.trim, [side * 0.735, 0.69, z], [0.014, 0.52, 0.014]);
      b.box(r.metal, [side * 0.75, 0.77, z - 0.18], [0.025, 0.025, 0.16]);
    }
    if (police) {
      b.box(r.black, [side * 0.68, 0.61, rear + 0.48], [0.04, 0.46, 0.65]);
      b.box(r.black, [side * 0.68, 0.59, front - 0.45], [0.04, 0.42, 0.6]);
    }
  }
  b.box(r.trim, [0, 0.48, front + 0.02], [0.62, 0.2, 0.045]);
  for (let i = -3; i <= 3; i++) b.box(r.metal, [i * 0.075, 0.48, front + 0.05], [0.025, 0.15, 0.02]);
  c.lamps(front + 0.035, rear - 0.035, sports ? 0.55 : 0.64, 0.47);
  c.bumper(front + 0.07, 0.32, 1.36, !sports);
  c.bumper(rear - 0.07, 0.33, 1.34, !sports);
  c.mirrors(0.89, sports ? 0.25 : 0.52, 0.7);
  c.exhaust(rear - 0.11, 0.25, sports ? 2 : 1);
  if (sports) {
    b.box(r.darkMetal, [0, 0.25, front + 0.12], [1.48, 0.055, 0.28]);
    b.box(r.darkMetal, [0, 0.28, rear - 0.12], [1.35, 0.08, 0.26]);
    for (const x of [-0.42, 0.42]) b.box(r.darkMetal, [x, 0.9, rear + 0.18], [0.055, 0.32, 0.08]);
    b.box(mainPaint, [0, 1.05, rear + 0.16], [1.35, 0.07, 0.3]);
    b.box(r.trim, [0, 0.57, rear - 0.08], [0.55, 0.08, 0.04]);
  }
  if (taxi) {
    b.box(r.trim, [0, cabinTop + 0.11, -0.1], [0.52, 0.08, 0.32]);
    b.box(r.yellow, [0, cabinTop + 0.23, -0.1], [0.46, 0.22, 0.25]);
    m.label('TAXI', '#191919', '#f5c343', [0, cabinTop + 0.23, 0.031], 0.4, 0.13);
    for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
      b.box(i % 2 ? r.white : r.black, [side * 0.748, 0.69, rear + 0.4 + i * 0.18], [0.015, 0.09, 0.18]);
      b.box(i % 2 ? r.black : r.white, [side * 0.748, 0.78, rear + 0.4 + i * 0.18], [0.015, 0.09, 0.18]);
    }
  }
  if (police) {
    b.box(r.darkMetal, [0, cabinTop + 0.1, -0.05], [0.85, 0.06, 0.22]);
    b.box(r.red, [-0.23, cabinTop + 0.17, -0.05], [0.35, 0.13, 0.18]);
    b.box(r.blue, [0.23, cabinTop + 0.17, -0.05], [0.35, 0.13, 0.18]);
    for (const x of [-0.37, 0.37]) b.rod(r.darkMetal, [x, 0.35, front + 0.18], [x, 0.83, front + 0.18], 0.035);
    b.rod(r.darkMetal, [-0.42, 0.65, front + 0.18], [0.42, 0.65, front + 0.18], 0.03);
    b.rod(r.darkMetal, [-0.42, 0.42, front + 0.18], [0.42, 0.42, front + 0.18], 0.03);
    for (const side of [-1, 1]) m.label('POLICE', '#111820', null, [side * 0.758, 0.73, -0.1], 0.82, 0.18, 'side');
  }
  const wheelZ = length / 2 - 0.48;
  for (const side of [-1, 1]) {
    m.addWheel(`wheel-front-${side < 0 ? 'left' : 'right'}`, side * 0.75, wheelZ, sports ? 0.3 : 0.32, 0.22);
    m.addWheel(`wheel-back-${side < 0 ? 'left' : 'right'}`, side * 0.75, -wheelZ, sports ? 0.31 : 0.32, 0.22);
  }
  const colors = { sedan: [0.08, 0.25, 0.58, 1], sports: [0.72, 0.045, 0.025, 1], taxi: C.yellow, police: C.white };
  return m.finish(colors[kind]);
}

function van() {
  const m = createModel('car-van');
  const { body: b, roles: r, common: c } = m;
  b.sections(r.white, [
    { z: -1.62, width: 0.72, topWidth: 0.72, bottom: 0.3, top: 1.7 },
    { z: 0.3, width: 0.74, topWidth: 0.72, bottom: 0.3, top: 1.7 },
    { z: 1.15, width: 0.73, topWidth: 0.69, bottom: 0.3, top: 1.28 },
    { z: 1.58, width: 0.65, topWidth: 0.62, bottom: 0.38, top: 0.75 },
  ]);
  b.sections(r.glass, [
    { z: 0.55, width: 0.65, topWidth: 0.62, bottom: 0.92, top: 1.55 },
    { z: 1.08, width: 0.64, topWidth: 0.61, bottom: 0.9, top: 1.36 },
  ]);
  b.box(r.white, [0, 1.73, -0.65], [1.48, 0.1, 2.0]);
  b.box(r.white, [0, 1.57, 0.5], [1.35, 0.08, 0.75]);
  for (const side of [-1, 1]) {
    b.box(r.trim, [side * 0.745, 0.45, -0.05], [0.035, 0.08, 2.75]);
    b.box(r.trim, [side * 0.746, 0.93, -0.55], [0.016, 1.25, 0.018]);
    b.box(r.trim, [side * 0.746, 0.93, 0.18], [0.016, 1.25, 0.018]);
    b.box(r.metal, [side * 0.76, 0.93, 0.03], [0.025, 0.04, 0.19]);
    b.box(r.darkMetal, [side * 0.5, 1.84, -0.6], [0.045, 0.07, 1.6]);
    m.label('SUPER JACKFRUIT', '#6a3ab0', null, [side * 0.758, 1.15, -0.62], 1.25, 0.2, 'side');
  }
  for (const z of [-1.2, 0.1]) b.box(r.darkMetal, [0, 1.88, z], [1.1, 0.045, 0.05]);
  b.box(r.trim, [0, 0.98, -1.635], [0.018, 1.25, 0.018]);
  for (const x of [-0.48, 0.48]) b.box(r.metal, [x, 0.88, -1.65], [0.035, 0.22, 0.035]);
  b.box(r.trim, [0, 0.51, 1.6], [0.65, 0.22, 0.05]);
  for (let i = -3; i <= 3; i++) b.box(r.darkMetal, [i * 0.08, 0.51, 1.635], [0.035, 0.16, 0.02]);
  c.lamps(1.63, -1.66, 0.72, 0.48);
  c.bumper(1.67, 0.34, 1.42, false);
  c.bumper(-1.7, 0.35, 1.42, false);
  c.mirrors(1.1, 0.87, 0.74);
  c.exhaust(-1.68, 0.25, 1);
  for (const side of [-1, 1]) {
    m.addWheel(`wheel-front-${side < 0 ? 'left' : 'right'}`, side * 0.76, 1.0, 0.35, 0.24);
    m.addWheel(`wheel-back-${side < 0 ? 'left' : 'right'}`, side * 0.76, -1.05, 0.35, 0.24);
  }
  return m.finish(C.white);
}

function truck() {
  const m = createModel('car-truck');
  const { body: b, roles: r, common: c } = m;
  const paint = r.paint;
  b.sections(paint, [
    { z: -1.8, width: 0.68, topWidth: 0.69, bottom: 0.35, top: 0.66 },
    { z: 0.95, width: 0.75, topWidth: 0.72, bottom: 0.32, top: 0.75 },
    { z: 1.65, width: 0.67, topWidth: 0.64, bottom: 0.4, top: 0.66 },
  ]);
  b.sections(r.glass, [
    { z: -0.35, width: 0.64, topWidth: 0.57, bottom: 0.74, top: 1.35 },
    { z: -0.1, width: 0.65, topWidth: 0.57, bottom: 0.75, top: 1.48 },
    { z: 0.65, width: 0.65, topWidth: 0.57, bottom: 0.75, top: 1.48 },
    { z: 0.92, width: 0.62, topWidth: 0.56, bottom: 0.74, top: 1.29 },
  ]);
  b.box(paint, [0, 1.5, 0.25], [1.25, 0.08, 0.9]);
  b.box(r.darkMetal, [0, 0.64, -1.12], [1.2, 0.06, 1.15]);
  for (const side of [-1, 1]) {
    b.box(paint, [side * 0.66, 0.85, -1.12], [0.13, 0.44, 1.3]);
    b.box(r.metal, [side * 0.67, 1.08, -1.12], [0.15, 0.045, 1.34]);
    b.box(r.trim, [side * 0.755, 0.42, 0], [0.045, 0.09, 2.9]);
    b.box(r.trim, [side * 0.72, 0.3, -1.45], [0.28, 0.38, 0.055]);
    b.box(r.trim, [side * 0.72, 0.3, 1.12], [0.28, 0.34, 0.055]);
    b.box(r.trim, [side * 0.745, 0.83, 0.25], [0.016, 0.68, 0.016]);
    b.box(r.metal, [side * 0.76, 0.89, 0.05], [0.025, 0.035, 0.18]);
    for (const z of [-1.2, 1.05]) for (let i = 0; i < 6; i++) {
      const a = Math.PI * i / 5, next = Math.PI * (i + 1) / 5;
      b.rod(r.trim, [side * 0.76, 0.39 + Math.sin(a) * 0.43, z + Math.cos(a) * 0.43], [side * 0.76, 0.39 + Math.sin(next) * 0.43, z + Math.cos(next) * 0.43], 0.045, 4);
    }
  }
  b.box(paint, [0, 0.85, -1.75], [1.35, 0.44, 0.12]);
  b.box(r.trim, [0, 0.88, -1.82], [0.38, 0.06, 0.025]);
  b.box(r.trim, [0, 0.49, 1.7], [0.68, 0.22, 0.05]);
  for (let i = -3; i <= 3; i++) b.box(r.metal, [i * 0.08, 0.49, 1.735], [0.035, 0.16, 0.02]);
  c.lamps(1.7, -1.84, 0.67, 0.48);
  c.bumper(1.77, 0.35, 1.43);
  c.bumper(-1.9, 0.35, 1.43);
  c.mirrors(1.02, 0.7, 0.72);
  c.exhaust(-1.85, 0.26, 1);
  for (const side of [-1, 1]) {
    m.addWheel(`wheel-front-${side < 0 ? 'left' : 'right'}`, side * 0.78, 1.08, 0.36, 0.25, true);
    m.addWheel(`wheel-back-${side < 0 ? 'left' : 'right'}`, side * 0.78, -1.22, 0.36, 0.25, true);
  }
  return m.finish([0.08, 0.34, 0.2, 1]);
}

function race() {
  const m = createModel('car-race');
  const { body: b, roles: r } = m;
  b.sections(r.paint, [
    { z: -1.35, width: 0.24, topWidth: 0.18, bottom: 0.28, top: 0.64 },
    { z: -0.45, width: 0.36, topWidth: 0.28, bottom: 0.22, top: 0.66 },
    { z: 0.5, width: 0.2, topWidth: 0.13, bottom: 0.2, top: 0.48 },
    { z: 1.5, width: 0.08, topWidth: 0.055, bottom: 0.2, top: 0.32 },
  ]);
  for (const side of [-1, 1]) {
    b.box(r.paint, [side * 0.42, 0.43, -0.3], [0.36, 0.34, 0.95]);
    b.box(r.darkMetal, [side * 0.42, 0.27, -0.3], [0.4, 0.08, 1.05]);
    for (const z of [-0.93, 0.96]) {
      b.rod(r.darkMetal, [side * 0.18, 0.35, z - 0.2], [side * 0.79, 0.37, z], 0.025);
      b.rod(r.darkMetal, [side * 0.2, 0.52, z + 0.18], [side * 0.79, 0.39, z], 0.022);
    }
    b.box(r.darkMetal, [side * 0.48, 0.23, -1.34], [0.035, 0.35, 0.32]);
  }
  b.box(r.trim, [0, 0.62, -0.25], [0.34, 0.15, 0.52]);
  b.cylinder(r.darkMetal, [0, 0.75, -0.28], 0.15, 0.22, 'y', 16);
  b.cylinder(r.white, [0, 0.88, -0.28], 0.13, 0.12, 'y', 16);
  b.box(r.glass, [0, 0.88, -0.19], [0.19, 0.07, 0.035]);
  b.rod(r.darkMetal, [0, 0.57, 0.25], [0, 0.97, 0.08], 0.035);
  b.rod(r.darkMetal, [0, 0.97, 0.08], [0, 0.98, -0.48], 0.035);
  for (const side of [-1, 1]) b.rod(r.darkMetal, [0, 0.97, 0.08], [side * 0.24, 0.63, -0.28], 0.03);
  b.box(r.darkMetal, [0, 0.2, 1.4], [1.62, 0.06, 0.34]);
  b.box(r.paint, [0, 0.27, 1.48], [1.55, 0.045, 0.18]);
  for (const side of [-1, 1]) b.box(r.paint, [side * 0.76, 0.29, 1.4], [0.06, 0.25, 0.38]);
  for (const x of [-0.4, 0.4]) b.box(r.darkMetal, [x, 0.69, -1.24], [0.05, 0.48, 0.08]);
  b.box(r.darkMetal, [0, 0.91, -1.28], [1.2, 0.07, 0.32]);
  b.box(r.paint, [0, 0.99, -1.3], [1.28, 0.06, 0.25]);
  b.box(r.darkMetal, [0, 0.21, -1.45], [0.85, 0.12, 0.35], [-0.2, 0, 0]);
  b.cylinder(r.metal, [0.18, 0.48, -1.43], 0.055, 0.18, 'z', 12);
  m.label('01', '#ffffff', null, [0, 0.655, -0.78], 0.3, 0.18, 'top');
  for (const side of [-1, 1]) {
    m.addWheel(`wheel-front-${side < 0 ? 'left' : 'right'}`, side * 0.83, 0.98, 0.34, 0.28);
    m.addWheel(`wheel-back-${side < 0 ? 'left' : 'right'}`, side * 0.83, -0.96, 0.37, 0.33);
  }
  return m.finish([0.72, 0.035, 0.02, 1]);
}

const jobs = [
  ['offroad-car', jimny],
  ['car-sedan', () => sedanModel('sedan')],
  ['car-sports', () => sedanModel('sports')],
  ['car-taxi', () => sedanModel('taxi')],
  ['car-police', () => sedanModel('police')],
  ['car-van', van],
  ['car-truck', truck],
  ['car-race', race],
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const [name, build] of jobs) {
  const doc = await build();
  await io.write(`${OUT}/${name}.glb`, doc);
  const triangles = doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  console.log(`${name}: ${triangles} triangles, ${doc.getRoot().listMaterials().length} materials`);
}
