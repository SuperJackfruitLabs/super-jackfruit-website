import type * as T from 'three';

// three is loaded dynamically so the village page ships no 3D code until the
// canvas is actually mounted — modules take the namespace as a parameter.
export type Three = typeof import('three');

/** just enough of GLTFLoader for the modules that pull assets in */
export interface GltfLoaderLike {
  loadAsync(url: string): Promise<{ scene: T.Group; animations: T.AnimationClip[] }>;
}
