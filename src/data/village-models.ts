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
];

/** the villagers — Kenney Blocky Characters, the ordinary ones */
export const NPC_MODELS = ['npc-a', 'npc-b', 'npc-e', 'npc-i', 'npc-k', 'npc-q'];

export const ALL_VILLAGE_MODELS = [
  ...HOUSE_MODELS,
  ...SCENERY_MODELS,
  'street-lamp',
  'offroad-car',
  ...NPC_MODELS,
];

export const modelUrl = (name: string): string => `/assets/village/${name}.glb`;
