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
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (cores <= 2 || mem <= 2 || (coarse && (cores <= 4 || mem <= 3))) return 'low';
  // a touch device is a phone until it proves otherwise, however many cores it claims
  if (coarse || cores <= 4 || mem <= 4) return 'medium';
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
