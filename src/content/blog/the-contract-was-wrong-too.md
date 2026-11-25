---
title: The contract was wrong, too
description: Executable contracts should catch implementation drift—and be allowed to reveal when the contract itself is stricter than shipped behavior.
date: 2026-11-25
draft: false
tags: [engineering, testing, reliability]
sources:
  - claim: Treaty v0.0.19 published account-link URL shapes and telemetry conventions alongside cases that consumers could execute.
    url: https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.19
  - claim: The Treaty account-link cases reject a SuperMessage callback with a non-empty path.
    url: https://github.com/SuperJackfruitLabs/treaty/blob/14fc31e126c5274aaaa504084b1bf716355cc69d/fixtures/urls/supermessage-linked.v1.cases.json#L28-L32
  - claim: SuperMessage's account-link reader now rejects non-empty paths, user information, passwords and duplicate mxid parameters.
    url: https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/account_link.rs#L122-L133
  - claim: SuperMessage runs the shared URL cases through its real callback reader, requiring valid cases to parse and invalid cases to be refused.
    url: https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/treaty_urls.rs#L221-L240
  - claim: The SuperMessage callback change was merged through PR #190.
    url: https://github.com/SuperJackfruitLabs/supermessage/pull/190
  - claim: Treaty declares run.epoch, acp.seq_from and acp.seq_to as integer-valued telemetry attributes.
    url: https://github.com/SuperJackfruitLabs/treaty/blob/f807549c5bebdfaf4437aa342c2b8e384616423c/schemas/telemetry/suite.v1.json#L37-L54
  - claim: SuperWitness recovers declared types for known convention keys read as strings, while preserving unknown and unreadable values.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/adapter.go#L264-L291
  - claim: SuperWitness tests the convention cases as store-shaped string values and requires the served attributes to regain their declared types.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/conventions_test.go#L122-L201
  - claim: The telemetry-convention repair shipped in SuperWitness v0.0.14.
    url: https://github.com/SuperJackfruitLabs/superwitness/releases/tag/v0.0.14
  - claim: Treaty v0.0.21 made SuperPipeline stage order optional because the previous contract was stricter than behavior that had always shipped.
    url: https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.21
  - claim: SuperDispatch's regression test accepts a producer-shaped board whose stages omit order and records the earlier contract_refused failure.
    url: https://github.com/SuperJackfruitLabs/superdispatch/blob/5b93df4f28c2e4d1121dfdb92540cdf59b721607/apps/dispatch/test/sources.test.ts#L412-L456
  - claim: The corrected contract consumer shipped in SuperDispatch v0.0.4.
    url: https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.4
---

A placement pass received a real board and placed nothing. The consumer had validated its input exactly as instructed: every stage needed an `order`, and the first stage did not have one.

The surprising part was not that validation failed. The surprising part was that the input was valid.

SuperPipeline had never required stage authors to provide `order`. It stored stages as supplied, so boards without the field were ordinary producer output. The newly written shared contract was stricter than the behavior it was meant to describe.

That failure completed a useful sequence. In the same cross-product contract rollout, shared cases had already found a callback parser that accepted too much and a trace reader that preserved too little type information. Then strict validation found a third defect: this time, in the contract.

The lesson is more useful than “write schemas.” **An executable contract has to be able to indict either side of the boundary—including itself.**

## Cases make a contract executable

[Treaty v0.0.19](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.19) moved several suite boundaries into a shared, versioned contract set. Two of them show why a schema file alone is not enough.

The first was the Matrix account-link flow used by SuperMessage. Its boundary is a URL: a custom scheme, an expected host, an empty path and a constrained query string. The second was telemetry. Its boundary is a collection of span attributes whose names and types need to survive a trip through storage and back.

Neither looks like the familiar “validate this JSON response body” example. Yet both are interfaces. Their meaning can drift when a URL parser is permissive, when a storage adapter flattens values into strings or when a reader reconstructs data without recovering the declared types.

Treaty therefore shipped cases with the shapes: examples to accept and examples to reject. Consumers could vendor those cases and run them through their production readers.

That last part matters. A test-only parser can prove that the fixture agrees with the test-only parser while the application continues doing something else. A shared case earns its keep when it reaches the code that handles the real boundary.

## The parser accepted too much

SuperMessage's callback reader already checked the scheme and host. That sounds close to complete until the case corpus asks about everything around them.

One rejected case is a callback shaped like `supermessage://linked/done?...`: the right scheme, the right host and a non-empty path ([case](https://github.com/SuperJackfruitLabs/treaty/blob/14fc31e126c5274aaaa504084b1bf716355cc69d/fixtures/urls/supermessage-linked.v1.cases.json#L28-L32)). The production reader accepted it. The shared case did not.

The repair tightened the real parser. It now rejects a non-empty path, user information, a password and a second `mxid` rather than extracting the first plausible value from a malformed callback ([guards](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/account_link.rs#L122-L133)). Its contract-backed tests state the rule cleanly: every valid shared case must parse, and every invalid case must be refused by the application reader ([tests](https://github.com/SuperJackfruitLabs/supermessage/blob/0f191c30f27ca2cd31e99194554cfa7129b067b3/crates/supermessage-core/src/treaty_urls.rs#L221-L240)).

This is what an executable contract does well. It turns “we both understand this URL” into examples that can be replayed on both sides of the interface. It also prevents a common testing mistake: duplicating the expected rules in a helper that never handles production input.

The change is merged through [SuperMessage PR #190](https://github.com/SuperJackfruitLabs/supermessage/pull/190). It landed after SuperMessage v0.1.3 and was not in a numbered SuperMessage release at the end of the research window.

## The reader preserved too little

The telemetry failure moved in the opposite direction. Instead of accepting a shape that should have been rejected, the read boundary erased distinctions the contract required.

Treaty declares attributes such as `run.epoch`, `acp.seq_from` and `acp.seq_to` as integers ([schema](https://github.com/SuperJackfruitLabs/treaty/blob/f807549c5bebdfaf4437aa342c2b8e384616423c/schemas/telemetry/suite.v1.json#L37-L54)). But the Jaeger-compatible API through which SuperWitness read VictoriaTraces returned span tags as strings. SuperWitness passed those strings onward, so convention checks failed for spans whose numeric attributes had made the round trip through the store.

The fix did not add a second handwritten list of numeric keys. SuperWitness now uses the shared convention as the source of truth. An explicit type supplied by the API wins. Otherwise, if a known convention key arrives as a string, the adapter attempts to recover the type declared by the contract. Unknown keys and values that cannot be parsed remain as received rather than causing the span to disappear ([adapter](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/adapter.go#L264-L291)).

The regression test deliberately presents the convention cases in the form the store returns: all strings. It then requires the served values to regain their declared types. Neighboring cases preserve unknown and unreadable values ([tests](https://github.com/SuperJackfruitLabs/superwitness/blob/cee447d7d437fa6a711225c77c0e682e8f895645/internal/source/traces/conventions_test.go#L122-L201)).

That gives the repair two boundaries. Coercion is narrow because only named convention keys receive contract-directed treatment. Failure is soft because observability data remains useful even when one attribute cannot be repaired.

The change shipped in [SuperWitness v0.0.14](https://github.com/SuperJackfruitLabs/superwitness/releases/tag/v0.0.14).

So far, the story appears straightforward: publish a contract, execute its cases, repair consumers that disagree. Then the direction of blame changed.

## Strict validation found an error in the specification

Treaty v0.0.20's board-read contract required every returned SuperPipeline stage to include `order`. SuperDispatch pinned the contract and strictly validated board data before using it for placement.

A real board arrived without the field. Validation stopped at `#/stages/0`, recorded `contract_refused` and produced no placement.

Weakening the consumer locally would have made the symptom disappear. SuperDispatch could have added a special case, accepted this one field or silently filled a default. That would also have preserved the wrong shared definition and forced future consumers to rediscover the same compatibility fact.

Instead, the correction happened where the incompatibility had been introduced. The Treaty schema made `order` optional and added producer-shaped cases. The [v0.0.21 release notes](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.21) state the reason directly: the previous contract was stricter than behavior that had always shipped.

SuperDispatch then pinned the corrected Treaty version. Its regression test names the real requirement: a board whose stages have no `order` is read in the order SuperPipeline sends them. The fixture also retains the original `contract_refused` detail, so the failure that motivated the correction remains part of the executable history ([test](https://github.com/SuperJackfruitLabs/superdispatch/blob/5b93df4f28c2e4d1121dfdb92540cdf59b721607/apps/dispatch/test/sources.test.ts#L412-L456)). The consumer update shipped in [SuperDispatch v0.0.4](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.4).

Strict validation had done its job. It made an undocumented compatibility rule impossible to ignore. The fact that the validator's contract was wrong did not make the failure useless; it made the disagreement visible at a precise path, against a versioned definition, with a case that could prevent recurrence.

## A red contract test is a question

Teams often describe a contract test failure as proof that the implementation must change. That is only one possible verdict.

A red case establishes a disagreement:

```text
contract expectation != observed boundary behavior
```

It does not establish which side owns the defect. Deciding that requires evidence about the deployed producer, compatibility promises and the intended boundary.

In the callback case, the contract captured the narrower URL grammar and the production parser was too permissive. In the telemetry case, the contract preserved typed semantics that the read path had flattened. In the stage-order case, deployed producer behavior established that the contract had invented a requirement.

Treating all three as consumer defects would have produced a bad result in the last case. Treating every mismatch as evidence that the schema should widen would have produced bad results in the first two. The value lies in making the disagreement executable, not in declaring one participant infallible.

A practical investigation can ask:

1. **What does the producer actually emit?** Capture real producer-shaped values, not only ideal fixtures.
2. **What behavior has already shipped?** A new contract cannot retroactively erase a compatibility surface.
3. **Is the consumer using its real boundary code?** Cases should reach the parser, adapter or reader used in production.
4. **Does the contract preserve meaning lost in transit?** If a store or wire format flattens types, recovery should be keyed to declared semantics rather than guesses.
5. **Can the correction be versioned and replayed?** Update the shared definition, add the failing case and pin the corrected release.

This turns a contract repository from a folder of authoritative-looking files into a record of tested agreements.

## Let the contract lose

Executable contracts are often sold as protection against implementation drift. They are. The Treaty rollout caught a URL reader accepting invalid callbacks and a trace path returning declared integers as strings.

But a contract system becomes more trustworthy when it can also preserve evidence that the contract lost an argument with reality.

That means shipping cases with schemas, running them through real producers and consumers, and refusing to decide the culprit from the color of the test alone. It means correcting the versioned contract rather than hiding an incompatibility in one consumer. It means retaining the producer-shaped regression case so a later cleanup does not reintroduce the invented rule.

A strict contract is valuable not because it is always right. It is valuable because it makes disagreements local, reproducible and reviewable—even when the shared specification is the thing that drifted.