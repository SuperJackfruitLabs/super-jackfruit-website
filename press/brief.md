# Brief: Docs voice pass, step 1

## Outcome

Produce the approved voice standard and prove it on one tutorial—nothing else. The result is:

1. **Docs Voice Guide v1**, no more than 1,500 words, committed under the private `SuperJackfruitLabs/sketchbook` repository's `ideas/` convention.
2. A from-scratch rewrite of SuperDispatch's **Your first placement** tutorial at `docs-site/src/content/docs/start/first-placement.mdx`.
3. **One draft pull request on the primary forge**, for the SuperDispatch exemplar, with a combined review ledger that identifies the exact guide and exemplar commits.

Do not touch another product's copy, quick starts, or presentation. The `@superjackfruit/docs-theme` package (currently vendored as 0.0.2 in SuperDispatch) and all theme/layout work are out of scope.

## Sources of truth and prerequisite

- Governing decision: planning card `card_472fbfd252aa455d`, `docs-voice-pass-spec-v2.md`, approved 2026-11-14.
- Read `sketchbook/AGENTS.md` before choosing the guide's exact `ideas/` path or writing there. Do not substitute Atelier.
- Read SuperDispatch's root `AGENTS.md` and `REVIEW.md` before editing.
- The research station could read SuperDispatch but was **not authorized to read sketchbook** through either GitHub or the primary forge. The implementation stage must establish sketchbook access and read the approved spec before drafting. If access is still absent, stop and block rather than inventing the rubric or publishing the guide elsewhere.

## Audience and editorial promise

The reader is a developer trying the product for the first time. “Full RedwoodJS voice” means an identifiable `we`/`you` narrator accompanies the reader through real work: warm, specific, lightly mischievous, and always subordinate to correctness. The reader should know what each action buys them immediately, not several headings later.

This is not a licence to decorate reference material. Commands, literal values, response bodies, tables, warnings, and recovery instructions remain plain and exact.

## Docs Voice Guide v1

Keep the guide operational and within 1,500 words, including its examples. It must contain the **exact approved rubric from the v2 spec**, not a reconstructed substitute. At minimum, make each rubric row scorable and evidence-based: narrator/presence, reader momentum, step payoff, clarity and accuracy, humour discipline, recovery/trust, and scanability. State what fails the bar as well as what passes it.

Include three compact, real before/after pairs. Quote the “before” text faithfully and identify its current public URL and source path/ref; label the rewritten text as an illustrative “after,” not shipped product copy. Use:

1. **Required:** SuperDispatch, *Your first placement* — `docs-site/src/content/docs/start/first-placement.mdx` and the published `/start/first-placement/` page.
2. **Recommended:** SuperPipeline, *Your first board* — `https://docs.superpipeline.dev/start/first-board/`, source `docs-site/src/content/docs/start/first-board.md`. The current page moves from sign-in through board, agent, card, and observation, making it suitable for demonstrating payoffs after procedural steps.
3. **Recommended:** Salaam, *Try it offline* / *Your first session* — `https://docs.salaam.sh/quickstart`, source `docs/quickstart.md`. At inspected commit `bbadd5a1c4bbacea74a4b95cb93623b56b6b91b8`, it starts a throwaway offline service and session, making it suitable for showing narrator, momentum, and a concrete no-cost payoff.

Refresh all three source texts immediately before quoting them. If the approved spec names different pages, the spec wins. Keep humour out of any quoted/revised command, value, warning, table, or recovery block.

## SuperDispatch exemplar

Rewrite the page from a blank outline rather than polishing its existing sentences. Preserve only facts, valid components, and necessary navigation.

### Required narrative shape

- Establish a `we`/`you` narrator in the opening and carry it through the tutorial.
- After **every numbered step**, give the reader an explicit, immediate payoff: what now works, what changed, or what they can now observe.
- Use **exactly one running gag**, introduced once, recalled sparingly, and paid off at the end. Record every occurrence in the ledger so “exactly one” is reviewable. One-off jokes and asides are allowed only in narrative prose and must not form a second recurring motif.
- No humour in shell commands, headers, IDs, literal values, JSON, tables, warnings, failure diagnosis, or recovery instructions.
- Keep recovery calm and literal. Never make the reader the joke.
- Preserve the product boundary: SuperDispatch advises and reserves; the agent claims through SuperPipeline. SuperDispatch never claims or hands out the card itself.

### Fact-check every command and value at the PR base

Do not trust the old tutorial merely because it builds. Record file/line evidence in the ledger for each command, route, response, default, field, enum, and policy name. The inspected SuperDispatch base was `26b8d9023184fd37d530de518d625e0fdca4fec9`; rebase is forbidden, so use the actual PR base and report its SHA.

The current page claims, among other things: port `8796`; `GET /healthz`; operator routes `PUT`/`DELETE /v1/boards/:boardId` and `GET /v1/decisions`; 30-second sweeps; a 10-second placement window; 60-second winner and 30-second runner-up reservations; policy `idle-stage-success-lru@3`; decision fields and outcome statuses. Verify each against the base code, especially:

- `apps/dispatch/src/config.ts`
- `apps/dispatch/src/routes/index.ts`
- `apps/dispatch/src/routes/operator.ts`
- `apps/dispatch/src/sources/superpipeline.ts`
- `apps/dispatch/src/placement/index.ts`
- decision/store schemas and route tests for response shapes and enums

Use `$TOKEN` or another documented shell variable consistently if the command is meant to be runnable; do not present `***` as a runnable credential value unless the prose explicitly marks it as a redacted transcript.

## Combined review ledger

Put the ledger in the single draft PR body or in one clearly linked file in that PR. It must include:

- guide path, guide commit SHA, and word count;
- exemplar path, exemplar commit SHA, and PR-base SHA;
- rubric score with evidence;
- a step-by-step payoff matrix;
- the single running gag and every occurrence, including its final payoff;
- humour audit confirming none appears in commands, values, tables, warnings, or recovery;
- command/value/response claim matrix with code evidence at the PR base;
- checks run and their real outputs;
- Claude review findings and how each was resolved or explicitly left open;
- rendered exemplar URL when available;
- placeholders for the operator's `approved for rollout` record against the rendered URL, exemplar commit, and guide commit.

## Verification and gate

Run SuperDispatch's repository checks required by `AGENTS.md` (`bun run check`). In `docs-site/`, install from its lockfile and run at least `npm run check`, `npm run check:claims`, and `npm run build` (the build already invokes the claims check). Preview the built page and inspect headings, code blocks, tables, callouts, links, and mobile-width wrapping. Count guide words programmatically and record the method.

Open the exemplar PR as **draft** on the primary forge, not GitHub. Request/await the repository's Claude review and update the combined ledger. Do not merge, mark rollout-ready, or alter another product before a person records the exact phrase **approved for rollout** against all three immutable identifiers:

1. rendered exemplar URL;
2. exemplar commit SHA;
3. guide commit SHA.

That operator record is the exit gate, not a favourable Claude review or a green build.

## Acceptance checklist

- [ ] Approved v2 spec and both repositories' instructions were read.
- [ ] Guide is in sketchbook `ideas/`, at most 1,500 words, and contains the approved rubric plus three sourced before/after pairs.
- [ ] SuperDispatch tutorial is a from-scratch Full RedwoodJS rewrite with narrator, payoff after every step, and exactly one fully paid-off running gag.
- [ ] Humour boundaries and product authority boundaries hold.
- [ ] Every command and value is checked against the actual PR base and evidenced in the ledger.
- [ ] Theme, styling, and quick starts are untouched.
- [ ] Exactly one draft forge PR exists, with the combined ledger and Claude review status.
- [ ] No broader rollout starts before the operator approval record binds the rendered URL and both commit SHAs.
