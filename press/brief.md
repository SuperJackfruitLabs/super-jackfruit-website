# Brief: The contract was wrong, too

## Recommendation

Write the article.

Use the 24 November Treaty phase-three rollout to show a more useful lesson than “add schemas”: an executable cross-product contract has to catch **both implementation drift and contract drift**. In one release thread, the same shared cases exposed three different boundary failures:

1. a callback parser accepted URLs the contract rejected;
2. a trace store erased numeric types and the reader preserved the damage;
3. a strict consumer rejected real data because the newly written contract was stricter than the producer had ever been.

That sequence gives the article a real failure-driven narrative, not a hypothetical example. It also gives an outside developer a practical testing pattern: publish cases with the schema, run those cases through real producer and consumer code, and treat a red test as evidence about the implementation **or** the contract until the deployed behavior decides which one is wrong.

**Proposed headline:** **The contract was wrong, too**

**Alternative:** *Contract tests must be allowed to indict the contract*

**Confidence:** High. The failures, fixes, tests, merges and release states are all visible in public, immutable GitHub sources.

## The story, in order

### 1. A shared contract expanded beyond JSON response bodies

[Treaty v0.0.19](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.19), published 24 November 2026, moved several cross-product boundaries into one versioned contract set. The article should focus on two forms that are easy to overlook:

- the Matrix account-link flow as URL shapes and cases, introduced in the [account-link contract commit](https://github.com/SuperJackfruitLabs/treaty/commit/14fc31e126c5274aaaa504084b1bf716355cc69d);
- the suite’s telemetry keys and types, introduced in the [telemetry-conventions commit](https://github.com/SuperJackfruitLabs/treaty/commit/f807549c5bebdfaf4437aa342c2b8e384616423c).

The important design choice was not merely centralising schema files. The release also shipped accept/reject cases that downstream repositories could vendor and execute against their real code.

**Release status:** Both contract forms are in numbered release **Treaty v0.0.19**.

### 2. The URL cases found a parser that was too permissive

SuperMessage’s callback reader had checked the scheme and host, but the shared URL cases said the callback must have an empty path. The case corpus includes the rejected example [`supermessage://linked/done?...`](https://github.com/SuperJackfruitLabs/treaty/blob/14fc31e126c5274aaaa504084b1bf716355cc69d/fixtures/urls/supermessage-linked.v1.cases.json#L28-L32).

When those cases were run through the real parser, that example went red. The fix now rejects a non-empty path, user information, a password and a second `mxid` rather than silently extracting the first plausible value; see the [parser guards](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/account_link.rs#L122-L133). The accompanying test module states the stronger rule directly: every valid callback must parse and every invalid callback must be refused ([test contract](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/treaty_urls.rs#L3-L14), [real-reader tests](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/treaty_urls.rs#L221-L240)).

This is the first lesson: a URL is an interface, not “just a string”, and a contract test should exercise the production parser rather than a second parser written only for the test.

**Release status:** The [SuperMessage implementation commit](https://github.com/SuperJackfruitLabs/supermessage/commit/0f191c30f27ca2cd31e99194554cfa7129b067b3) is merged to the default branch through [PR #190](https://github.com/SuperJackfruitLabs/supermessage/pull/190). It landed after SuperMessage v0.1.3 and is **not in a numbered SuperMessage release** in the research window.

### 3. The telemetry cases found a storage/reader type mismatch

The telemetry contract says `run.epoch`, `acp.seq_from` and `acp.seq_to` are integers ([epoch type](https://github.com/SuperJackfruitLabs/treaty/blob/f807549c5bebdfaf4437aa342c2b8e384616423c/schemas/telemetry/suite.v1.json#L51-L54), [sequence types](https://github.com/SuperJackfruitLabs/treaty/blob/f807549c5bebdfaf4437aa342c2b8e384616423c/schemas/telemetry/suite.v1.json#L37-L45)). In practice, VictoriaTraces’ Jaeger-compatible API returned every span tag as a string. SuperWitness passed those strings through, so every `dispatch`, `attempt` and `turn` span failed the new conventions.

The fix makes the contract—not an ad hoc key list—the source of truth for coercion. Explicit Jaeger types win; otherwise a known convention key is coerced to its declared type; unknown or unreadable values remain as received so a bad attribute does not drop the span ([adapter logic](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/adapter.go#L264-L291)). Revert-proof tests send convention cases the way the real store does, all as strings, then require the served values to recover their contract types ([store-string test and rationale](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/conventions_test.go#L122-L177)). Separate tests preserve unknown and unparseable values rather than pretending coercion succeeded ([unreadable-value test](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/conventions_test.go#L178-L201)).

This is the second lesson: contracts can restore semantics lost by a transport or storage layer, but coercion must be bounded by named keys and must fail soft for observability data.

**Release status:** The [SuperWitness fix commit](https://github.com/SuperJackfruitLabs/superwitness/commit/cee447d7d437fa6a711225c77c0e682e8f895645) is merged to the default branch through [PR #103](https://github.com/SuperJackfruitLabs/superwitness/pull/103) and included in numbered release [SuperWitness v0.0.14](https://github.com/SuperJackfruitLabs/superwitness/releases/tag/v0.0.14).

### 4. Then the strict consumer proved the contract itself was wrong

The sharpest part of the story came after the first rollout. Treaty v0.0.20 required every SuperPipeline stage to have an `order`. SuperPipeline had never required that field and stored stages exactly as supplied. Real boards without `order` therefore remained valid producer output, but SuperDispatch’s strict placement read rejected them at `#/stages/0` and placed nothing.

The correction was to widen the contract, not weaken the consumer silently. The [Treaty correction commit](https://github.com/SuperJackfruitLabs/treaty/commit/224fd74bc13dd8c476ff8c6247afa3128634c5a8) made `order` optional and added producer-shaped cases. [Treaty v0.0.21](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.21) documents why: the contract was stricter than behavior that had always shipped. SuperDispatch then pinned the corrected version and added a regression test whose name records the real case—“a board whose stages have no order is read, in the order SuperPipeline sends them”—including the original `contract_refused` failure ([regression test](https://github.com/SuperJackfruitLabs/superdispatch/blob/5b93df4f28c2e4d1121dfdb92540cdf59b721607/apps/dispatch/test/sources.test.ts#L412-L456)).

This is the article’s turn: strict validation did its job even though the validator was “wrong”. It made an undocumented compatibility fact impossible to ignore. The right response was a versioned contract correction plus a regression case, not a consumer-side exception that would hide future drift.

**Release status:** The contract correction is in numbered release **Treaty v0.0.21**. The [SuperDispatch consumer fix](https://github.com/SuperJackfruitLabs/superdispatch/commit/5b93df4f28c2e4d1121dfdb92540cdf59b721607) is in numbered release [SuperDispatch v0.0.4](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.4).

## Suggested article structure

1. **Open on the failure, not the schema project.** A placement pass rejected a real board because the contract required a field the producer never required.
2. **Rewind to the rollout.** Explain the compact model: versioned shapes plus valid/invalid cases, vendored into each consumer.
3. **Show two implementation defects the cases caught.** The permissive callback parser and stringified telemetry integers demonstrate that contracts apply to URLs and observability data, not just JSON bodies.
4. **Return to the contract defect.** Explain why red contract tests do not automatically mean “fix the consumer”. Deployed producer behavior and compatibility policy determine whether implementation or contract must move.
5. **Extract the reusable pattern.** Test real producers and readers; ship cases with schemas; preserve unknown observability values; version corrections; remove temporary allowances once the contract matches reality.
6. **Close with the paradox.** A strict contract system is valuable not because its contracts are infallible, but because it makes disagreements executable, local and reviewable.

## Claims ledger

| Claim | Public evidence | Confidence |
|---|---|---|
| Treaty v0.0.19 added URL shapes and telemetry conventions with cases. | [v0.0.19 release](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.19), [URL commit](https://github.com/SuperJackfruitLabs/treaty/commit/14fc31e126c5274aaaa504084b1bf716355cc69d), [telemetry commit](https://github.com/SuperJackfruitLabs/treaty/commit/f807549c5bebdfaf4437aa342c2b8e384616423c) | High |
| SuperMessage accepted a callback path before the contract-backed fix. | [PR #190 defect and tests](https://github.com/SuperJackfruitLabs/supermessage/pull/190), [guard implementation](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/account_link.rs#L122-L133) | High |
| The trace store returned numeric attributes as strings and SuperWitness passed them through. | [PR #103 defect description](https://github.com/SuperJackfruitLabs/superwitness/pull/103), [contract-type recovery test](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/conventions_test.go#L122-L177) | High |
| SuperPipeline had never required stage `order`; Treaty v0.0.20 did, causing SuperDispatch to reject real boards. | [Treaty v0.0.21 release](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.21), [SuperDispatch regression test](https://github.com/SuperJackfruitLabs/superdispatch/blob/5b93df4f28c2e4d1121dfdb92540cdf59b721607/apps/dispatch/test/sources.test.ts#L412-L456) | High |
| The three fixes have different release states. | [SuperMessage merged commit](https://github.com/SuperJackfruitLabs/supermessage/commit/0f191c30f27ca2cd31e99194554cfa7129b067b3), [SuperWitness v0.0.14](https://github.com/SuperJackfruitLabs/superwitness/releases/tag/v0.0.14), [SuperDispatch v0.0.4](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.4) | High |

## Scope and survey methodology

Research window: **2026-11-18 04:30:18 UTC through 2026-11-25 04:30:18 UTC** (the seven days preceding this brief).

The survey began at the organisation level, not with a chosen pull request:

- checked all **15 public SuperJackfruitLabs repositories**;
- reviewed default-branch histories in the window, including paginated histories for repositories over 100 commits;
- reviewed the public merged-pull-request index: **64 merged PRs** with GitHub PR records (38 AgentPod, eight SuperLibrary, eight SuperWitness, six SuperMessage and four Salaam); forge-origin work visible on the GitHub mirror was reviewed through its mirror commits and releases;
- reviewed current changelogs for every active repository that has one;
- reviewed **27 numbered releases** in the window across AgentPod, SuperBench, SuperDispatch, SuperExchange, SuperLibrary, SuperMessage, SuperPipeline, SuperWitness and Treaty;
- checked the 13 article files already in the website repository and the public blog index.

Three public repositories—`.github`, `supermd` and `agentnagar`—showed no default-branch or numbered-release activity in the window. The website’s two commits were publication of already researched articles, not a new product-change thread.

## Related shipped work deliberately left out

- **SuperBench generations, reclaim and exact-source cloning; AgentPod’s bench/checkpoint lifecycle.** This was the largest operational thread in the window, but the 23 November article [“A name is not a generation”](https://superjackfruit.com/blog/a-name-is-not-a-generation/) already covers its central lesson. Reusing it would violate the “not yet on the blog” requirement.
- **SuperMessage release-asset completeness.** A concurrent unpublished article is already built around the concrete failure in which Android debug APKs were absent from v0.1.2. Do not collide with that thread.
- **Cancelled gates closing their chat cards** across AgentPod, SuperExchange and SuperMessage. This is a coherent cross-product fix and a viable future article, but it is a different causal chain from executable contract drift.
- **Release-kit CI lookup changes** copied across several products. These enabled release automation to find the correct successful main run, but the repeated kit sync is supporting release machinery rather than the strongest developer-facing failure story this week.
- **SuperPipeline’s page-composition and Console-vibe work.** Substantial and shipped, but it is a UI/design-system thread, not part of the contract rollout.
- **SuperToolkit’s empty approval-preview fix**, dependency updates and minor test hardening. Useful fixes, but each stands alone and offers less cross-product evidence than the selected thread.

## Blog-overlap and concurrent-topic check

The existing blog covers product introductions, durable sessions, AI review, permanent-vs-retryable failures, event-plus-sweep reconciliation, approval evidence, RPC-vs-semantic completion, release self-update, and bench generations. None covers executable cross-product contracts catching both consumer bugs and errors in the contract itself.

The only other open weekly article found during research concerns release artifacts as an explicit set rather than a filename glob. This brief intentionally selects a different thread.

## Guardrails for the writer

- Do not claim SuperMessage’s callback fix is released; it is merged to the default branch only.
- Do not say VictoriaTraces stored native integers incorrectly. The public evidence says its Jaeger-compatible API returned tags as strings; scope the claim to that read boundary.
- Do not frame optional `order` as SuperPipeline changing behavior. The evidence says SuperPipeline had never required it; the contract was corrected to match shipped behavior.
- Do not generalise the 64-PR count to every merge in every repository. It is the public GitHub merged-PR index; forge-origin work was surveyed from mirror commits and releases.
- Keep all citations on public GitHub mirror commits, files, pull requests and releases. Do not cite private planning or internal workflow records.
