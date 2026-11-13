# Verification: The event is the fast path; the sweep is the guarantee

## Verdict

**Publishable: true.** After the corrections recorded below, every material factual claim in the article is supported by the cited public release record, the code at the immutable `v0.0.2` commit, or the tag-pinned tests. No publication blocker remains.

The headline uses “guarantee” for the existence of an independent reconciliation route, not as a timing, availability, or exactly-once guarantee. The article now says that explicitly.

## Public record checked

- [SuperExchange v0.0.2](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.2): GitHub records it as published on 12 November 2026. Its notes call it the first release to go into production and say it carries everything listed under v0.0.1.
- [SuperExchange v0.0.1](https://github.com/SuperJackfruitLabs/superexchange/releases/tag/v0.0.1): its notes say it was never deployed and describe the relay-driven cards, periodic gate sweep, one receipt, encrypted rooms, and the 60-second default sweep setting carried by v0.0.2.
- Tag `v0.0.2` resolves to immutable commit [`a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c`](https://github.com/SuperJackfruitLabs/superexchange/commit/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c).
- The [tag-pinned README](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L17-L53) documents relay intake, a sweep at boot and on the configured interval, projection of relay omissions, explicit terminal-state reads, and the shared answer/sweep receipt claim.
- The [gate sweep implementation](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-sweep.ts#L94-L164) iterates enabled boards, records pending gates absent locally, retries known unposted gates, and settles an absent gate only after an individual read returns `resolved` with a non-null decision.
- The [gate posting implementation](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-card.ts#L369-L475) takes the local gate claim before sending and uses transaction IDs derived from the gate ID and message part. An unfinished claim is retried under those same IDs.
- The [receipt implementation](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L1-L14) documents the common answer/sweep claim and stable receipt transaction IDs. Its [settlement path](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/board-chat/gate-receipt.ts#L100-L136) claims before sending and logs a failed receipt without reopening the claim.
- The [SQLite updates](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/src/store/index.ts#L1156-L1203) make receipt claims conditional on the prior claim columns, supporting the article's “one durable winner” wording.
- The [sweep tests](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/apps/exchange/test/gate-sweep.test.ts#L340-L397) cover a decision made on the web, no repeated receipt on a second sweep, and a chat answer followed by a sweep with no second receipt.
- The [README's documented boundary](https://github.com/SuperJackfruitLabs/superexchange/blob/a81467cfe8f1abcd9aa6f868edd70dbc04aaca7c/README.md#L107-L116) confirms that service-token reads for delivery follow-up and waiting-card sweeps were not yet admitted. The article correctly scopes its reliability claim to gates.

## Corrections made

1. **Corrected the gate-post source.** The draft cited `card-post.ts`, whose implementation is for single-event follow-up and waiting cards. The gate claim and retry claim are implemented directly in `gate-card.ts`, so the article now cites the gate-specific code.
2. **Corrected transaction-ID wording.** The draft said the transaction ID was derived from “the card.” The code derives separate IDs from the gate ID and the part (`prose` or `card`). The text now states that exact behavior and uses the plural where two sends are involved.
3. **Removed a timing overclaim.** “The sweep bounds how long an omission can remain hidden” was too strong because a board can be unreadable and failed passes back off. The article now says the sweep provides recurring discovery opportunities, subject to readable boards and successful sweeps.
4. **Qualified the headline's guarantee.** The closing sentence now defines the guarantee as an independent repair route and expressly excludes a promise that every sweep or receipt send succeeds.

## Claim-by-claim findings

| Article claim | Finding |
| --- | --- |
| v0.0.2 is the first production release. | Supported verbatim by the v0.0.2 release notes. |
| Relay `gate.pending` deliveries are the immediate path. | Supported by the README and release notes. |
| The sweep runs at boot and on a configured interval over enabled boards. | Supported by the README, `gate-sweep.ts`, and startup wiring. |
| The sweep ingests gates missed by the relay and retries known unfinished posts. | Supported by `gate-sweep.ts` lines 110–127. |
| Disappearance from the pending list is not treated as a decision. | Supported by `gate-sweep.ts` lines 136–157; explicit `resolved` state and a decision are required. |
| A decision made outside Matrix can receive the room receipt. | Supported by the README, settlement code, and the “decided on the web” test. |
| Gate posts are claimed before sends and retried under stable Matrix transaction IDs. | Supported by `gate-card.ts` lines 369–475 after correcting the draft's source and wording. |
| Chat answers and sweeps converge on one receipt claim and stable receipt IDs. | Supported by `gate-answer.ts`, `gate-receipt.ts`, the conditional store updates, and tests. |
| This is narrower than exactly-once delivery. | Accurate. The code has stable idempotency keys and local claims but deliberately does not reopen a claimed receipt after a send failure. |
| Follow-up and waiting-card reconciliation lack equivalent service-read coverage in v0.0.2. | Supported explicitly by README lines 107–116. |

## Validation

- `npm test`: passed all 41 tests.
- `npm run build`: completed successfully with zero errors. Astro reported five pre-existing hints and Vite reported its existing large-chunk warning; neither concerns this Markdown-only change.

## Publication blockers

None.