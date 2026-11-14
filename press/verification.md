# Verification: Docs Voice Guide v1 and SuperDispatch exemplar

## Verdict

**Publishable: true for handoff to Publish.** I found no unsupported factual claim and no required editorial correction in the pushed guide or exemplar. The canonical SuperDispatch card branch still resolves to corrected exemplar commit `0e9a928ba8b9081e7bf1fed781347463e8053a5d`.

Publish must still open the single draft forge PR, obtain Claude's review, provide a hosted rendered URL, and obtain the operator's bound `approved for rollout` record before any wider rollout.

## Revisions checked

- Docs Voice Guide v1: `SuperJackfruitLabs/sketchbook`, branch `card/card_8c73ff7b98b94f9a`, commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f`, `ideas/2026-11-14-docs-voice-guide-v1/README.md`.
- SuperDispatch exemplar: `SuperJackfruitLabs/superdispatch`, branch `card/card_8c73ff7b98b94f9a`, commit `0e9a928ba8b9081e7bf1fed781347463e8053a5d`, base `26b8d9023184fd37d530de518d625e0fdca4fec9`, `docs-site/src/content/docs/start/first-placement.mdx`.
- Approved specification: `sketchbook` main, `ideas/2026-11-14-docs-voice/README.md`.
- Combined review ledger: <https://app.superlibrary.dev/a/itm_c79d70101829478e>.

The sketchbook repository contains no `AGENTS.md` on either the card branch or `origin/main`; I verified the complete trees rather than assuming instructions existed. The approved specification in `ideas/2026-11-14-docs-voice/README.md` is present and was used as the source of truth.

## What I checked

### Guide, rubric, and source pairs

- Programmatic count, excluding YAML frontmatter and link-definition lines with `\b[\w’'-]+\b`: **1,003 words**, below the 1,500-word cap.
- Exactly three `Before` and three `After (illustrative)` sections are present.
- All ten editorial rules are present. The eight rubric rows and pass conditions match the approved specification.
- Each pair names a public URL, repository path, and full source commit:
  - SuperDispatch `26b8d9023184fd37d530de518d625e0fdca4fec9`;
  - SuperPipeline `cea7db42032e1a9ff2f1b3d942c6811c8a1a4639`;
  - Salaam `bbadd5a1c4bbacea74a4b95cb93623b56b6b91b8`.
- I fetched all three public pages and all three revision-pinned raw source files during this attempt. Every quoted before passage is present at its pinned revision, and the corresponding passage remains on the current public page.
- The SuperDispatch command placeholder is the six literal bytes for `$TOKEN` (`36,84,79,75,69,78`) in both the guide and exemplar. Some authenticated tool output masks a bearer placeholder as `***`; byte inspection and the public raw source confirm it is not a redacted runnable credential.

### Exemplar voice and scope

- The page has six numbered action-bearing steps and a continuing `we`/`you` narrator.
- Each step ends with a specific result or consequence: live API, opted-in board/window, placeable card, explainable choice, settled outcome, and disabled board with retained history.
- The only recurring comic premise is the broadcast booth. It is introduced in the opening, developed through the quiet opt-in and replay, and paid off once when the broadcast ends and SuperDispatch removes the headset.
- One-off humour appears only in narrative prose. Commands, literals, response bodies, tables, warnings, and recovery instructions remain literal.
- The product boundary holds throughout: SuperDispatch chooses and requests a temporary hold; the agent claims through SuperPipeline.
- There are four runnable operator commands using `$TOKEN` and `$BOARD`, zero `Payoff:` labels, and no redacted credential presented as runnable input.
- Diff from the recorded base changes only `docs-site/src/content/docs/start/first-placement.mdx`. Theme, quick starts, CSS, components, product code, CI, and generated reference material are untouched.

### Claim recheck against the PR base

I rechecked the tutorial's material commands and values against base code and tests: default port `8796`; `/healthz`; bearer auth and `401`; board `PUT`/`DELETE`; board response fields; decision query, newest-first order, fields, and limit; 30-second sweep; 10-second placement window; immediate `card.ready` placement; `idle-stage-success-lru@3`; minimum two candidates and `one-candidate`; filter reason codes; winner and runner-up tiers; 60/30-second defaults; five outcome statuses; opt-out behavior; and the advise/reserve-versus-claim boundary.

The repository's 333 tests exercise the relevant route, config, placement, loop, store, window, and source behavior. The generated-claims ratchet independently matched 31 settings, 15 reason codes, 6 no-decision reasons, 5 outcomes, and 6 kinds to code.

## Validation rerun

- `bun run check` — pass: formatting, TypeScript, lint baseline, **333 tests passed, 0 failed**.
- `npm run check:claims --prefix docs-site` — pass: 20 pages; 31 settings, 15 reason codes, 6 no-decision reasons, 5 outcomes, and 6 kinds match code.
- `npm run build --prefix docs-site` — pass: claims check repeated; **21 pages built**, including `/start/first-placement/`; Pagefind and sitemap completed.
- Structural assertions — pass: 6 numbered steps, 4 `$TOKEN` commands, 0 redacted command placeholders, and 0 `Payoff:` labels.
- `npm run check --prefix docs-site` — the known TS7016 declaration error for vendored `@superjackfruit/docs-theme/schema` remains. It is pre-existing: from base to exemplar, `docs-site/src/content.config.ts` and `docs-site/package-lock.json` have identical Git blob IDs, and the only changed file is the tutorial MDX. This voice pass does not own docs-theme 0.0.2.

## Changes made in this verification attempt

- No guide or exemplar correction was necessary.
- Refreshed this verification report with an independent attempt-14 audit, fresh public/source checks, fresh validation results, the missing-sketchbook-`AGENTS.md` finding, and explicit byte-level confirmation of the runnable `$TOKEN` placeholders.

## Remaining publication gates

1. Open exactly one **draft** SuperDispatch PR on the primary forge with the combined ledger updated to the final exemplar commit.
2. Record Claude's review and resolution of every finding in that ledger.
3. Provide a hosted rendered exemplar URL.
4. Obtain an operator record containing `approved for rollout` and binding that URL, exemplar commit `0e9a928ba8b9081e7bf1fed781347463e8053a5d`, and guide commit `29690e4397467bcf92ea7ef7e88b4e89cffba88f` before touching another product.
