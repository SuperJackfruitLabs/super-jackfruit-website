# Claim verification: The contract was wrong, too

## Verdict

**Publishable: true.** No unresolved publication blockers.

I checked the article's factual claims against the public, immutable GitHub sources named in its front matter and inline links. The release states, quoted failure path, parser behavior, telemetry types, coercion behavior, regression cases, and chronology are supported by those sources.

## What I checked

### Treaty v0.0.19 and executable cases

- [Treaty v0.0.19](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.19) was published on 24 November 2026 and names the suite telemetry conventions and Matrix account link among the contracts added in that release. Its notes also describe telemetry conventions and URL shapes as new contract forms and identify the related commits.
- The pinned [SuperMessage callback cases](https://github.com/SuperJackfruitLabs/treaty/blob/14fc31e126c5274aaaa504084b1bf716355cc69d/fixtures/urls/supermessage-linked.v1.cases.json#L28-L32) include `supermessage://linked/done?...` as invalid because it has a path.

### SuperMessage callback parser

- [PR #190](https://github.com/SuperJackfruitLabs/supermessage/pull/190) is merged. Its public defect description says the production reader had checked only scheme and host and accepted the path-bearing callback before the fix.
- At commit [`0f191c3`](https://github.com/SuperJackfruitLabs/supermessage/commit/0f191c30f27ca2cd31e99194554cfa7129b067b3), [`linked_mxid`](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/account_link.rs#L122-L133) rejects a non-empty path, username, password, and more than one `mxid`.
- The pinned [contract-backed tests](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/treaty_urls.rs#L221-L240) send every valid callback and every invalid callback through the real `linked_mxid` reader.
- [SuperMessage v0.1.3](https://github.com/SuperJackfruitLabs/supermessage/releases/tag/v0.1.3) was published before the PR #190 change. The public releases index still ended at v0.1.3 at the research cutoff, and PR #190 explicitly records no version bump, tag, or upload. The article correctly says the change was merged but not in a numbered release.

### SuperWitness telemetry repair

- The pinned [Treaty telemetry schema](https://github.com/SuperJackfruitLabs/treaty/blob/f807549c5bebdfaf4437aa342c2b8e384616423c/schemas/telemetry/suite.v1.json#L37-L54) declares `acp.seq_from`, `acp.seq_to`, and `run.epoch` as `int`.
- [SuperWitness PR #103](https://github.com/SuperJackfruitLabs/superwitness/pull/103) and commit [`cee447d`](https://github.com/SuperJackfruitLabs/superwitness/commit/cee447d7d437fa6a711225c77c0e682e8f895645) state that VictoriaTraces' Jaeger-compatible API returned tags as strings and that SuperWitness had passed those strings through.
- The pinned [adapter](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/adapter.go#L264-L291) prefers explicit Jaeger scalar types, otherwise uses the vendored convention type for a known key, and leaves unknown or unparseable values unchanged.
- The pinned [tests](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/conventions_test.go#L122-L201) present convention values as store-shaped strings, require declared types to be recovered, and preserve unknown and unreadable values.
- [SuperWitness v0.0.14](https://github.com/SuperJackfruitLabs/superwitness/releases/tag/v0.0.14) explicitly includes the span-attribute type fix and describes the same fail-soft behavior.

### Optional stage `order` correction

- [Treaty v0.0.21](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.21) says v0.0.20's board-read and agent-work schemas required `order`, although SuperPipeline had never required it and stored stages as sent. It records the strict SuperDispatch refusal at `#/stages/0`, makes `order` optional, and adds producer-shaped cases.
- The [Treaty correction commit](https://github.com/SuperJackfruitLabs/treaty/commit/224fd74bc13dd8c476ff8c6247afa3128634c5a8) supports the contract-correction chronology and scope.
- The pinned [SuperDispatch regression test](https://github.com/SuperJackfruitLabs/superdispatch/blob/5b93df4f28c2e4d1121dfdb92540cdf59b721607/apps/dispatch/test/sources.test.ts#L412-L456) reads stages without `order` in array order and retains the earlier `contract_refused` context.
- [SuperDispatch v0.0.4](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.4) includes commit [`5b93df4`](https://github.com/SuperJackfruitLabs/superdispatch/commit/5b93df4f28c2e4d1121dfdb92540cdf59b721607), pins Treaty 0.0.21, and states that boards without stage `order` are read again.

## What I changed

- Narrowed one sentence from “Treaty v0.0.20 required every SuperPipeline stage” to “Treaty v0.0.20's board-read contract required every returned SuperPipeline stage.” This avoids implying that the producer itself or every possible stage representation required the field; the public release notes scope the defect to the board-read and agent-work contracts.
- No other factual corrections were necessary.

## Publication blockers

None.
