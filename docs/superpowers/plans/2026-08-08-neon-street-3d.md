# Neon Street 3D Rebuild Plan

Supersedes the 2.5D DOM street (docs/superpowers/plans/2026-08-08-neon-street.md).
Reason: user verdict on v1 — too shallow vs the Bruno Simon reference, visually
unconvincing, and layout/panning defects in real Chromium viewports. Rebuilding
the scene as a true Three.js world; the 2.5D DOM street is removed.

**Kept:** `src/data/projects.(json|ts)`, `ProjectPanel.astro` (DOM overlay),
`NeonText.astro` (entrance overlay), Layout, posthog, palette/fonts/copy voice.

**Removed:** DOM street markup/CSS in `Street.astro`, `street-controller.ts`,
`atmosphere.ts` (folded into the scene).

## Scene design

- Corridor street along −z: brick walls (dark-tinted `brick-pattern.jpg`) at
  x = ±9, wet asphalt ground, `FogExp2(0x07070a, ~0.045)`, background same ink.
- Post-processing: EffectComposer + RenderPass + UnrealBloomPass
  (strength ~1.0, radius ~0.6, threshold ~0.2). Pixel ratio capped at 1.5.
- Signs: one emissive plane per project, canvas-textured (Tilt Neon name,
  Inconsolata tagline, accent border glow), alternating walls every ~13 units,
  angled slightly toward the street. Dead letter drawn dark for experiments.
- Status animation per frame: stable = steady; wip = irregular flicker
  (material color modulation); experiment = dim + high-frequency buzz jitter.
- Wet look: ground plane semi-transparent black; mirrored sign clones
  (scale.y = −1, opacity ~0.18) beneath it + additive accent glow pools.
- District gates: floating district-name planes over the street at each
  district start (canvas texture, accent color, Neonderthaw blurb).
- Street end: graffiti-wall.jpg end wall + two clickable neon link planes
  (github.com/rakeshgangwar, github.com/SuperJackfruitLabs).
- Rain: THREE.Points, subtle, reused from v1 approach.

## Interaction

- Move: wheel (down = forward), drag (up = forward), ArrowUp/W forward,
  ArrowDown/S back (Left/Right also mapped back/forward), touch drag.
  Eased camera z with clamped range; subtle lateral sway + mouse parallax.
- Hover: raycast → sign brightens, cursor pointer.
- Click (when not a drag): sign → CustomEvent `project:open` with project data
  → existing DOM panel (refactored to accept event detail instead of dataset).
  Link planes → window.open.
- Entrance: NeonText DOM overlay + hint, fades out with walk progress
  (scene dispatches `street3d:progress`).

## Fallback & a11y

- No WebGL or `prefers-reduced-motion: reduce` → hide canvas, show a styled
  semantic project list (name, tagline, status, tags, repo link) grouped by
  district. This list is always in the HTML (SEO/no-JS) and visually hidden
  when the scene runs.
- Esc closes panel; panel keeps focus trap. Canvas is focusable for keys.

## Files

- Rewrite: `src/components/street/Street.astro` — canvas, entrance overlay,
  hint, fallback list, init script.
- Create: `src/scripts/street-scene.ts` — whole scene (build, textures,
  movement, raycast, render loop, quality caps).
- Modify: `src/components/street/ProjectPanel.astro` — `project:open` event
  API; drop the `a.sign` click listener.
- Delete: `src/scripts/street-controller.ts`, `src/scripts/atmosphere.ts`.

## Verification (the part v1 got wrong)

- `npm run build` clean.
- Playwright at 1512×850, 1280×700, and 390×844: entrance renders, walk
  forward reaches districts and end wall, click opens correct panel, Esc
  closes, no console errors.
- Frame pacing: sample requestAnimationFrame deltas over 5s while moving at
  1512×850; require median ≥ 50fps in headless (proxy for real machines).
- Reduced-motion / WebGL-off → fallback list renders and links work.
- Screenshots reviewed at each viewport for composition, not just "renders".
