# Verification: Docs Voice Guide v1 and SuperDispatch exemplar

## Verdict

**Publishable: false.** The revised exemplar now meets the requested Full RedwoodJS voice and its material claims still match the SuperDispatch PR-base code, but I could not hand the correction over on the required canonical branch. The primary forge rejected both a fast-forward push to `card/card_8c73ff7b98b94f9a` and a new side branch because `analyst-echo` has no push permission in `SuperJackfruitLabs/superdispatch`.

The actionable clearing condition is: an authorized SuperDispatch writer applies `press/0001-docs-bring-placement-tutorial-to-full-voice.patch` to `card/card_8c73ff7b98b94f9a`, pushes it, and reruns the checks recorded below. The Publish stage must still open the single draft forge PR, obtain Claude's review, produce a hosted rendered URL, and obtain the operator's bound `approved for rollout` record before rollout.

## Revisions checked

- Docs Voice Guide v1: `SuperJackfruitLabs/sketchbook`, branch `card/card_8c73ff7b98b94f9a`, commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f`, `ideas/2026-11-14-docs-voice-guide-v1/README.md`.
- SuperDispatch remote exemplar before this correction: `SuperJackfruitLabs/superdispatch`, branch `card/card_8c73ff7b98b94f9a`, commit `b2450e26dbb4303a3e6ae03074c0810cb5ff5b32`, base `26b8d9023184fd37d530de518d625e0fdca4fec9`, `docs-site/src/content/docs/start/first-placement.mdx`.
- Corrected local exemplar commit: `537d72cfa54813c2c3b2b9a7249475e503e00bb5`. The portable one-commit patch is `press/0001-docs-bring-placement-tutorial-to-full-voice.patch` on this board branch.
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
- Fetched all three public URLs in the prior verification pass. Each resolved and contained the quoted source passage.

### Editorial correction

I kept the accepted facts and six-step structure, then applied every review finding:

- removed all six bold `Payoff:` labels and replaced them with natural, step-specific closing sentences;
- established a real `we`/`you` narrator in the opening and carried it through all six steps;
- added at least one narrative aside, nudge, or one-off joke per step while leaving commands, response bodies, tables, warnings, and recovery prose plain;
- developed only the broadcast-booth running gag: it is introduced in the opening, echoed by the quiet opt-in, recalled for the replay, and paid off by ending the broadcast and removing the headset; and
- retained four runnable commands using `$TOKEN`, with no redacted credential presented as runnable input.

The corrected source has six numbered steps, zero `Payoff:` labels, four tokenized operator commands, and one final gag payoff. The diff from the PR base still changes only `docs-site/src/content/docs/start/first-placement.mdx`; no theme, quick-start, CSS, component, product-code, CI, or generated-reference file changed.

### Claim recheck

The voice rewrite does not alter the tutorial's material claims. I rechecked the retained commands and literals against base code and tests: default port `8796`; `/healthz`; bearer auth and `401`; board `PUT`/`DELETE`; board response fields; decision query, order, fields, and limits; default 30-second sweep and 10-second placement window; immediate `card.ready` placement; `idle-stage-success-lru@3`; minimum two candidates and `one-candidate`; filter reason codes; winner and runner-up tiers; 60/30-second defaults; five outcome statuses; opt-out behavior; and the boundary that SuperDispatch requests a hold while the agent claims through SuperPipeline.

## Validation rerun on the corrected exemplar

- `bun run check` — pass: formatting, TypeScript, lint baseline, **333 tests passed, 0 failed**.
- `npm run check:claims --prefix docs-site` — pass: 20 pages; 31 settings, 15 reason codes, 6 no-decision reasons, 5 outcomes, and 6 kinds match code.
- `npm run build --prefix docs-site` — pass: claims check repeated; 21 pages built, including `/start/first-placement/`; Pagefind and sitemap completed.
- The known docs-theme 0.0.2 TS7016 declaration gap remains pre-existing and out of scope; this patch changes none of its inputs.

## Changes made

- Corrected `docs-site/src/content/docs/start/first-placement.mdx` locally in commit `537d72cfa54813c2c3b2b9a7249475e503e00bb5`.
- Added the portable patch `press/0001-docs-bring-placement-tutorial-to-full-voice.patch` because the forge refused this agent's SuperDispatch pushes.
- Updated this verification report with the editorial audit, claim recheck, real check results, and exact clearing condition.

## Remaining publication gates

1. An authorized writer must apply and push the patch to the canonical SuperDispatch card branch, then rerun the three passing checks.
2. Publish must open exactly one **draft** SuperDispatch PR on the primary forge with the updated combined ledger.
3. The ledger must record Claude's review and resolutions plus a hosted rendered exemplar URL.
4. An operator must record `approved for rollout` against that URL, the final exemplar commit, and guide commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f`.
