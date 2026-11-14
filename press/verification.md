# Verification: Docs Voice Guide v1 and SuperDispatch exemplar

## Verdict

**Publishable: true for handoff to Publish.** The revised exemplar meets the requested Full RedwoodJS voice, its material claims still match the SuperDispatch PR-base code, and the correction is now pushed on the required canonical branch at `0e9a928ba8b9081e7bf1fed781347463e8053a5d`.

The Publish stage must still open the single draft forge PR, obtain Claude's review, produce a hosted rendered URL, and obtain the operator's bound `approved for rollout` record before rollout.

## Revisions checked

- Docs Voice Guide v1: `SuperJackfruitLabs/sketchbook`, branch `card/card_8c73ff7b98b94f9a`, commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f`, `ideas/2026-11-14-docs-voice-guide-v1/README.md`.
- SuperDispatch corrected exemplar: `SuperJackfruitLabs/superdispatch`, branch `card/card_8c73ff7b98b94f9a`, commit `0e9a928ba8b9081e7bf1fed781347463e8053a5d`, base `26b8d9023184fd37d530de518d625e0fdca4fec9`, `docs-site/src/content/docs/start/first-placement.mdx`.
- The correction was applied from `press/0001-docs-bring-placement-tutorial-to-full-voice.patch`; the resulting canonical commit has the same patch as the verifier's local commit `537d72cfa54813c2c3b2b9a7249475e503e00bb5`.
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

## Validation rerun on the pushed corrected exemplar

- `bun run check` — pass: formatting, TypeScript, lint baseline, **333 tests passed, 0 failed**.
- `npm run check:claims --prefix docs-site` — pass: 20 pages; 31 settings, 15 reason codes, 6 no-decision reasons, 5 outcomes, and 6 kinds match code.
- `npm run build --prefix docs-site` — pass: claims check repeated; 21 pages built, including `/start/first-placement/`; Pagefind and sitemap completed.
- The known docs-theme 0.0.2 TS7016 declaration gap remains pre-existing and out of scope; this patch changes none of its inputs.

## Changes made

- Applied the portable correction patch to the canonical SuperDispatch card branch and pushed commit `0e9a928ba8b9081e7bf1fed781347463e8053a5d` over SSH.
- Verified the remote branch resolves to that exact commit.
- Reran the repository, claims, and docs-build checks against the pushed tree and updated this report with their real results.

## Remaining publication gates

1. Publish must open exactly one **draft** SuperDispatch PR on the primary forge with the updated combined ledger.
2. The ledger must record Claude's review and resolutions plus a hosted rendered exemplar URL.
3. An operator must record `approved for rollout` against that URL, exemplar commit `0e9a928ba8b9081e7bf1fed781347463e8053a5d`, and guide commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f`.
