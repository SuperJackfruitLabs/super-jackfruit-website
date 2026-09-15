# Website and village integration plan

Current plan · 2026-09-15 · proposed implementation

This repository owns readable public pages, navigation, catalogue accuracy,
accessibility, the existing Astro/Three.js village and web/game entry points.
The [city repository](https://github.com/SuperJackfruitLabs/super-jackfruit-world/blob/main/docs/README.md) owns simulation, native/client
evaluation, multiplayer, residency, avatars, game assets and services.
Marketing owns product claims and campaigns. Nothing in this migration ships
the proposed features or starts marketing.

Extracted from [marketing at 6556f6b](https://github.com/SuperJackfruitLabs/sjl-marketing/blob/6556f6b1cbc9c26c7d3ddb36a5b9efe43961ecb3/website/village/README.md).
The older files in `docs/superpowers/` remain historical design records; this
plan describes the current website responsibilities. The current game decisions
and city backlog live in [world docs](https://github.com/SuperJackfruitLabs/super-jackfruit-world/blob/main/docs/ROADMAP.md).

## Existing village and source map


Reviewed the live [village](https://superjackfruit.com/village), the local
`super-jackfruit-website` checkout, and the existing
[organization inventory](https://github.com/SuperJackfruitLabs/sjl-marketing/blob/main/foundation/repositories.md). The website
checkout was clean at `a7e02becc31291fb0cef41a30d9fb85d264aa08e` on `master`.
The product evidence ledger is dated 2026-09-13; this design pass is not a new
release audit of all product repositories.

| Area | Observed baseline | Consequence |
| --- | --- | --- |
| Stack | Astro 4 declaration, Three.js, TypeScript, Tailwind, postprocessing | Extend an existing 3D implementation rather than assuming a blank page |
| World | Low-poly car, branched roads, project buildings, three districts, village square | Preserve the charm; add destinations and activities |
| Controls | Keyboard driving worked live; source also includes touch and gamepad support | Touch/gamepad need dedicated device testing |
| Atmosphere | Live day/night and autumn switching worked; source includes birds, walkers, clouds, lights, smoke, audio | Much of the decorative foundation already exists |
| Discovery | Proximity cards, GitHub links, local project-visit count | Add a map, direct navigation, readable pages, and meaningful product next steps |
| Catalogue | 15 manual entries; current SuperMD and Supermessage absent; AgentPod copy describes its older mobile/OpenCode form | Correct evidence and ownership/status before expanding the exhibit |
| Accuracy gaps | Stale star/count copy, an archived/private project link, legacy summaries | Do not mechanically turn all current entries into active city businesses |
| Quality | Low/medium/high tiers, instanced props, Meshopt assets, automatic downgrade code | Useful base; validate raw frame-time monitoring and device budgets |
| Assets | 35 GLB files total about 670 KiB on disk, excluding audio/fonts/JS/textures outside them | This is asset-file size, not measured initial transfer or GPU cost |
| Navigation/content | Only root, village, and 404 page routes in reviewed source | Product/readable exhibit routes remain to be built |
| Failure handling | Initialization rejection logs to console; ready overlay lacks a complete recovery path | Provide a map/read fallback and retry state |
| Existing history | Older design docs describe an earlier 2.5D idea | Current source and live behaviour outrank that earlier plan |

Live inspection used an isolated Chrome session at a desktop viewport. HTTP
200, keyboard driving, environment toggles, an AgentPod card, and the village
square were checked; no page errors were observed in those sessions. The
built-in debug teleport was used to inspect the latter two destinations. The
visit count persisted from 1/15 after reload. This is not a full wayfinding,
accessibility, multiplayer, mobile, or performance test.

### Source map for implementation

Paths below are in the separate `SuperJackfruitLabs/super-jackfruit-website`
repository, locally at `/Users/rakeshgangwar/Projects/super-jackfruit-website`.

| File | Relevant responsibility |
| --- | --- |
| `src/pages/village.astro` | Overlay, controls, DOM panels, welcome/loading wiring |
| `src/scripts/village-scene.ts` | Scene composition, district placement, frame loop, interactions |
| `src/scripts/village/input.ts`, `car.ts`, `road.ts` | Existing driving and road mechanics |
| `src/scripts/village/props.ts` | GLB cache, matte materials, instancing, material compatibility |
| `src/scripts/village/quality.ts` | Device tier and automatic downgrade logic |
| `src/scripts/village/env.ts`, `ambient.ts`, `npcs.ts` | Atmosphere and decorative life |
| `src/data/projects.json`, `projects.ts` | Current catalogue and types |
| `src/data/village-models.ts` | Asset naming/loading manifest |
| `src/layouts/Layout.astro` | Shared full-viewport layout; document routes need a variant |
| `scripts/compress-assets.mjs` | Existing Meshopt pipeline, without geometry simplification |
| `public/_headers` | Known HTML-fallback/asset-cache incident and current mitigation |

For example, one current building is around 1.2k triangles and one material;
the car is around 6.7k triangles and eleven materials. A generated model with
hundreds of thousands of faces belongs in an offline cleanup workflow before
entering this scene. These sampled counts are not universal limits.


## Website routes and integration


Proposed routes, to be implemented in the website repository:

```text
/                         concise entrance: explore, map, products, latest note
/village                  interactive world, optional district/place URL state
/products/[slug]          readable product passport and verified next step
/lab/[slug]               dated field notes and explanations
/exhibits/[slug]          usable teaching controls and readable explanation
/build                    personal plot; shared-room entry when available
/home                     private resident home, grants, and save management
/residents/[id]           optional public projection of a resident's home
/city                    readable budget, service coverage, incidents and proposals
/places/[slug]           facility information, accessible activity entry and booking
/agents/[slug]           approved public role/status; authenticated extended view
/profile                 saved avatar, personality, voice and visibility choices
/archive                  dated earlier experiments
```

Keep the existing `/village` URL. Decide the root/neon-street transition with
redirects and preservation of useful old links. Rich world state can live in
a URL fragment; never put a reusable room credential in a public share URL.
Invitation links require scoped, expiring capabilities or a join flow.

The page should render its title, useful text, destinations, and primary action
before loading the world bundle. Give document routes a normal scrolling
layout; the current full-viewport layout is unsuitable for long guides. Add
canonical URLs, social metadata, a sitemap, and optionally
[Pagefind](https://pagefind.app/) for static search as content grows.


Native downloads and browser builds will be linked through versioned release
metadata once builds exist. Preserve the current village while D1 compares
Godot native/web with the existing browser client. Do not copy the simulation
rules or maintain a second editable city design here. A city outage must leave
public product pages useful. Shared product/place IDs form a versioned contract
with the city; website catalogue validation owns their initial creation.

## V0 — Establish the foundation


**Result:** visitors can find accurate product information even if 3D fails.

- [ ] Reconcile the catalogue against current public product sources. Correct
  legacy AgentPod copy; add the missing current products; remove or relabel
  private/broken/archived entries and unsupported counts.
- [ ] Create the validated product/place schema, stable IDs, and public/private
  content boundary. Keep draft and proposed content out of published facts.
- [ ] Add readable product routes and a map/directory with destination links.
- [ ] Recover from initialization failure, missing models, and WebGL loss;
  ensure useful content exists when JavaScript is disabled.
- [ ] Record real device/network performance; fix the clamped-delta quality
  measurement before trusting its downgrade decisions.
- [ ] Preserve the known asset-cache/fallback regression with a targeted check.

**Gate:** a visitor reaches the correct product/source from a normal page and
the map; the same task works without WebGL. Baseline performance and current
limitations are recorded rather than inferred.


## Website implementation tickets

| Ticket | Deliverable | Effort | Depends on | Evidence of completion |
| --- | --- | --- | --- | --- |
| VIL-01 | Product/source reconciliation | S–M | Fresh public-source check | Every public claim/link has a bounded evidence record |
| VIL-02 | Schema and stable place IDs | M | VIL-01 | Invalid records fail; existing destinations have migration/redirects |
| VIL-03 | Readable pages and map | M | VIL-02 | Keyboard/no-WebGL task succeeds |
| VIL-04 | Failure recovery and performance baseline | M | Existing village | Failed asset/context loss recover; device trace recorded |

These four IDs retain their identity after migration. All are still open.
The city roadmap links here for dependencies. Site features U01/U02/U04/U05/U08
in the [experience catalogue](https://github.com/SuperJackfruitLabs/super-jackfruit-world/blob/main/docs/EXPERIENCES.md) inform these pages;
gameplay and in-world presentations remain city-owned.

## Documentation boundary and validation

Keep this plan in `docs/`, outside `public/` and `src/pages/`. The inspected
Astro configuration has no custom docs publication path, and no source imports
or content glob for this directory were found. The migration changes Markdown
only. It does not change site code, dependencies, assets or deploy commands.
The website handoff is delivered on `docs/village-city-handoff` for review;
no production deployment is requested by this documentation migration.
