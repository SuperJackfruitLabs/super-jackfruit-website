# SuperJackfruit Labs website renewal — design

Date: 2026-10-20 · Repo: `super-jackfruit-website` · Status: draft for approval

## Intent

A visitor landing on superjackfruit.com should understand the **product suite** first: what each product does and how they fit together. Today's site is a neon-street catalogue of 14 older experiments. It's missing most of the suite, marks released products as "wip", ignores vibekit, and has an empty blog. The renewal covers design, content and structure at once.

## Goals

- Build the home page around the suite, shown as one task's journey (layout "B, redrawn", see mockup `.superpowers/brainstorm/*/content/home-flow-v3.html`):
  1. You talk: **Supermessage**
  2. Work is planned: **Superpipeline**
  3. An agent does it: **Salaam**
  4. Your fleet runs it: **AgentPod**
  5. It remembers: **Superlibrary**
  6. You see proof: **Superwitness**
- Under the flow: a line saying "Each works on its own. One sign-in across every product."
- A dashed **Coming** row for **Agentnagar** and **Captain Jack**, marked clearly as not yet available.
- Three visitor paths at the bottom of the home page:
  - Developer → try one: product pages.
  - Team → run the suite: `mailto:rakesh@superjackfruit.com`.
  - Follow → read the lab: Writing and RSS.
- One page per product. Each page is a single page with links out:
  - what it is
  - its step in the flow
  - three key features
  - current status and version
  - one call to action
  - links to the product's own site and docs (e.g. salaam.sh, docs.salaam.sh, docs.agentpod.dev)
- The site is built on **vibekit**. Daylight is the default and is sun-aware (dark at night). A small switcher offers Paper, Studio and Quiet, and the choice is remembered per visitor in localStorage.
- `/archive` lists the 14 old experiments in vibekit style. `/village` keeps working and is linked from the archive.
- Writing launches with 1–2 posts. Claude drafts a "the suite, explained" post and the operator edits it.

## Non-goals

- Accounts is **not** a product in the suite. It appears only as the "one sign-in" line.
- No full marketing landing page per product.
- No waitlist, hosted sign-up or backend.
- The parked "living town" 3D idea stays parked.

## Anti-goals

- Making any product look like it depends on the suite. Every product must work standalone.
- Making claims that aren't true today. Every status and version is checked against the product's releases and README before it ships.
- Using local names in copy ("guild", agent names). The product word is "workspace".
- Writing "salaam" in lowercase. It is always **Salaam**.

## Constraints

- Keep Astro (static), TypeScript and the existing Cloudflare Pages deploy (`deploy.yml` on push to `master`). Keep the RSS feed.
- Import vibekit from the forge, the same way the other products use it. Don't copy the tokens into the site.
- Mobile-first. No horizontal scroll at phone width.
- `src/data/projects.json` currently feeds the catalogue. It is split into suite data and archive data.

## Decided by the operator

- Home page is layout B with Salaam and AgentPod as separate steps.
- Accounts is left out of the lineup.
- The "coming" row holds Agentnagar and Captain Jack.
- Daylight is the default, with a vibe switcher.
- Product pages are one-pagers with links out.
- Old work goes to the archive, and the village is kept.
- Writing launches with posts.
- The team call to action is a contact email.

## Claude's calls (check these)

- One-line product descriptions: "chat with your agents", "boards for agent work", "the agent harness", "hosts & supervises agents", "knowledge agents can reach", "observability + evals".
- Navigation: Products · Writing · Archive.
- Accent colour: each product page uses that product's own accent from vibekit, and the home page uses the lab's accent.

## Facts from the repos (builder check)

- **How vibekit is consumed:** vibekit (`@superjackfruit/vibekit` 0.0.13) is a Svelte package. Products consume it as a vendored tarball (`file:./vendor/vibekit-0.0.x.tgz`), so CI needs no secrets. The site does the same.
  - Its CSS entry points are framework-neutral: `vibekit.css`, `tokens.css`, `accents.css` and `fonts.css`.
  - In Astro, use the CSS directly. Use Svelte islands (`@astrojs/svelte`) only where a vibekit component is worth it, such as the vibe switcher.
- **Sun-aware Daylight:** vibekit already provides it as `phase` (suncalc, `phaseAt` / `resolveTheme`, with a time-zone fallback and no location leaving the device). An inline script in `<head>` sets the theme and vibe before first paint, so there's no flash.
- **Accents:** vibekit has accents for Supermessage, Superpipeline, AgentPod, Superlibrary and Superwitness. It has **no Salaam accent and no lab accent**.
  - Claude's call: add a Salaam accent to vibekit (a small PR there first, then vendor the new tarball).
  - Claude's call: the home page uses each vibe's default accent.
- **Old URLs:** the old site only has `/`, `/village`, `/blog` and `/rss.xml`, with no per-project pages, so no redirects are needed. `/rss.xml` keeps its URL.
  - The village reads `src/data/projects.ts`, so the archive data must keep that shape, or the village gets adapted.

## More calls by Claude

- **Status and versions:** checked by hand against each product's latest release when `suite` data is written, with a "checked on" date stored per product. There's no build-time fetching.
  - Superwitness is labelled by what its README says today (v0.0.7).
- **Links out:** each page links to the product's own site or docs if one exists. Otherwise it links to the forge repo. Private repos get no repo link.
- **Copy:** Claude drafts all copy (features, status, launch post) and the operator reviews it in the PR. The launch post must be ready before the site ships.

## Left to the builder

Component structure, the route for product pages (`/products/<slug>`), how the vibe switcher looks, and the archive layout.
