# Verification: Docs Voice Guide v1 and SuperDispatch exemplar

## Verdict

**Publishable: true.** The guide and exemplar's material claims match their cited public pages and the SuperDispatch PR-base code. I found no factual correction to make in either deliverable. The Publish stage still must open the one draft forge PR, obtain Claude's review, produce a hosted rendered URL, and obtain the operator's bound `approved for rollout` record before rollout; those are workflow gates, not unresolved claim defects.

## Revisions checked

- Docs Voice Guide v1: `SuperJackfruitLabs/sketchbook`, branch `card/card_8c73ff7b98b94f9a`, commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f`, `ideas/2026-11-14-docs-voice-guide-v1/README.md`.
- SuperDispatch exemplar: `SuperJackfruitLabs/superdispatch`, branch `card/card_8c73ff7b98b94f9a`, commit `b2450e26dbb4303a3e6ae03074c0810cb5ff5b32`, base `26b8d9023184fd37d530de518d625e0fdca4fec9`, `docs-site/src/content/docs/start/first-placement.mdx`.
- Combined review ledger: <https://app.superlibrary.dev/a/itm_c79d70101829478e>.

## What I checked

### Guide and source pairs

- Compared the guide with the approved specification at `sketchbook` main, `ideas/2026-11-14-docs-voice/README.md`. The ten editorial rules are present and the eight rubric rows match the specification exactly.
- Counted **1,003 words** after removing YAML frontmatter and link-definition lines with the ledger's regex `\b[\w’'-]+\b`; the 1,500-word cap holds.
- Counted exactly three before/after pairs, pinned to full commits from three products.
- Matched each quoted “before” passage byte-for-byte, allowing only Markdown blockquote prefixes in the guide, against:
  - SuperDispatch `26b8d9023184fd37d530de518d625e0fdca4fec9`;
  - SuperPipeline `cea7db42032e1a9ff2f1b3d942c6811c8a1a4639`;
  - Salaam `bbadd5a1c4bbacea74a4b95cb93623b56b6b91b8`.
- Fetched all three public URLs. Each resolves and currently contains the quoted source passage. The SuperDispatch public page displays `$TOKEN` in its commands, consistent with the pinned source bytes.
- Confirmed the guide branch adds only the guide and its required index row. The repository has no `AGENTS.md` on the branch or `origin/main`; its `README.md` is the available convention and the guide follows its `ideas/YYYY-MM-DD-short-name/README.md` structure.

### Exemplar claims and scope

- Confirmed the SuperDispatch diff from its base changes only `docs-site/src/content/docs/start/first-placement.mdx`; no theme, quick-start, CSS, component, product-code, CI, or generated-reference file changed.
- Checked the tutorial's commands and literals directly against base code and tests: default port `8796`; `/healthz`; bearer auth and `401`; board `PUT`/`DELETE`; board response fields; decision query, order, fields, and limits; default 30-second sweep and 10-second placement window; immediate `card.ready` placement; `idle-stage-success-lru@3`; minimum two candidates and `one-candidate`; filter reason codes; winner and runner-up tiers; 60/30-second defaults; five outcome statuses; opt-out behavior; and the boundary that SuperDispatch requests a hold while the agent claims through SuperPipeline.
- Confirmed four shell commands use `$TOKEN` and `$BOARD`. The page has six numbered action steps and six source-level `**Payoff:**` paragraphs, one after each step.
- Confirmed one recurring comic premise only: the broadcast booth is introduced in the opening, recalled for the replay, and paid off after step 6 with the broadcast ending and the headset coming off. Commands, JSON, tables, warnings, and recovery text are literal and humour-free.
- Built output contains the six numbered headings, both tables, all tokenized commands, every payoff, and the final gag payoff. Repeated text in raw HTML comes from responsive/rendered copies; source-level counts are six steps and six payoffs.

## Validation rerun

- `bun install --frozen-lockfile` — pass.
- `bun run check` — pass: formatting, TypeScript, lint baseline, **333 tests passed, 0 failed**.
- `npm ci` in `docs-site/` — pass, 0 vulnerabilities.
- `npm run check:claims` — pass: 20 pages; 31 settings, 15 reason codes, 6 no-decision reasons, 5 outcomes, and 6 kinds match code.
- `npm run build` — pass: 21 pages built, including `/start/first-placement/`; Pagefind and sitemap completed.
- `npm run check` after temporarily making its undeclared checker dependency available — reproduces the ledger's pre-existing TS7016: vendored docs-theme 0.0.2 has no declaration for `@superjackfruit/docs-theme/schema`. A lockfile-only install otherwise prompts to install `@astrojs/check`, because that checker is not declared. The exemplar changes none of `src/content.config.ts`, `package.json`, `package-lock.json`, or the theme package, so it neither causes nor widens this separately owned gap.

## Changes made

No guide or exemplar prose required correction. This verification report is the only file added in the board target repository.

## Remaining publication gates

No factual publication blocker remains. Before publication or broader rollout, the Publish stage must:

1. open exactly one **draft** SuperDispatch PR on the primary forge with the combined ledger;
2. update the ledger to the final PR state and record Claude's review and resolutions;
3. record a hosted rendered exemplar URL; and
4. obtain an operator record containing `approved for rollout` bound to that URL, exemplar commit, and guide commit.
