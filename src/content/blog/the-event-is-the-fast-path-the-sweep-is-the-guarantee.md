---
title: "The event is the fast path; the sweep is the guarantee"
description: "SuperPipeline owns gate state; SuperExchange combines relay events with reconciliation so its Matrix projection can recover from missed deliveries and decisions made elsewhere."
date: 2026-11-13
draft: true
tags: [engineering, reliability, integrations]
sources:
  - claim: SuperPipeline owns work state and models approval gates as human decisions that cards wait on.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/0c7f11fc19c4c54447639c0e43a849d00de00541/README.md#L5-L24
  - claim: SuperExchange v0.0.2 was published on 12 November 2026 as its first production release and carries the product behaviour introduced in the undeployed v0.0.1 release.
    url: https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2
  - claim: SuperExchange uses relay events for immediate projection and runs gate reconciliation at boot and on a configured interval.
    url: https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L17-L53
  - claim: The gate sweep discovers pending gates missed by the relay, retries unfinished card posts and requires explicit resolved state before posting a receipt.
    url: https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L94-L164
  - claim: Gate posting records a durable claim before sending and reuses Matrix transaction IDs derived from the gate when retrying.
    url: https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-card.ts#L369-L475
  - claim: Chat answers and reconciliation share a receipt claim and stable Matrix transaction IDs so competing paths converge on one receipt operation.
    url: https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L1-L14
  - claim: Tests cover a decision made outside chat followed by repeated sweeps without a repeated receipt.
    url: https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-sweep.test.ts#L340-L397
  - claim: In v0.0.2, service-read coverage for the delivery follow-up and waiting-card sweeps remains incomplete.
    url: https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L107-L116
---

A board is waiting for a decision. The event announcing that gate never reaches the chat bridge. Nothing crashes in the consumer, because the consumer never receives anything to crash on.

That is the uncomfortable limit of a projection built only from events: it can process every delivery perfectly and still be wrong.

[SuperExchange v0.0.2](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2), which its release notes describe as the first production release, takes a different approach to projecting [SuperPipeline](https://github.com/SuperJackfruitLabs/superpipeline/blob/0c7f11fc19c4c54447639c0e43a849d00de00541/README.md#L5-L24) board gates into Matrix. SuperPipeline owns the work state and the human approval gate; SuperExchange is the optional communication server that shows that gate in a room and carries the person's answer back. Relay events provide the fast path. A periodic sweep checks SuperPipeline's current state and repairs what the event path missed. Durable claims and stable transaction IDs make those two paths converge instead of competing.

The pattern is useful beyond chat bridges. It applies to webhook consumers, search indexes, notification services and any read model that must feel immediate without pretending an event stream is the authority.

## Keep the board authoritative

The product boundary matters to the reliability argument. SuperPipeline coordinates cards, runs and approval gates; its public description says plainly that it owns work state. SuperExchange does not become a second board when it puts one of those gates in Matrix. Its own release documentation describes it as a bridge: it receives a `gate.pending` event, renders the gate, and sends an answer back to SuperPipeline as the person who made it.

That makes the Matrix room a projection and interaction surface, not the source of truth. A gate can be resolved on the SuperPipeline web app, through `supi`, or through another authorized path. SuperExchange still has to make the room catch up. Its gate sweep therefore reads SuperPipeline's pending-gate list and individual gate state through service routes, then posts the same closing receipt it would have posted for an answer made in chat.

This separation gives each system one authority. SuperPipeline decides whether the gate is pending or resolved. SuperExchange decides what it has durably projected into Matrix. Reconciliation compares those two records instead of trying to make event delivery itself authoritative.

## Give the event one job: speed

When SuperExchange receives a `gate.pending` delivery from its relay, it records the delivery and offers the gate for posting into the board's Matrix room. The room can show new work promptly without waiting for the next poll.

Events are good at this. They turn a state change into an immediate prompt for downstream work. They avoid repeatedly asking the authority whether anything changed.

But an event can be delayed, exhausted after retries or missed while a consumer is unavailable. The consumer can also stop after recording the event but before completing the external side effect. Worse, the authoritative state can change through another interface without passing through the path the projection expects.

No amount of careful handler code can recover an event it never saw. The projection needs an independent route back to truth.

So SuperExchange does not give the relay a second job it cannot reliably perform. The relay reduces latency; it does not prove completeness.

## Sweep the authority for what is missing

At boot and on a configured interval, the gate sweep asks each enabled board for its pending gates. It compares that answer with the service's durable local state.

If the board lists a gate that the relay never delivered, the sweep ingests it and offers it for posting. If SuperExchange already knows about the gate but its card did not finish posting, the sweep offers the unfinished work again.

This is reconciliation rather than replay. The sweep does not need to reconstruct a perfect event history. It asks a narrower question: what should be pending now, and where does the local projection differ?

That distinction changes the recovery model. A relay outage can delay a card, but it does not make the omission undiscoverable. A process restart becomes an opportunity to repair unfinished projection work. The system can regain a current view without requiring the event producer to retain every delivery forever.

Events and polling are often presented as alternatives. Here they solve different problems. The event path minimizes staleness. The sweep creates recurring opportunities to discover an omission, subject to the board being readable and the sweep succeeding.

## Absence narrows the question; it does not answer it

Reconciliation becomes dangerous when it treats a missing item as proof of a terminal state.

Suppose a gate was posted into Matrix but no longer appears in the board's pending list. It may have been resolved. It may also be temporarily unreadable, omitted by a partial response or affected by an error the list cannot explain.

SuperExchange does not infer a decision from the disappearance. It reads the individual gate from the board and posts a closing receipt only when the authoritative response explicitly says the gate is `resolved` and includes a decision.

That conservative second read also catches changes made elsewhere. If someone decides the gate on the web rather than in Matrix, the next sweep can discover the explicit resolved state and add the same kind of receipt to the room.

A useful rule for reconcilers follows: **absence narrows the question; it does not answer it.** A missing item can trigger a more specific read. It should not manufacture a business fact that the authority has not confirmed.

## Make both paths name the same effect

A fast path and a repair path create a race. The relay can be posting a card just as the sweep discovers it. A person can answer in Matrix just as reconciliation observes that the same gate was resolved elsewhere. If each path considers only its own execution, the room can receive duplicate cards or receipts.

SuperExchange makes the paths converge on shared durable claims.

Before sending a gate card, the service claims it locally and records what the card offered. Each Matrix send uses a transaction ID derived from the gate and the part being sent. If the process has to retry the unfinished claim, it uses the same transaction IDs again—naming the same logical Matrix sends rather than creating fresh ones with identical bodies.

Receipts follow the same principle. The chat-answer path and the reconciliation path contend for one receipt claim and use stable receipt transaction IDs. Whichever path settles the gate first prevents the other from independently claiming a second receipt. Tests pin the out-of-band case: a decision made outside chat produces a receipt, and later sweeps do not repeat it.

This is more precise than saying “exactly once.” SuperExchange uses durable claims and idempotent Matrix sends to make its own retries and competing paths converge. It does not claim a universal exactly-once guarantee across every component and failure mode. In particular, a receipt is claimed before it is sent; if that send fails, the implementation records the failure rather than reopening the claim and risking a duplicate.

The design goal is not magic delivery semantics. It is stable identity for each intended effect.

## Build the repair path with the fast path

A reliable projection therefore needs three connected pieces:

1. **An event path for latency.** Apply relevant events promptly, but do not equate receipt with completeness.
2. **A state path for repair.** Reconcile at startup and periodically against an authoritative read model.
3. **A shared identity for effects.** Persist claims before external sends, reuse downstream idempotency keys and make every path that can finish the same work contend for the same claim.

The boundaries matter too. In v0.0.2, SuperExchange documents that gate reconciliation can use service-readable routes, while the delivery follow-up and waiting-card sweeps do not yet have equivalent service-read coverage. The reliability claim belongs to the gate path; it should not be stretched over surfaces that still depend on relay delivery and direct answers.

That limitation makes the broader lesson more credible, not less. Reconciliation works only where the authority exposes enough state to compare and enough stable identity to repair safely. If an API offers events but no way to list current work, consumers cannot independently detect omissions. If an external service accepts retries but no idempotency key, repair can create duplicates.

The design test is simple:

> If the event never arrives—or the state changes somewhere else—what independent mechanism discovers the difference, and what durable key makes the repair safe?

For SuperExchange gates, the event wakes the projection quickly. The sweep checks what is true. Shared claims make both routes finish the same work. The event is the fast path; the sweep is the guarantee that there is an independent repair route—not a promise that every sweep or receipt send succeeds.