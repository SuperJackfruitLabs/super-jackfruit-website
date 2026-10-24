import type * as T from 'three';
import type { Three } from './types';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type CarEnvironment = T.Texture;

export function createCarEnvironment(THREE: Three, renderer: T.WebGLRenderer): CarEnvironment {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = generator.fromScene(room, 0.04);
  room.dispose();
  generator.dispose();
  return target.texture;
}

const roleOf = (material: T.Material): string => {
  if (material.userData.carRole) return material.userData.carRole;
  const name = material.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (name === 'material' || name.startsWith('carpaint')) return 'paint';
  if (name.startsWith('carglass')) return 'glass';
  if (name.startsWith('carrubber')) return 'rubber';
  if (name.startsWith('carmetal')) return 'metal';
  if (name.startsWith('carheadlight')) return 'headlight';
  if (name.startsWith('cartail')) return 'taillight';
  if (name.startsWith('policered')) return 'police-red';
  if (name.startsWith('policeblue')) return 'police-blue';
  return 'trim';
};

function finishMaterial(THREE: Three, source: T.Material, env: CarEnvironment, role: string): T.Material {
  const material = source as T.MeshStandardMaterial;
  material.envMap = env;
  material.envMapIntensity = role === 'glass' ? 0.75 : role === 'metal' ? 0.65 : role === 'rubber' ? 0.12 : 0.42;
  if ('roughness' in material) {
    if (role === 'paint') material.roughness = Math.min(material.roughness, 0.3);
    if (role === 'glass') material.roughness = 0.14;
    if (role === 'rubber') material.roughness = 0.94;
  }
  if (role === 'paint' && material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0.55;
    material.clearcoatRoughness = 0.24;
  }
  material.userData.carRole = role;
  return material;
}

export function finishVehicle(THREE: Three, root: T.Object3D, env: CarEnvironment): void {
  root.traverse((object) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    const finish = (source: T.Material) => finishMaterial(THREE, source.clone(), env, roleOf(source));
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(finish);
    else mesh.material = finish(mesh.material);
  });
}
