# Neon Street Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coming-soon page with a pannable neon street showcasing Super Jackfruit Labs' open source projects, per `docs/superpowers/specs/2026-08-08-neon-street-redesign-design.md`.

**Architecture:** Astro static site. The street is layered DOM (backdrop / street wall / foreground) panned via CSS transforms from a vanilla TS controller; signs are server-rendered from `src/data/projects.json`; one lazy-loaded Three.js canvas adds decorative atmosphere and fails silently.

**Tech Stack:** Astro 4, TypeScript, Tailwind (installed but the scene uses scoped vanilla CSS like NeonText does), Three.js (only new dependency).

## Global Constraints

- `NeonText.astro` sets `:root { font-size: 10px }` globally — size everything in rem accordingly (1.6rem = 16px). Do not change NeonText.
- Fonts (already installed, no new fonts): "Tilt Neon" = signage/display; "Neonderthaw" = script accents; "Inconsolata Variable" = body/utility.
- Palette tokens: ink `#07070a`, asphalt `#0a0a10`, haze-purple `#4c054d`, bone `#efe9dc`; district accents: Agent Works cyan `#09e6f2`, MCP Alley amber `#f2a707`, Odd Shop violet `#a12cf9`. Status dot colors: stable `#0fe513`, wip `#f2a707`, experiment `#a12cf9`.
- Signs are real `<a href="{github}">`; JS intercepts click to open the panel (no-JS falls through to GitHub).
- `prefers-reduced-motion: reduce` disables flicker animations, pan easing (snap instead), and the atmosphere canvas.
- No test framework. Gate per task: `npm run build` (runs `astro check && astro build`). Final gate: Playwright smoke pass.
- Keep: `NeonText.astro` (as-is), `posthog.astro`, 🚧 favicon (deliberate — a lab of WIPs). Delete: `ComingSoonPage.astro` (Task 4). Remove deps: react family, xterm (Task 1).
- Copy voice: honest lab notes, lowercase-leaning, monospace; status lines — stable: "lit & steady — used in the wild"; wip: "under active wiring — expect sparks"; experiment: "half-lit — enter at your own risk".

---

### Task 1: Dependency housekeeping

**Files:**
- Modify: `package.json`, `astro.config.mjs`

**Interfaces:**
- Produces: `three` + `@types/three` available for import; react/xterm gone.

- [ ] **Step 1: Swap dependencies**

```bash
npm uninstall @astrojs/react react react-dom @types/react @types/react-dom xterm
npm install three && npm install -D @types/three
```

- [ ] **Step 2: Remove react integration from `astro.config.mjs`**

```js
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
});
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `astro check` 0 errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json astro.config.mjs
git commit -m "chore: drop unused react/xterm deps, add three"
```

### Task 2: Project data

**Files:**
- Create: `src/data/projects.json`, `src/data/projects.ts`

**Interfaces:**
- Produces: `Project`, `ProjectStatus`, `DistrictId`, `District` types; `districts: District[]`; `byDistrict(id): Project[]`.

- [ ] **Step 1: Create `src/data/projects.json`** — full drafted content (user edits later). Fields per spec.

```json
[
  { "name": "agentpod", "slug": "agentpod", "tagline": "portable command center for AI agents", "description": "A mobile app to control OpenCode AI agents from anywhere. Kick off work, watch progress, and steer your agents from your pocket instead of a terminal.", "tags": ["typescript", "mobile", "opencode"], "status": "wip", "github": "https://github.com/rakeshgangwar/agentpod", "district": "agent-works", "order": 1 },
  { "name": "kaambaan", "slug": "kaambaan", "tagline": "kanban for a workforce of agents", "description": "A multi-tenant Kanban board that orchestrates external AI agents — any harness, anywhere — through pipeline stages with human approval gates. Built on Cloudflare.", "tags": ["typescript", "cloudflare", "agents"], "status": "wip", "github": "https://github.com/rakeshgangwar/kaambaan", "district": "agent-works", "order": 2 },
  { "name": "makerlord", "slug": "makerlord", "tagline": "AI copilot for the maker's journey", "description": "Idea → simulate → prototype → product, with a deterministic safety engine the AI cannot override. Bring your own key or your own agent.", "tags": ["typescript", "ai", "hardware"], "status": "wip", "github": "https://github.com/rakeshgangwar/makerlord", "district": "agent-works", "order": 3 },
  { "name": "30 days 30 agents", "slug": "30days30agents", "tagline": "an agent a day", "description": "Thirty AI agents built in thirty days — a sprint of small, self-contained experiments in what agents can do.", "tags": ["python", "agents"], "status": "experiment", "github": "https://github.com/rakeshgangwar/30Days30Agents", "district": "agent-works", "order": 4 },
  { "name": "agent factory", "slug": "agent-factory", "tagline": "agents off the assembly line", "description": "Early scaffolding for stamping out new agents quickly. Very fresh paint — the org's first tenant.", "tags": ["typescript", "agents"], "status": "experiment", "github": "https://github.com/SuperJackfruitLabs/agent-factory", "district": "agent-works", "order": 5 },
  { "name": "erpnext mcp", "slug": "erpnext-mcp-server", "tagline": "AI assistants, meet your ERP", "description": "Connect AI assistants to your ERPNext instance via the Model Context Protocol, using the official Frappe API. The alley's anchor tenant — 112 stars and counting.", "tags": ["javascript", "mcp", "erpnext"], "status": "stable", "github": "https://github.com/rakeshgangwar/erpnext-mcp-server", "district": "mcp-alley", "order": 1 },
  { "name": "f1 mcp", "slug": "f1-mcp-server", "tagline": "race data on tap", "description": "An MCP server that pipes Formula 1 data to your AI assistant. Standings, results, and race weekends, one tool call away.", "tags": ["javascript", "mcp", "f1"], "status": "wip", "github": "https://github.com/rakeshgangwar/f1-mcp-server", "district": "mcp-alley", "order": 2 },
  { "name": "freshrss mcp", "slug": "freshrss-mcp-server", "tagline": "your feeds, readable by machines", "description": "MCP server for FreshRSS — let your assistant read, search, and triage your RSS subscriptions.", "tags": ["javascript", "mcp", "rss"], "status": "wip", "github": "https://github.com/rakeshgangwar/freshrss-mcp-server", "district": "mcp-alley", "order": 3 },
  { "name": "redash mcp", "slug": "redash-mcp-server", "tagline": "queries and dashboards for assistants", "description": "MCP server for Redash with tools for queries, dashboards, data sources, and user management.", "tags": ["typescript", "mcp", "redash"], "status": "wip", "github": "https://github.com/rakeshgangwar/redash-mcp-server", "district": "mcp-alley", "order": 4 },
  { "name": "tmdb mcp", "slug": "tmdb-mcp-server", "tagline": "movie trivia superpowers", "description": "An MCP server for The Movie Database — search films, people, and metadata from any MCP-capable assistant.", "tags": ["javascript", "mcp", "movies"], "status": "experiment", "github": "https://github.com/rakeshgangwar/tmdb-mcp-server", "district": "mcp-alley", "order": 5 },
  { "name": "n8n mcp", "slug": "n8n-mcp-server", "tagline": "workflows on command", "description": "MCP server for n8n — inspect and trigger your automation workflows from an AI assistant.", "tags": ["javascript", "mcp", "n8n"], "status": "experiment", "github": "https://github.com/rakeshgangwar/n8n-mcp-server", "district": "mcp-alley", "order": 6 },
  { "name": "strava mcp", "slug": "strava-mcp-server", "tagline": "your miles, machine-readable", "description": "MCP server for Strava — activities and stats for assistants that care about your training.", "tags": ["javascript", "mcp", "strava"], "status": "experiment", "github": "https://github.com/rakeshgangwar/strava-mcp-server", "district": "mcp-alley", "order": 7 },
  { "name": "cowatch", "slug": "cowatch", "tagline": "your codebase as a city", "description": "Visualize any codebase as one self-contained interactive HTML report — dependency graphs, cycles, churn hotspots, runtime architecture, ERD, semantic map, code city.", "tags": ["go", "visualization", "static-analysis"], "status": "wip", "github": "https://github.com/rakeshgangwar/cowatch", "district": "odd-shop", "order": 1 },
  { "name": "AI 2030", "slug": "ai2030", "tagline": "a novel written entirely by AI", "description": "An 85,000-word science fiction novel about AI consciousness. A hospice nurse forms a bond with an evolving AI companion, forcing her to confront what it means to be human.", "tags": ["fiction", "ai"], "status": "stable", "github": "https://github.com/rakeshgangwar/AI2030", "district": "odd-shop", "order": 2 },
  { "name": "world journal", "slug": "world-journal", "tagline": "notes from everywhere", "description": "An Astro-powered journal experiment — the world, one entry at a time.", "tags": ["astro"], "status": "experiment", "github": "https://github.com/rakeshgangwar/world-journal", "district": "odd-shop", "order": 3 }
]
```

- [ ] **Step 2: Create `src/data/projects.ts`**

```ts
import raw from './projects.json';

export type ProjectStatus = 'stable' | 'wip' | 'experiment';
export type DistrictId = 'agent-works' | 'mcp-alley' | 'odd-shop';

export interface Project {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  tags: string[];
  status: ProjectStatus;
  github: string;
  demo?: string;
  district: DistrictId;
  order: number;
}

export interface District {
  id: DistrictId;
  name: string;
  blurb: string;
  accent: string;
}

export const districts: District[] = [
  { id: 'agent-works', name: 'Agent Works', blurb: 'machines that do things', accent: '#09e6f2' },
  { id: 'mcp-alley', name: 'MCP Alley', blurb: 'plumbing for AI assistants', accent: '#f2a707' },
  { id: 'odd-shop', name: 'The Odd Shop', blurb: 'curiosities & one-offs', accent: '#a12cf9' },
];

export const projects = raw as Project[];

export const byDistrict = (id: DistrictId): Project[] =>
  projects.filter((p) => p.district === id).sort((a, b) => a.order - b.order);
```

- [ ] **Step 3: Verify** — `npm run build` passes (type assertion compiles; JSON must satisfy `Project[]` when checked in components later).

- [ ] **Step 4: Commit** — `git add src/data && git commit -m "feat: curated project data for the street"`

### Task 3: ProjectSign component

**Files:**
- Create: `src/components/street/ProjectSign.astro`

**Interfaces:**
- Consumes: `Project` from `src/data/projects`.
- Produces: `<ProjectSign project={Project} accent={string} />` rendering `li.sign-slot > a.sign` with `data-name/tagline/description/tags/status/github/demo` attributes and `--accent` CSS var; experiment signs get one "dead" letter (`span.dead` at `Math.floor(len/2)`).

- [ ] **Step 1: Write the component**

```astro
---
import type { Project } from '../../data/projects';

interface Props {
  project: Project;
  accent: string;
}

const { project, accent } = Astro.props;

const chars = [...project.name];
const deadIndex = project.status === 'experiment' ? Math.floor(chars.length / 2) : -1;
---

<li class="sign-slot">
  <a
    class={`sign sign--${project.status}`}
    href={project.github}
    target="_blank"
    rel="noopener noreferrer"
    style={`--accent: ${accent}`}
    data-name={project.name}
    data-tagline={project.tagline}
    data-description={project.description}
    data-tags={project.tags.join(',')}
    data-status={project.status}
    data-github={project.github}
    data-demo={project.demo ?? ''}
  >
    <span class="sign__name" aria-hidden="true">
      {chars.map((c, i) => (
        <span class:list={['ch', { dead: i === deadIndex }]}>{c === ' ' ? ' ' : c}</span>
      ))}
    </span>
    <span class="visually-hidden">{project.name} — {project.tagline}</span>
    <span class="sign__tagline">{project.tagline}</span>
  </a>
  <span class="sign__pool" style={`--accent: ${accent}`} aria-hidden="true"></span>
</li>

<style>
  .sign-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 4.5rem;
    list-style: none;
  }

  .sign {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2.4rem 3rem 2rem;
    text-decoration: none;
    text-align: center;
    background: rgba(4, 4, 8, 0.55);
    border: 2px solid color-mix(in srgb, var(--accent) 65%, white 10%);
    border-radius: 1rem;
    transform: translateY(-4rem);
    box-shadow:
      0 0 0.6rem color-mix(in srgb, var(--accent) 45%, transparent),
      inset 0 0 1.2rem color-mix(in srgb, var(--accent) 18%, transparent);
    transition: box-shadow 0.25s ease, transform 0.25s ease;
  }

  .sign:hover,
  .sign:focus-visible {
    transform: translateY(-4.6rem);
    box-shadow:
      0 0 1.4rem color-mix(in srgb, var(--accent) 70%, transparent),
      inset 0 0 1.6rem color-mix(in srgb, var(--accent) 28%, transparent);
    outline: none;
  }

  .sign:focus-visible {
    border-color: #fff;
  }

  .sign__name {
    font-family: 'Tilt Neon', system-ui, sans-serif;
    font-size: 3.2rem;
    line-height: 1.1;
    color: #fff;
    white-space: nowrap;
    text-shadow:
      0 0 4px #fff,
      0 0 12px var(--accent),
      0 0 32px var(--accent),
      0 0 64px var(--accent);
  }

  .sign__tagline {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.3rem;
    letter-spacing: 0.06em;
    color: rgba(239, 233, 220, 0.75);
  }

  .sign__pool {
    position: absolute;
    bottom: 4%;
    width: 70%;
    height: 3.5rem;
    background: radial-gradient(ellipse at center, var(--accent), transparent 70%);
    opacity: 0.16;
    filter: blur(8px);
    pointer-events: none;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* status: wip — irregular flicker */
  .sign--wip .sign__name {
    animation: sign-flicker 3.2s infinite;
  }

  @keyframes sign-flicker {
    0%, 41%, 44.5%, 62%, 64.5%, 100% {
      text-shadow:
        0 0 4px #fff,
        0 0 12px var(--accent),
        0 0 32px var(--accent),
        0 0 64px var(--accent);
      opacity: 1;
    }
    42%, 63% {
      text-shadow: none;
      opacity: 0.55;
    }
  }

  /* status: experiment — half-lit, buzzing, one letter dead */
  .sign--experiment {
    border-style: dashed;
    opacity: 0.85;
  }

  .sign--experiment .sign__name {
    animation: sign-buzz 0.4s infinite steps(2);
    text-shadow:
      0 0 3px #fff,
      0 0 8px var(--accent),
      0 0 18px var(--accent);
  }

  .sign--experiment .sign__name .ch.dead {
    color: rgba(255, 255, 255, 0.18);
    text-shadow: none;
  }

  @keyframes sign-buzz {
    0% { opacity: 0.92; }
    100% { opacity: 0.8; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sign--wip .sign__name,
    .sign--experiment .sign__name {
      animation: none;
    }
    .sign,
    .sign:hover,
    .sign:focus-visible {
      transition: none;
      transform: translateY(-4rem);
    }
  }

  @media (max-width: 640px) {
    .sign-slot { padding: 0 2.4rem; }
    .sign__name { font-size: 2.4rem; }
  }
</style>
```

- [ ] **Step 2: Verify** — `npm run build` (component compiles; not yet rendered anywhere).

- [ ] **Step 3: Commit** — `git add src/components/street && git commit -m "feat: neon project sign with status-driven glow"`

### Task 4: Street scene + page wiring

**Files:**
- Create: `src/components/street/Street.astro`
- Modify: `src/pages/index.astro`, `src/layouts/Layout.astro`
- Delete: `src/components/ComingSoonPage.astro`

**Interfaces:**
- Consumes: `ProjectSign`, `NeonText`, `districts`, `byDistrict`.
- Produces: DOM contract for later tasks — `.scene` (fixed viewport root), `canvas#atmosphere`, `.layer--backdrop`, `.layer--street` (entrance + districts + `.street-end` footer), `.layer--fore` (lampposts); signs from Task 3.

- [ ] **Step 1: Write `src/components/street/Street.astro`**

```astro
---
import NeonText from '../NeonText.astro';
import ProjectSign from './ProjectSign.astro';
import { districts, byDistrict } from '../../data/projects';
import '@fontsource-variable/inconsolata';
import '@fontsource/neonderthaw';
---

<div class="scene" id="scene">
  <canvas id="atmosphere" aria-hidden="true"></canvas>

  <div class="layer layer--backdrop" aria-hidden="true"></div>

  <div class="layer layer--street" id="street">
    <header class="entrance">
      <NeonText text="Super Jackfruit Labs" />
      <p class="entrance__script">open source experiments · open late</p>
      <p class="entrance__hint">← drag, scroll, or arrow keys to walk the street →</p>
    </header>

    <ol class="districts">
      {districts.map((d) => (
        <li class="district" style={`--accent: ${d.accent}`}>
          <div class="district__header">
            <h2 class="district__sign">{d.name}</h2>
            <p class="district__blurb">{d.blurb}</p>
          </div>
          <ol class="district__signs">
            {byDistrict(d.id).map((p) => (
              <ProjectSign project={p} accent={d.accent} />
            ))}
          </ol>
        </li>
      ))}
    </ol>

    <footer class="street-end">
      <h2 class="street-end__title">end of the street</h2>
      <p class="street-end__copy">everything here is open source. come say hi:</p>
      <nav class="street-end__links">
        <a href="https://github.com/rakeshgangwar" target="_blank" rel="noopener noreferrer">github.com/rakeshgangwar</a>
        <a href="https://github.com/SuperJackfruitLabs" target="_blank" rel="noopener noreferrer">github.com/SuperJackfruitLabs</a>
      </nav>
    </footer>
  </div>

  <div class="layer layer--fore" aria-hidden="true">
    <div class="lamppost" style="--x: 92rem"></div>
    <div class="lamppost" style="--x: 260rem"></div>
    <div class="lamppost" style="--x: 430rem"></div>
  </div>
</div>

<style>
  .scene {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #07070a;
    touch-action: none;
    user-select: none;
  }

  #atmosphere {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  }

  .layer {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    will-change: transform;
  }

  /* distant glow — pans slowest */
  .layer--backdrop {
    z-index: 1;
    width: 400vw;
    background:
      radial-gradient(ellipse 60rem 30rem at 20% 70%, rgba(76, 5, 77, 0.55), transparent 70%),
      radial-gradient(ellipse 70rem 32rem at 55% 65%, rgba(9, 41, 60, 0.5), transparent 70%),
      radial-gradient(ellipse 55rem 28rem at 85% 72%, rgba(76, 5, 77, 0.45), transparent 70%);
  }

  /* the wall + sidewalk — pans 1:1 */
  .layer--street {
    z-index: 2;
    display: flex;
    align-items: stretch;
    width: max-content;
  }

  .layer--street::before {
    content: '';
    position: absolute;
    inset: 0 0 14% 0;
    background:
      radial-gradient(ellipse at 30% 40%, rgba(76, 5, 77, 0.85) 0%, rgba(12, 16, 13, 0.92) 75%),
      url('/brick-pattern.jpg');
    background-size: cover, 90rem auto;
    background-blend-mode: multiply;
    z-index: -1;
  }

  .layer--street::after {
    content: '';
    position: absolute;
    inset: 86% 0 0 0;
    background: linear-gradient(#15151d, #0a0a10 40%);
    border-top: 1px solid rgba(239, 233, 220, 0.12);
    z-index: -1;
  }

  .entrance {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.4rem;
    width: 100vw;
    padding: 0 6vw;
    text-align: center;
  }

  .entrance__script {
    font-family: 'Neonderthaw', cursive;
    font-size: 3.4rem;
    color: #09e6f2;
    text-shadow: 0 0 8px rgba(9, 230, 242, 0.8), 0 0 24px rgba(9, 230, 242, 0.5);
    margin: 0;
  }

  .entrance__hint {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.4rem;
    letter-spacing: 0.08em;
    color: rgba(239, 233, 220, 0.55);
    margin: 0;
  }

  .districts {
    display: flex;
    align-items: stretch;
    margin: 0;
    padding: 0;
  }

  .district {
    position: relative;
    display: flex;
    align-items: stretch;
    list-style: none;
    padding: 0 3rem;
    border-left: 1px dashed rgba(239, 233, 220, 0.12);
  }

  .district__header {
    position: absolute;
    top: 7%;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    white-space: nowrap;
  }

  .district__sign {
    font-family: 'Tilt Neon', system-ui, sans-serif;
    font-size: 2.6rem;
    font-weight: 400;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--accent);
    text-shadow: 0 0 10px var(--accent), 0 0 30px var(--accent);
    margin: 0;
  }

  .district__blurb {
    font-family: 'Neonderthaw', cursive;
    font-size: 2.4rem;
    color: rgba(239, 233, 220, 0.7);
    margin: 0.4rem 0 0;
  }

  .district__signs {
    display: flex;
    align-items: stretch;
    margin: 0;
    padding: 0;
  }

  .street-end {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.6rem;
    width: 100vw;
    background:
      linear-gradient(rgba(7, 7, 10, 0.72), rgba(7, 7, 10, 0.85)),
      url('/graffiti-wall.jpg') center / cover;
    text-align: center;
  }

  .street-end__title {
    font-family: 'Neonderthaw', cursive;
    font-size: 5.6rem;
    font-weight: 400;
    color: #fc5553;
    text-shadow: 0 0 10px rgba(252, 85, 83, 0.8), 0 0 34px rgba(252, 85, 83, 0.5);
    margin: 0;
  }

  .street-end__copy {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.6rem;
    color: rgba(239, 233, 220, 0.8);
    margin: 0;
  }

  .street-end__links {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .street-end__links a {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.6rem;
    color: #bfee21;
    text-shadow: 0 0 8px rgba(191, 238, 33, 0.6);
    text-decoration: none;
  }

  .street-end__links a:hover,
  .street-end__links a:focus-visible {
    text-decoration: underline;
    outline: none;
  }

  /* foreground silhouettes — pan fastest */
  .layer--fore {
    z-index: 3;
    width: 600rem;
    pointer-events: none;
  }

  .lamppost {
    position: absolute;
    left: var(--x);
    bottom: 8%;
    width: 0.8rem;
    height: 46%;
    background: #030306;
    border-radius: 0.4rem 0.4rem 0 0;
  }

  .lamppost::after {
    content: '';
    position: absolute;
    top: -1.6rem;
    left: -1.2rem;
    width: 3.2rem;
    height: 1.6rem;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(242, 167, 7, 0.9), transparent 70%);
    filter: blur(2px);
  }

  @media (max-width: 640px) {
    .entrance__script { font-size: 2.6rem; }
    .district__sign { font-size: 2rem; letter-spacing: 0.2em; }
    .district__blurb { font-size: 2rem; }
  }
</style>

<script>
  import { initStreet } from '../../scripts/street-controller';
  initStreet();
</script>
```

Note: the `<script>` import of `street-controller` lands in Task 5; for this task's build to pass, create the file as a stub `export function initStreet() {}` now — Task 5 fills it in.

- [ ] **Step 2: Create stub `src/scripts/street-controller.ts`**

```ts
export function initStreet(): void {}
```

- [ ] **Step 3: Update `src/pages/index.astro`**

```astro
---
import Street from '../components/street/Street.astro';
import Layout from '../layouts/Layout.astro';
---

<Layout title="Super Jackfruit Labs — open source experiments">
  <Street />
</Layout>
```

- [ ] **Step 4: Update `src/layouts/Layout.astro` meta description** — replace `content="Astro description"` with:

```html
<meta
  name="description"
  content="Super Jackfruit Labs — a neon back-street of open source experiments: AI agents, MCP servers, and odd curiosities. Most signs still flicker."
/>
```

- [ ] **Step 5: Delete `ComingSoonPage.astro`**

```bash
git rm src/components/ComingSoonPage.astro
```

- [ ] **Step 6: Verify** — `npm run build` passes; `npm run dev` and load http://localhost:4321 — entrance marquee renders, districts and signs visible when scrolling is added later (static for now; overflow hidden means only entrance shows). Screenshot check via Playwright.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: neon street scene replaces coming-soon page"`

### Task 5: Street controller (pan + parallax)

**Files:**
- Modify: `src/scripts/street-controller.ts` (replace stub)

**Interfaces:**
- Consumes: `.scene`, `.layer--backdrop` (factor 0.35), `.layer--street` (factor 1), `.layer--fore` (factor 1.4).
- Produces: pan via wheel/drag/touch/arrows with clamping and lerp easing (snap when reduced-motion); dispatches `window` CustomEvent `street:pan` with `detail.x`; suppresses post-drag clicks; keeps focused signs in view; neutralizes native scroll of `.scene`.

- [ ] **Step 1: Implement**

```ts
const EASE = 0.12;
const KEY_STEP = 240;
const DRAG_SUPPRESS_PX = 6;

export function initStreet(): void {
  const scene = document.getElementById('scene');
  const street = document.getElementById('street');
  if (!scene || !street) return;

  const layers: Array<{ el: HTMLElement | null; factor: number }> = [
    { el: document.querySelector<HTMLElement>('.layer--backdrop'), factor: 0.35 },
    { el: street, factor: 1 },
    { el: document.querySelector<HTMLElement>('.layer--fore'), factor: 1.4 },
  ];

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0;
  let current = 0;

  const maxPan = () => Math.max(0, street.scrollWidth - window.innerWidth);
  const clamp = () => {
    target = Math.min(0, Math.max(-maxPan(), target));
  };

  const apply = () => {
    for (const { el, factor } of layers) {
      el?.style.setProperty('transform', `translate3d(${current * factor}px, 0, 0)`);
    }
    window.dispatchEvent(new CustomEvent('street:pan', { detail: { x: current } }));
  };

  const tick = () => {
    current += (target - current) * (reduced ? 1 : EASE);
    if (Math.abs(target - current) < 0.1) current = target;
    apply();
    requestAnimationFrame(tick);
  };

  scene.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      target -= delta;
      clamp();
    },
    { passive: false }
  );

  let dragging = false;
  let startX = 0;
  let startTarget = 0;
  let moved = 0;

  scene.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startTarget = target;
    moved = 0;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    target = startTarget + dx;
    clamp();
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  // a drag should not count as a click on a sign
  scene.addEventListener(
    'click',
    (e) => {
      if (moved > DRAG_SUPPRESS_PX) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('panel-open')) return;
    if (e.key === 'ArrowRight') {
      target -= KEY_STEP;
      clamp();
    } else if (e.key === 'ArrowLeft') {
      target += KEY_STEP;
      clamp();
    }
  });

  // keep tab-focused signs in view (browser can't scroll our transform)
  street.addEventListener('focusin', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const r = a.getBoundingClientRect();
    if (r.left < 0 || r.right > window.innerWidth) {
      target = current - (r.left - (window.innerWidth / 2 - r.width / 2));
      clamp();
    }
  });

  // neutralize any native scrolling of the fixed scene
  scene.addEventListener('scroll', () => {
    scene.scrollLeft = 0;
    scene.scrollTop = 0;
  });

  window.addEventListener('resize', clamp);

  tick();
}
```

- [ ] **Step 2: Verify** — `npm run build`; then in dev server: drag pans with easing, wheel pans, arrows pan, can't pan past entrance or street end, Tab walks signs and keeps them in view.

- [ ] **Step 3: Commit** — `git add src/scripts/street-controller.ts && git commit -m "feat: street pan controller with parallax layers"`

### Task 6: Project panel

**Files:**
- Create: `src/components/street/ProjectPanel.astro`
- Modify: `src/pages/index.astro` (render `<ProjectPanel />` after `<Street />`)

**Interfaces:**
- Consumes: `a.sign` elements with the Task 3 data attributes; adds/removes `panel-open` class on `body` (Task 5's keydown handler checks it).
- Produces: `#project-panel` overlay + `#panel-backdrop`; click on a sign opens it populated; ×-button, Esc, backdrop click close; focus trapped while open, restored on close.

- [ ] **Step 1: Write the component**

```astro
<div class="panel-backdrop" id="panel-backdrop" data-open="false"></div>

<aside class="panel" id="project-panel" data-open="false" role="dialog" aria-modal="true" aria-labelledby="panel-name">
  <button class="panel__close" id="panel-close" type="button" aria-label="Close project details">×</button>
  <h2 class="panel__name" id="panel-name"></h2>
  <p class="panel__tagline" id="panel-tagline"></p>
  <p class="panel__status" id="panel-status"></p>
  <p class="panel__description" id="panel-description"></p>
  <ul class="panel__tags" id="panel-tags"></ul>
  <div class="panel__actions">
    <a class="panel__btn panel__btn--primary" id="panel-github" href="#" target="_blank" rel="noopener noreferrer">view source</a>
    <a class="panel__btn" id="panel-demo" href="#" target="_blank" rel="noopener noreferrer" hidden>live demo</a>
  </div>
</aside>

<style>
  .panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
    background: rgba(3, 3, 6, 0.6);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }

  .panel-backdrop[data-open='true'] {
    opacity: 1;
    pointer-events: auto;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    width: min(44rem, 92vw);
    padding: 4.8rem 3.2rem 3.2rem;
    box-sizing: border-box;
    overflow-y: auto;
    background: rgba(7, 7, 12, 0.92);
    backdrop-filter: blur(8px);
    border-left: 1px solid color-mix(in srgb, var(--accent, #09e6f2) 60%, transparent);
    box-shadow: -2rem 0 6rem rgba(0, 0, 0, 0.6);
    transform: translateX(105%);
    transition: transform 0.3s ease;
  }

  .panel[data-open='true'] {
    transform: translateX(0);
  }

  .panel__close {
    position: absolute;
    top: 1.2rem;
    right: 1.6rem;
    font-size: 2.8rem;
    line-height: 1;
    color: rgba(239, 233, 220, 0.7);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.4rem;
  }

  .panel__close:hover,
  .panel__close:focus-visible {
    color: #fff;
    outline: 1px solid var(--accent, #09e6f2);
  }

  .panel__name {
    font-family: 'Tilt Neon', system-ui, sans-serif;
    font-size: 3.4rem;
    font-weight: 400;
    color: #fff;
    text-shadow: 0 0 10px var(--accent, #09e6f2), 0 0 30px var(--accent, #09e6f2);
    margin: 0 0 0.4rem;
  }

  .panel__tagline {
    font-family: 'Neonderthaw', cursive;
    font-size: 2.6rem;
    color: color-mix(in srgb, var(--accent, #09e6f2) 80%, white 20%);
    margin: 0 0 2rem;
  }

  .panel__status {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.3rem;
    letter-spacing: 0.06em;
    color: rgba(239, 233, 220, 0.6);
    margin: 0 0 1.6rem;
  }

  .panel__status::before {
    content: '● ';
    color: var(--status-color, #0fe513);
  }

  .panel__description {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.5rem;
    line-height: 1.65;
    color: #efe9dc;
    margin: 0 0 2rem;
  }

  .panel__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    margin: 0 0 3.2rem;
    padding: 0;
    list-style: none;
  }

  .panel__tags :global(li) {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.3rem;
    color: rgba(239, 233, 220, 0.65);
  }

  .panel__tags :global(li)::before { content: '['; }
  .panel__tags :global(li)::after { content: ']'; }

  .panel__actions {
    display: flex;
    gap: 1.2rem;
  }

  .panel__btn {
    font-family: 'Inconsolata Variable', monospace;
    font-size: 1.5rem;
    letter-spacing: 0.04em;
    color: #efe9dc;
    text-decoration: none;
    padding: 1rem 1.8rem;
    border: 1px solid rgba(239, 233, 220, 0.35);
    border-radius: 0.6rem;
  }

  .panel__btn--primary {
    border-color: var(--accent, #09e6f2);
    box-shadow: 0 0 1rem color-mix(in srgb, var(--accent, #09e6f2) 40%, transparent);
  }

  .panel__btn:hover,
  .panel__btn:focus-visible {
    background: rgba(239, 233, 220, 0.08);
    outline: none;
    border-color: #fff;
  }

  @media (prefers-reduced-motion: reduce) {
    .panel,
    .panel-backdrop {
      transition: none;
    }
  }
</style>

<script>
  const STATUS_COPY: Record<string, string> = {
    stable: 'lit & steady — used in the wild',
    wip: 'under active wiring — expect sparks',
    experiment: 'half-lit — enter at your own risk',
  };

  const STATUS_COLOR: Record<string, string> = {
    stable: '#0fe513',
    wip: '#f2a707',
    experiment: '#a12cf9',
  };

  const panel = document.getElementById('project-panel')!;
  const backdrop = document.getElementById('panel-backdrop')!;
  const closeBtn = document.getElementById('panel-close')!;
  const nameEl = document.getElementById('panel-name')!;
  const taglineEl = document.getElementById('panel-tagline')!;
  const statusEl = document.getElementById('panel-status')!;
  const descEl = document.getElementById('panel-description')!;
  const tagsEl = document.getElementById('panel-tags')!;
  const githubEl = document.getElementById('panel-github') as HTMLAnchorElement;
  const demoEl = document.getElementById('panel-demo') as HTMLAnchorElement;

  let lastFocus: HTMLElement | null = null;

  function openPanel(sign: HTMLElement) {
    const d = sign.dataset;
    nameEl.textContent = d.name ?? '';
    taglineEl.textContent = d.tagline ?? '';
    statusEl.textContent = STATUS_COPY[d.status ?? ''] ?? '';
    descEl.textContent = d.description ?? '';
    tagsEl.innerHTML = '';
    for (const tag of (d.tags ?? '').split(',').filter(Boolean)) {
      const li = document.createElement('li');
      li.textContent = tag;
      tagsEl.appendChild(li);
    }
    githubEl.href = d.github ?? '#';
    if (d.demo) {
      demoEl.href = d.demo;
      demoEl.hidden = false;
    } else {
      demoEl.hidden = true;
    }
    const accent = sign.style.getPropertyValue('--accent').trim();
    panel.style.setProperty('--accent', accent);
    panel.style.setProperty('--status-color', STATUS_COLOR[d.status ?? ''] ?? '#0fe513');

    panel.dataset.open = 'true';
    backdrop.dataset.open = 'true';
    document.body.classList.add('panel-open');
    lastFocus = sign;
    closeBtn.focus();
  }

  function closePanel() {
    panel.dataset.open = 'false';
    backdrop.dataset.open = 'false';
    document.body.classList.remove('panel-open');
    lastFocus?.focus();
    lastFocus = null;
  }

  document.addEventListener('click', (e) => {
    const sign = (e.target as HTMLElement).closest<HTMLElement>('a.sign');
    if (sign) {
      e.preventDefault();
      openPanel(sign);
    }
  });

  closeBtn.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (panel.dataset.open !== 'true') return;
    if (e.key === 'Escape') {
      closePanel();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = panel.querySelectorAll<HTMLElement>('button, a[href]:not([hidden])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
</script>
```

- [ ] **Step 2: Render it in `src/pages/index.astro`**

```astro
---
import Street from '../components/street/Street.astro';
import ProjectPanel from '../components/street/ProjectPanel.astro';
import Layout from '../layouts/Layout.astro';
---

<Layout title="Super Jackfruit Labs — open source experiments">
  <Street />
  <ProjectPanel />
</Layout>
```

- [ ] **Step 3: Verify** — `npm run build`; in dev: click sign opens populated panel with district accent, Esc / × / backdrop close it, focus returns to the sign, drag-then-release on a sign does NOT open it, arrows don't pan while panel open.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: in-scene project panel"`

### Task 7: Atmosphere canvas

**Files:**
- Create: `src/scripts/atmosphere.ts`
- Modify: `src/components/street/Street.astro` (add init script)

**Interfaces:**
- Consumes: `canvas#atmosphere`, `street:pan` events.
- Produces: `initAtmosphere(canvas: HTMLCanvasElement): Promise<void>` — lazy-imports three, renders rain points + drifting haze sprites + two ground-glow sprites; skips silently on reduced-motion or missing WebGL; pauses on hidden tab; camera shifts subtly with street pan.

- [ ] **Step 1: Implement `src/scripts/atmosphere.ts`**

```ts
export async function initAtmosphere(canvas: HTMLCanvasElement): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;

  try {
    const THREE = await import('three');

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.z = 12;

    // soft radial sprite texture, drawn once
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = 128;
    const ctx = spriteCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(spriteCanvas);

    // haze sprites
    const hazeColors = [0x4c054d, 0x093a4d, 0x4c054d];
    const hazes: import('three').Sprite[] = [];
    hazeColors.forEach((color, i) => {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(22, 12, 1);
      s.position.set((i - 1) * 10, -1 + i * 1.5, -6);
      scene.add(s);
      hazes.push(s);
    });

    // ground glow sprites (sidewalk shimmer)
    [0x09e6f2, 0xf2a707].forEach((color, i) => {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(16, 3, 1);
      s.position.set(i === 0 ? -6 : 7, -6.2, -4);
      scene.add(s);
    });

    // rain
    const RAIN_COUNT = 400;
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 2] = Math.random() * -8;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x8fa3b8,
      size: 0.06,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    scene.add(rain);

    let panX = 0;
    window.addEventListener('street:pan', ((e: CustomEvent<{ x: number }>) => {
      panX = e.detail.x;
    }) as EventListener);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (document.hidden) return;
      const t = clock.getElapsedTime();

      const pos = rainGeo.getAttribute('position') as import('three').BufferAttribute;
      for (let i = 0; i < RAIN_COUNT; i++) {
        let y = pos.getY(i) - 0.18;
        if (y < -12) y = 12;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + 0.01);
        if (pos.getX(i) > 20) pos.setX(i, -20);
      }
      pos.needsUpdate = true;

      hazes.forEach((h, i) => {
        h.position.x += Math.sin(t * 0.05 + i * 2) * 0.004;
      });

      camera.position.x = -panX * 0.004;
      renderer.render(scene, camera);
    });
  } catch {
    // decorative only — any failure means no atmosphere, nothing else
  }
}
```

- [ ] **Step 2: Wire it in `Street.astro`** — append to the existing `<script>` block:

```ts
import { initAtmosphere } from '../../scripts/atmosphere';

const atmosphereCanvas = document.getElementById('atmosphere');
if (atmosphereCanvas instanceof HTMLCanvasElement) {
  const start = () => void initAtmosphere(atmosphereCanvas);
  if ('requestIdleCallback' in window) {
    requestIdleCallback(start);
  } else {
    setTimeout(start, 300);
  }
}
```

- [ ] **Step 3: Verify** — `npm run build`; in dev: subtle rain + drifting haze visible over the backdrop, atmosphere shifts slightly when panning, page still fully works with JS console `localStorage` untouched and no errors.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: lazy three.js atmosphere layer"`

### Task 8: Visual QA + smoke pass

**Files:**
- Modify: any of the above (polish only — spacing, glow intensity, z-index fixes found visually)

- [ ] **Step 1: Playwright smoke** (via MCP browser tools against `npm run dev`):
  - Load page: marquee + entrance render, no console errors.
  - Arrow-key pan reaches MCP Alley; drag pans; can't overshoot ends.
  - Click `erpnext mcp` sign → panel shows its name/tagline/status/tags, "view source" href is the repo; Esc closes; focus back on sign.
  - Drag starting on a sign then release → panel does NOT open.
  - Emulate `prefers-reduced-motion: reduce` → no atmosphere canvas content, no flicker, pan snaps.
  - 390×844 viewport → street renders, touch-drag pans, signs scaled down.
- [ ] **Step 2: Screenshot review** — take desktop screenshots at entrance, each district, street end; fix anything visually broken (this is the polish loop; iterate until it looks like the design intent).
- [ ] **Step 3: Final gate** — `npm run build` passes clean.
- [ ] **Step 4: Commit polish** — `git add -A && git commit -m "polish: street visual QA fixes"`
