// Every model the village needs, in one place, because two things need the
// list: the scene (to request them all in a single wave) and the page (to
// preload them, so the browser starts fetching at HTML-parse time instead of
// waiting for three.js to download, parse and run first).
export const HOUSE_MODELS = [
  'building-type-a',
  'building-type-c',
  'building-type-e',
  'building-type-g',
  'building-type-h',
  'building-type-j',
  'building-type-m',
  'building-type-q',
];

/** the woods round the village — trees and rocks from the Lowpoly Forest Pack */
export const FOREST_MODELS = [
  'forest-oak-a',
  'forest-oak-b',
  'forest-oak-c',
  'forest-oak-a-fall',
  'forest-oak-b-fall',
  'forest-oak-c-fall',
  'forest-spruce-a',
  'forest-spruce-b',
  'forest-spruce-c',
  'forest-dead-spruce',
  'forest-dead-oak',
  'forest-rock-big-a',
  'forest-rock-big-b',
  'forest-rock-a',
  'forest-rock-b',
  'forest-rock-c',
];

export const SCENERY_MODELS = [
  'driveway-short',
  'planter',
  'tree-large',
  'tree-small',
  'flower_purpleA',
  'flower_redA',
  'flower_yellowA',
  'plant_bush',
  'plant_bushLarge',
  'rock_smallA',
  'rock_smallC',
  'tree_default',
  'tree_detailed',
  'tree_oak',
  'tree_default_fall',
  'tree_detailed_fall',
  'tree_oak_fall',
  // the woods: Lowpoly Forest Pack, converted from FBX with each texture's flat colour baked in
  ...FOREST_MODELS,
];

/** the villagers — Kenney Blocky Characters, the ordinary ones */
export const NPC_MODELS = ['npc-a', 'npc-b', 'npc-e', 'npc-i', 'npc-k', 'npc-q'];

export const ALL_VILLAGE_MODELS = [
  ...HOUSE_MODELS,
  ...SCENERY_MODELS,
  'street-lamp',
  'offroad-car',
  ...NPC_MODELS,
  // KayKit City Builder road tiles (CC0)
  'kk-road-straight',
  'kk-road-corner-curved',
  'kk-road-tsplit',
  'kk-road-junction',
];

/**
 * Cache stamp for the models. They live at stable paths so they can be cached
 * hard (see public/_headers) — bump this whenever `npm run assets` regenerates
 * them, or returning visitors keep the old ones for a week.
 */
export const ASSET_VERSION = '2026-10-22a';

export const modelUrl = (name: string): string =>
  `/assets/village/${name}.glb?v=${ASSET_VERSION}`;
