# Brief: The event is the fast path; the sweep is the guarantee

## Recommendation

Write the article. Anchor it on [SuperExchange v0.0.2](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2), published on 12 November 2026 and described by its release notes as the first SuperExchange release to go into production. Use the gate projection shipped in that release to explain a reusable reliability pattern: accept events for low latency, reconcile against the authoritative system for completeness, and make both paths converge on the same durable claims.

**Proposed headline:** The event is the fast path; the sweep is the guarantee

**Alternative:** A webhook should wake your projector, not define its truth

**One-sentence angle:** SuperExchange posts board gates into Matrix immediately from an event relay, but it does not trust relay delivery to be complete: a periodic sweep finds missed gates and decisions made elsewhere, while durable claims and stable Matrix transaction IDs keep the fast path and repair path from producing duplicate cards or receipts.

**Confidence:** High for the gate path. The release notes, tag-pinned README, implementation and tests agree. Keep the article scoped to gates; the release documents incomplete service-read support for two other sweep types.

## Research decision: both new repositories were checked

### SuperDispatch

[SuperDispatch v0.0.1](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.1) was published on 13 November 2026 as its first release. It contains several viable topics, including tiered holds, fairness across boards, human-only supply suggestions and learned routing behind a shadow-evaluation gate. The previous version of this brief selected the learned-routing angle and supported it well from public code.

### SuperExchange

[SuperExchange v0.0.2](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2) was published on 12 November 2026 as the first release to go into production. Its release notes say it carries the product behaviour listed under [v0.0.1](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.1), including relay-driven board-room cards, replies carried back as the person, periodic reconciliation, one receipt per settled item and encrypted board rooms.

### Why SuperExchange wins this slot

The SuperDispatch learned-routing article remains defensible, but SuperExchange supplies the sharper general engineering lesson for this card: event delivery and state reconciliation are complementary, not competing, mechanisms. That lesson applies to webhook consumers, search indexes, notification projectors, chat bridges and read models well beyond this product. It is also clearly separate from the other open article about approvals being bound to the exact version shown.

## Why this shipped change is worth an article

A webhook or event relay makes a projection feel real-time, but it creates two hard questions:

1. What happens when an event never arrives or a consumer stops after recording it but before applying it?
2. What happens when the authoritative state changes through another interface?

SuperExchange's gate path answers both without asking the event stream to become a database.

The relay is the fast path. A `gate.pending` delivery is recorded and offered for posting into the board's Matrix room. Separately, at boot and on a configurable interval, a sweep asks each enabled board for its currently pending gates. If the board lists a gate the relay never delivered, the sweep records and posts it as if it had arrived. If a delivered gate was claimed but not fully posted, the sweep offers it again.

The sweep also repairs the opposite direction. When a gate previously shown in chat is no longer pending, SuperExchange does not infer a decision from absence. It reads that gate from the board and settles it only if the authoritative response explicitly says `resolved` and includes a decision. A decision made on the web or another client then receives the same room receipt as a decision made in chat.

Both paths converge on durable local state. Before sending a card, the service claims it and records what the card offered. It sends with a transaction ID derived from the card, so retrying the unfinished claim asks Matrix for the same logical event rather than creating a fresh one. The chat-answer path and the reconciliation path also contend for the same receipt claim and use the same receipt transaction IDs. Whichever path settles the gate first prevents the other from posting a second receipt.

That is the reusable pattern: **events reduce latency; reconciliation repairs omissions and out-of-band changes; idempotency makes either path safe to repeat.**

## Reader and payoff

**Reader:** Developers building webhook consumers, chat integrations, notification services, search projections or other read models over an authoritative API.

**Payoff:** A concrete projection design:

1. **Treat the event as a prompt to look, not the only truth.** Apply it quickly, but retain a way to query current authoritative state.
2. **Reconcile at boot and periodically.** Repair events missed during downtime, delivery exhaustion or partial application.
3. **Claim before the side effect.** Persist the identity and payload needed to retry before sending externally.
4. **Reuse the external idempotency key.** A retry should name the same logical send, not merely contain the same body.
5. **Make fast and repair paths share claims.** Two mechanisms that can finish the same work must converge on one durable winner.
6. **Do not turn absence into a decision.** Confirm an explicit terminal state before closing a projection.
7. **State the remaining gap.** A reliability pattern is credible when unsupported surfaces are named rather than generalized away.

## The shipped change

Primary public release:

- [SuperExchange v0.0.2](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2), published 12 November 2026. The release notes call it the first production release and say it carries the behaviour listed under v0.0.1.
- [SuperExchange v0.0.1](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.1), the feature inventory carried into v0.0.2; its own notes explicitly say v0.0.1 was not deployed.

Tag-pinned implementation at v0.0.2 (`a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c`):

- [README: relay intake, sweep repair and shared receipt claim](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L17-L53)
- [Gate sweep contract](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L1-L28)
- [Gate sweep implementation: project missed gates, then verify explicit resolution](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L94-L164)
- [Card send order: room, encryption guard, membership, durable claim, stable transaction ID](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/card-post.ts#L1-L16)
- [Card retry uses the same transaction ID](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/card-post.ts#L60-L124)
- [One receipt claim shared by chat answers and reconciliation](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L1-L14)
- [Receipt settlement and duplicate guard](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L100-L136)
- [Atomic SQLite claims for answers and receipts](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/store/index.ts#L1156-L1203)
- [Tests: a decision made elsewhere produces one receipt, and a later sweep does not repeat it](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-sweep.test.ts#L340-L397)
- [Tests: a repeated chat answer reaches the board once](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-answer.test.ts#L450-L474)

The article should stay on this one engineering change: reliable projection across a fast event path and a repairing state sweep. Do not turn it into a broad SuperExchange launch post.

## Suggested narrative

### 1. Open with the webhook that never came

A board is waiting on a decision, but its event never reaches the chat bridge. No exception in the consumer can repair an event it never saw. Retrying the webhook producer helps only while that producer still remembers the delivery.

The broader problem is architectural: a projection built only from a lossy delivery path has no independent way to know it is incomplete.

### 2. Give events one job: speed

SuperExchange takes `gate.pending` from the relay and projects it promptly. That path keeps the room current without polling on every user action.

But receipt of the event is not treated as proof that the local projection is complete forever. The service keeps a second path to the board's current state.

### 3. Use a sweep for completeness

At boot and every configured interval, the sweep asks each enabled board for pending gates. A gate present on the board but absent locally is ingested and posted. A locally known gate whose card did not finish posting is retried.

This is anti-entropy: the projection periodically compares itself with the authority and repairs the difference.

### 4. Reconcile terminal state conservatively

A previously posted gate disappearing from the pending list is not enough to call it resolved. It might be unreadable, malformed or otherwise unavailable. SuperExchange fetches the gate and requires explicit `resolved` state plus a decision before posting a closing receipt.

This is an important rule for every reconciler: **absence narrows the question; it does not answer it.**

### 5. Make retries name the same effect

Before an external send, the service stores a claim. A failed send retains that claim, and retry uses the same Matrix transaction ID derived from the card. For the receipt, both the chat-answer path and sweep use one database claim and the same transaction IDs.

The key is not merely “deduplicate later.” It is to arrange that competing paths and retries refer to the same logical operation from the start.

### 6. End at the boundary, not with a universal claim

The v0.0.2 README says gate reconciliation works through service-readable routes. It also says the follow-up and waiting-card sweeps cannot yet read their pending lists with the service token, so those surfaces still depend on the relay and direct-answer path for the documented gap.

Close with the design test: *If the event never arrives—or the state changes somewhere else—what independent mechanism discovers the difference, and what durable key makes the repair safe?*

## Claim ledger

| Claim | Public evidence | Confidence / wording |
| --- | --- | --- |
| SuperExchange v0.0.2 was published on 12 November 2026 and is described as the first release to go into production. | [v0.0.2 release](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2) | High. Say “the release notes describe it as the first production release”; do not infer deployment details beyond the notes. |
| v0.0.2 carries the product behaviour listed under v0.0.1; v0.0.1 itself was not deployed. | [v0.0.2 release](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2) and [v0.0.1 release](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.1) | High. This is why the article may discuss the gate projector as shipped in v0.0.2. |
| Relay events provide the immediate path, while a sweep runs at boot and on an interval. | [README](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L17-L42) and [sweep contract](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L1-L25) | High. Call it periodic reconciliation, not consensus. |
| The gate sweep discovers pending gates missed by the relay and retries known gates not yet posted. | [Gate sweep](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L110-L134) | High. |
| Absence from the pending list is not treated as a decision; the sweep requires an explicit resolved state and decision. | [Gate sweep](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L136-L164) | High. This is a central reusable lesson. |
| A card is claimed before sending and retried under the same transaction ID. | [Card posting](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/card-post.ts#L60-L124) | High. Say “same logical Matrix send” rather than promising transport-wide exactly-once delivery. |
| The chat-answer path and sweep share one receipt claim and stable receipt transaction IDs. | [Receipt design](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L1-L14), [settlement](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L100-L136), and [store claims](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/store/index.ts#L1156-L1203) | High. The code intentionally chooses at most one receipt claim. |
| Tests cover a web decision followed by repeated sweeps, a chat answer followed by a sweep, and duplicate chat delivery. | [Sweep tests](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-sweep.test.ts#L340-L433) and [answer tests](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-answer.test.ts#L450-L486) | High. Say the tests pin these traces, not that they prove every distributed failure is solved. |
| The documented reconciliation coverage is incomplete for delivery follow-ups and waiting cards in v0.0.2. | [README](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L107-L116) | High. Scope the main claim to gates. |
| No published lab note currently covers SuperExchange or relay-plus-sweep projection. | [Live blog index](https://www.superjackfruit.com/blog/) | High as checked on 13 November 2026. |

## Boundaries and caveats

- Do **not** claim generic exactly-once delivery. The implementation uses durable claims and stable Matrix transaction IDs to make its own retries and competing paths converge. That is narrower and more defensible.
- A receipt is claimed before it is sent. If that send fails, the gate remains resolved and the code logs the missing receipt rather than risking a duplicate later. Describe this as an at-most-one receipt claim with idempotent sends, not guaranteed eventual acknowledgement under every failure.
- Keep the article's reliability claim scoped to gates. The README explicitly documents missing service-read access for the follow-up and waiting-card sweeps in this release.
- Do not imply that polling replaces the relay. The design uses the relay for latency and the sweep for repair.
- Do not say that disappearance from a list means completion. The implementation deliberately performs a second read and requires explicit resolved state.
- Do not broaden this into an approval-security article. Exact subject/variant binding belongs to the other open article.
- Avoid operational details not needed for the public design lesson. The public release, tag-pinned code and tests are sufficient.

## Originality and collision check

The [live blog index](https://www.superjackfruit.com/blog/) was read before selecting the topic. Its eight published notes cover the lab, the suite, SuperPipeline, AgentPod, SuperWitness, a CLI self-update failure, AI pull-request review and Salaam session durability. None covers SuperExchange, event-relay repair, anti-entropy sweeps or idempotent Matrix projection.

The other open scheduled article is about variant-bound human approvals: an approval must identify the exact version shown. This brief instead covers projection reliability when events are missed or authoritative state changes elsewhere. Do not drift into subject digests, preview completeness or approval expiry.

## Source list for the eventual post

Use only public URLs:

1. https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2
2. https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.1
3. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L17-L53
4. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L107-L116
5. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L1-L28
6. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L94-L164
7. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/card-post.ts#L1-L16
8. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/card-post.ts#L60-L124
9. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L1-L14
10. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L100-L136
11. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/store/index.ts#L1156-L1203
12. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-sweep.test.ts#L340-L433
13. https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-answer.test.ts#L450-L486
14. https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.1
15. https://www.superjackfruit.com/blog/
