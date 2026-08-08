# Super Jackfruit Labs — Neon Street Redesign

**Date:** 2026-08-08
**Status:** Approved by Rakesh (design conversation, 2026-08-08)

## Purpose

Replace the current single "Coming Soon" page with an interactive showcase of
Super Jackfruit Labs' open source projects. The site should feel like an
explorable place (inspired by Bruno Simon's portfolio) rather than a portfolio
grid, while staying fast, accessible, and cheap to maintain. The existing
`NeonText` component is kept as the lab's identity anchor.

## Concept & Experience

A horizontal neon street the visitor pans along using drag, touch swipe,
arrow keys, or scroll.

- **Entrance:** the existing `NeonText` marquee ("Super Jackfruit Labs")
  hangs at the street entrance, kept as-is including its flicker animation
  and spacebar/touch color shuffle.
- **Project signs:** each project is a neon storefront sign along the street.
  Project status maps to sign condition:
  - `stable` — steady glow.
  - `wip` — gentle flicker.
  - `experiment` — dim, buzzing, half-lit sign.
- **Project panel:** clicking/tapping a sign slides in an in-scene overlay
  panel showing: project name, tagline, description, tech tags, an honest
  status note, and buttons for the GitHub repo and (when present) live demo.
  Esc or a close button dismisses it. GitHub links open in a new tab.
- **Street end:** a graffiti-style footer wall with links to the GitHub
  profile (`rakeshgangwar`) and org (`SuperJackfruitLabs`).

## Content Model

Hand-curated data file: `src/data/projects.json`. One entry per project:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name on the sign |
| `slug` | string | Stable id |
| `tagline` | string | One-liner shown in panel header |
| `description` | string | 2–4 sentences, editorialized |
| `tags` | string[] | Tech/topic tags |
| `status` | `"stable" \| "wip" \| "experiment"` | Drives sign condition |
| `github` | string (URL) | Repo link |
| `demo` | string (URL), optional | Live demo if any |
| `district` | `"agent-works" \| "mcp-alley" \| "odd-shop"` | Street section |
| `order` | number | Position within district |

Initial content is drafted from Rakesh's public GitHub and then edited by
hand. Most projects are works-in-progress at varying stages; the copy and
status field should reflect that honestly. Launch districts:

- **Agent Works** — agentpod, kaambaan, makerlord, 30Days30Agents,
  agent-factory.
- **MCP Alley** — erpnext-mcp-server (112★, anchor tenant), f1-mcp-server,
  freshrss-mcp-server, tmdb-mcp-server, redash-mcp-server, n8n-mcp-server,
  strava-mcp-server.
- **The Odd Shop** — cowatch, AI2030, world-journal.

Each district gets an overhead district sign on the street. Adding a project
later means adding one JSON entry.

## Architecture

Astro 4 static site (unchanged foundation). Components:

- `src/pages/index.astro` — renders the street page.
- `src/components/NeonText.astro` — kept as-is (marquee).
- `src/components/street/Street.astro` — semantic container: districts and
  sign list rendered from `projects.json` at build time (real HTML, real
  links — crawlable without JS).
- `src/components/street/ProjectSign.astro` — one neon sign; status class
  drives the CSS animation variant. Sign glow uses the same
  text-shadow/box-shadow technique as `NeonText`.
- `src/components/street/ProjectPanel.astro` — the overlay panel, populated
  from data attributes on the clicked sign.
- Street controller — small vanilla TypeScript inline script (same pattern
  as NeonText's script): translates layered elements (backdrop, signs,
  sidewalk) at different speeds for the 2.5D parallax effect; handles drag,
  touch, wheel, and arrow keys; clamps to street bounds.
- **Atmosphere canvas** — one full-viewport Three.js canvas behind the DOM
  street: drifting haze, sparse rain, faint ground shimmer echoing the sign
  colors. Purely decorative: lazy-loaded, and if WebGL is unavailable or
  fails, it renders nothing and the site remains fully functional.

The React integration (`@astrojs/react`, react, react-dom, @types/react*) is
removed — nothing uses it. `xterm` is also removed as unused. Three.js is
added as the only new dependency.

## Accessibility, SEO, Performance

- Signs are real `<a href="{github}">` elements in a semantic list; with JS
  enabled the click is intercepted to open the in-scene panel instead, so
  no-JS visitors and crawlers still get a working repo link. Tab moves
  between signs, arrow keys pan, Esc closes the panel. The panel is focus-
  trapped while open and returns focus on close.
- `prefers-reduced-motion` disables flicker animations, parallax easing, and
  the atmosphere canvas entirely.
- Mobile: touch-drag panning, scaled-down sign sizes (existing NeonText
  media-query pattern).
- All project content is in the static HTML (SEO); proper `<title>` and meta
  description replace the current placeholder ("Astro description").
- Three.js is lazy-loaded after first paint; target: street interactive
  without waiting on WebGL.
- PostHog analytics stays as-is.

## Error Handling

- Atmosphere canvas: feature-detect WebGL; any initialization failure is
  caught and the canvas is skipped silently.
- Panel open/close is plain DOM state; no network requests at runtime, so no
  runtime data errors exist. Bad/missing optional fields (`demo`) simply
  omit the button.
- Build fails loudly on malformed `projects.json` via a type assertion in
  the street components (`astro check` gate).

## Testing & Verification

- `astro check && astro build` must pass (existing build gate).
- Playwright smoke pass before calling it done: street pans via drag and
  arrow keys, sign click opens the correct panel, Esc closes it,
  reduced-motion mode shows a static street, mobile viewport (390px)
  renders and pans.
- No test framework is added.

## Out of Scope

- Full 3D/physics world (Bruno Simon-style driving) — revisit later if ever.
- Per-project detail pages, blog/writeups.
- GitHub API enrichment (stars, last-updated) — data file is fully manual.
- CMS or admin UI.
