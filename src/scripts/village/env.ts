// Time of day: sky dome, stars, sun, hemisphere fill, fog and exposure all
// lerp toward one preset together, so a switch reads as weather rather than a
// cut. `update` returns the night factor everything else keys off.
import type * as T from 'three';
import type { Three } from './types';

interface EnvPreset {
  horizon: number[]; mid: number[]; zenith: number[]; glow: number[];
  sunDir: number[]; sunColor: number; sunIntensity: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  fog: number; exposure: number; night: number;
}

export const TIME_PRESETS: Record<string, EnvPreset> = {
  dawn: {
    horizon: [1.0, 0.78, 0.75], mid: [0.95, 0.85, 0.8], zenith: [0.5, 0.62, 0.82],
    glow: [0.4, 0.2, 0.12], sunDir: [0.8, 0.18, 0.3],
    sunColor: 0xffd4ae, sunIntensity: 2.2, hemiSky: 0xe8e0ff, hemiGround: 0xbfae90, hemiIntensity: 1.05,
    fog: 0xefe2e2, exposure: 1.05, night: 0,
  },
  day: {
    horizon: [0.87, 0.94, 1.0], mid: [0.62, 0.82, 0.96], zenith: [0.29, 0.56, 0.85],
    glow: [0.22, 0.2, 0.12], sunDir: [0.35, 0.75, 0.25],
    sunColor: 0xfff6e0, sunIntensity: 3.4, hemiSky: 0xcfe8ff, hemiGround: 0xcfc0a0, hemiIntensity: 1.4,
    fog: 0xdfeaf2, exposure: 1.15, night: 0,
  },
  dusk: {
    horizon: [1.0, 0.85, 0.66], mid: [0.66, 0.85, 0.96], zenith: [0.38, 0.66, 0.9],
    glow: [0.35, 0.2, 0.05], sunDir: [0.5, 0.35, 0.4],
    sunColor: 0xffe2b0, sunIntensity: 3.2, hemiSky: 0xbfe0ff, hemiGround: 0xd8c090, hemiIntensity: 1.25,
    fog: 0xdfe9ef, exposure: 1.18, night: 0,
  },
  night: {
    horizon: [0.1, 0.13, 0.24], mid: [0.05, 0.08, 0.18], zenith: [0.02, 0.03, 0.09],
    glow: [0.1, 0.12, 0.2], sunDir: [-0.4, 0.5, -0.3],
    sunColor: 0xa9c0e8, sunIntensity: 0.75, hemiSky: 0x2a3a58, hemiGround: 0x1a2030, hemiIntensity: 0.55,
    fog: 0x0e1424, exposure: 1.0, night: 1,
  },
};

export interface Env {
  setTime(name: string): void;
  /** shadow detail follows the quality tier, including when it changes mid-drive */
  setShadowMapSize(size: number): void;
  /** advances the transition; returns the current night factor (0..1) */
  update(dt: number): number;
  /** keeps the sky centred on the camera and the shadow frustum on the player */
  follow(camPos: T.Vector3, target: T.Vector3): void;
}

export function createEnv(THREE: Three, scene: T.Scene, renderer: T.WebGLRenderer, shadowMapSize: number): Env {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(1.0, 0.85, 0.66) },
      uMid: { value: new THREE.Color(0.66, 0.85, 0.96) },
      uZenith: { value: new THREE.Color(0.38, 0.66, 0.9) },
      uGlowColor: { value: new THREE.Color(0.35, 0.2, 0.05) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.4).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uMid;
      uniform vec3 uZenith;
      uniform vec3 uGlowColor;
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.28, 0.85, h));
        float sunGlow = pow(max(dot(normalize(vDir), uSunDir), 0.0), 6.0);
        col += uGlowColor * sunGlow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), skyMat);
  scene.add(skyDome);

  const starGeo = new THREE.BufferGeometry();
  {
    const pts = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i++) {
      const az = Math.random() * Math.PI * 2;
      const el = Math.asin(Math.random() * 0.9 + 0.08);
      const r = 310;
      pts[i * 3] = Math.cos(el) * Math.cos(az) * r;
      pts[i * 3 + 1] = Math.sin(el) * r;
      pts[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  }
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe8ff, size: 1.6, transparent: true, opacity: 0, fog: false, sizeAttenuation: false,
  });
  skyDome.add(new THREE.Points(starGeo, starMat));

  const sun = new THREE.DirectionalLight(0xffe2b0, 3.4);
  sun.position.set(18, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0xd8c090, 1.25);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0xdfe9ef, 55, 150);

  let target = TIME_PRESETS.dusk;
  let nightFactor = 0;
  const state = {
    horizon: new THREE.Color().fromArray(TIME_PRESETS.dusk.horizon),
    mid: new THREE.Color().fromArray(TIME_PRESETS.dusk.mid),
    zenith: new THREE.Color().fromArray(TIME_PRESETS.dusk.zenith),
    glow: new THREE.Color().fromArray(TIME_PRESETS.dusk.glow),
    sunDir: new THREE.Vector3().fromArray(TIME_PRESETS.dusk.sunDir).normalize(),
    sunColor: new THREE.Color(TIME_PRESETS.dusk.sunColor),
    sunIntensity: 3.2,
    hemiSky: new THREE.Color(TIME_PRESETS.dusk.hemiSky),
    hemiGround: new THREE.Color(TIME_PRESETS.dusk.hemiGround),
    hemiIntensity: 1.25,
    fog: new THREE.Color(TIME_PRESETS.dusk.fog),
    exposure: 1.18,
  };
  // scratch colours, so the transition doesn't allocate every frame
  const tmpColor = new THREE.Color();
  const tmpVec = new THREE.Vector3();

  return {
    setTime(name: string): void {
      if (TIME_PRESETS[name]) target = TIME_PRESETS[name];
    },

    setShadowMapSize(size: number): void {
      if (sun.shadow.mapSize.width === size) return;
      sun.shadow.mapSize.set(size, size);
      // three only allocates the map once; drop it so the new size takes
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    },
    update(dt: number): number {
      const k = Math.min(1, dt * 1.6);
      state.horizon.lerp(tmpColor.fromArray(target.horizon), k);
      state.mid.lerp(tmpColor.fromArray(target.mid), k);
      state.zenith.lerp(tmpColor.fromArray(target.zenith), k);
      state.glow.lerp(tmpColor.fromArray(target.glow), k);
      state.sunDir.lerp(tmpVec.fromArray(target.sunDir).normalize(), k).normalize();
      state.sunColor.lerp(tmpColor.setHex(target.sunColor), k);
      state.sunIntensity += (target.sunIntensity - state.sunIntensity) * k;
      state.hemiSky.lerp(tmpColor.setHex(target.hemiSky), k);
      state.hemiGround.lerp(tmpColor.setHex(target.hemiGround), k);
      state.hemiIntensity += (target.hemiIntensity - state.hemiIntensity) * k;
      state.fog.lerp(tmpColor.setHex(target.fog), k);
      state.exposure += (target.exposure - state.exposure) * k;
      nightFactor += (target.night - nightFactor) * k;

      const u = skyMat.uniforms;
      (u.uHorizon.value as T.Color).copy(state.horizon);
      (u.uMid.value as T.Color).copy(state.mid);
      (u.uZenith.value as T.Color).copy(state.zenith);
      (u.uGlowColor.value as T.Color).copy(state.glow);
      (u.uSunDir.value as T.Vector3).copy(state.sunDir);
      sun.color.copy(state.sunColor);
      sun.intensity = state.sunIntensity;
      hemi.color.copy(state.hemiSky);
      hemi.groundColor.copy(state.hemiGround);
      hemi.intensity = state.hemiIntensity;
      (scene.fog as T.Fog).color.copy(state.fog);
      renderer.toneMappingExposure = state.exposure;
      starMat.opacity = nightFactor * 0.9;
      return nightFactor;
    },
    follow(camPos: T.Vector3, targetPos: T.Vector3): void {
      skyDome.position.copy(camPos);
      sun.position.set(targetPos.x + 18, 26, targetPos.z + 14);
      sun.target.position.copy(targetPos);
      sun.target.updateMatrixWorld();
    },
  };
}
