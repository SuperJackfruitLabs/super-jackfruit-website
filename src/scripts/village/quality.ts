// How much village this device can afford.
//
// The tier is guessed up front from what the browser will tell us, then
// verified against real frame times: if the guess was optimistic, the renderer
// drops a tier rather than letting the drive judder. It never upgrades — a
// scene that oscillates between settings is worse than one that is simply a
// little plainer.
export type Tier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: Tier;
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  /** scenery counts, fixed at build time — a downgrade can't undo these */
  bgTrees: number;
  bgRocks: number;
  flowerChance: number;
  lampLights: number;
  npcWalkers: number;
  npcIdlers: number;
  birds: number;
  /** how many houses have a fire going */
  chimneys: number;
}

export interface Quality {
  settings: QualitySettings;
  /** feed it every frame; fires once when the device proves it can't keep up */
  monitor(dt: number, onDowngrade: (s: QualitySettings) => void): void;
}

const TIERS: Record<Tier, Omit<QualitySettings, 'pixelRatio'>> = {
  high: { tier: 'high', shadows: true, shadowMapSize: 2048, bgTrees: 150, bgRocks: 50, flowerChance: 0.5, lampLights: 5, npcWalkers: 8, npcIdlers: 6, birds: 14, chimneys: 7 },
  medium: { tier: 'medium', shadows: true, shadowMapSize: 1024, bgTrees: 90, bgRocks: 30, flowerChance: 0.35, lampLights: 4, npcWalkers: 5, npcIdlers: 4, birds: 8, chimneys: 4 },
  low: { tier: 'low', shadows: false, shadowMapSize: 512, bgTrees: 45, bgRocks: 15, flowerChance: 0.2, lampLights: 2, npcWalkers: 3, npcIdlers: 2, birds: 0, chimneys: 2 },
};

const PIXEL_RATIO_CAP: Record<Tier, number> = { high: 2, medium: 1.5, low: 1 };

/** frame time we refuse to sit below, in seconds (~30fps) */
const BUDGET = 1 / 30;
const SAMPLE_WINDOW = 2.5;
const WARMUP = 2.5;

function build(tier: Tier): QualitySettings {
  return {
    ...TIERS[tier],
    pixelRatio: Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP[tier]),
  };
}

function guessTier(): Tier {
  // ?tier=low pins a tier, for checking how the village looks on a weaker device
  const forced = new URLSearchParams(window.location.search).get('tier');
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced;

  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  // Both of these are optional: navigator.deviceMemory is Chromium-only, so on
  // Safari and Firefox it is simply absent. Absence is NOT evidence of a weak
  // machine — reading it as one is what used to drop every Safari and Firefox
  // desktop to medium.
  const cores = navigator.hardwareConcurrency;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const weak = (v: number | undefined, limit: number) => v !== undefined && v <= limit;

  // A touch device is phone-class until it proves otherwise: the ceiling there
  // is thermal, and a phone that claims eight cores still cannot hold them.
  if (coarse) return weak(cores, 4) || weak(mem, 3) ? 'low' : 'medium';

  // Desktop starts at high and steps down only on hard evidence. Guessing
  // optimistically is safe because the frame-time monitor is the real check —
  // if the machine can't hold it, it drops a tier within a few seconds.
  if (weak(cores, 2) || weak(mem, 2)) return 'low';
  if (weak(cores, 4) && weak(mem, 4)) return 'medium';
  return 'high';
}

export function createQuality(): Quality {
  let settings = build(guessTier());
  let elapsed = 0;
  let windowTime = 0;
  let frames = 0;
  let done = settings.tier === 'low';

  return {
    get settings() {
      return settings;
    },
    monitor(dt, onDowngrade): void {
      if (done) return;
      elapsed += dt;
      if (elapsed < WARMUP) return; // ignore shader compiles and the first uploads

      windowTime += dt;
      frames++;
      if (windowTime < SAMPLE_WINDOW) return;

      const avg = windowTime / frames;
      windowTime = 0;
      frames = 0;
      if (avg <= BUDGET) return;

      const next: Tier = settings.tier === 'high' ? 'medium' : 'low';
      settings = build(next);
      done = next === 'low';
      onDowngrade(settings);
    },
  };
}
