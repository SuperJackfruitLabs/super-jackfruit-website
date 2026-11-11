# Verification: When retry is the bug

## Verdict

**Publishable: true.** Every material factual claim in the article is supported by the cited public GitHub record at AgentPod merge commit [`f93088796d26e30cc91ceba0992a7f02c6192fd1`](https://github.com/SuperJackfruitLabs/agentpod/commit/f93088796d26e30cc91ceba0992a7f02c6192fd1). No publication blocker remains.

The article remains `draft: true` for the publication workflow. That flag is not a claim-verification blocker.

## What I checked

| Article claim | Public evidence checked | Finding |
| --- | --- | --- |
| AgentPod PR #858 merged into `main` on 11 November 2026. | [PR #858](https://github.com/SuperJackfruitLabs/agentpod/pull/858), the [GitHub pull-request API record](https://api.github.com/repos/SuperJackfruitLabs/agentpod/pulls/858), and the [merge commit](https://github.com/SuperJackfruitLabs/agentpod/commit/f93088796d26e30cc91ceba0992a7f02c6192fd1). The public API reports `merged: true`, `merged_at: 2026-11-11T02:49:35Z`, base branch `main`, and merge SHA `f930887…`. A fresh fetch also confirmed that commit is an ancestor of the public `origin/main`. | Supported. |
| One invalid staging card was claimed and handed back 230 times in two hours, each time with `Invalid input: expected object, received undefined`. | The public [PR description](https://github.com/SuperJackfruitLabs/agentpod/pull/858) states all of these details. The same incident count and pre-session classification are preserved in the merged source comments in [`salaam-dispatch-plan.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-plan.ts#L50-L53) and [`salaam-dispatch-start.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L88-L93). | Supported as an attributed repository account. The underlying staging telemetry is not independently public; the article appropriately attributes the loop to PR #858 rather than claiming independent reproduction. |
| No session opened and no work began for the rejected card. | The merged dispatch path invokes `planFrom(context)` before `openDispatch` and before `acp.createSession`, and catches the typed refusal only while `session` is unset: [`salaam-dispatch-start.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L23-L43). The operator guide also says, “No session opened, so no ledger row is written.” | Supported. |
| Missing and invalid `spec.salaam` plans raise `SalaamPlanRefused`; missing plans get an actionable message and invalid plans report up to five paths. | [`salaam-dispatch-plan.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-plan.ts#L46-L85) defines the error class, checks missing plans, slices validation issues to five, prefixes each issue path with `spec.salaam`, and tells the operator to fix the plan and resume. | Supported. |
| Only this typed plan refusal takes the block path; ordinary pre-session errors retain the release path. | [`salaam-dispatch-start.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L76-L84) checks `isSalaamPlanRefused` before blocking and otherwise calls `releaseUnopened`. The plan unit test also verifies that an ordinary error is not mistaken for this refusal. | Supported. |
| A successful block returns a distinct `blocked` dispatch status and leaves the reason on the card. | [`blockUnrunnable`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L95-L109) passes `error.message` to the board block call and returns `{ status: "blocked", …, reason }`. [`dispatch-types.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/dispatch-types.ts#L149-L160) defines the status, and [`loop.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/loop.ts#L153-L158) logs it as waiting on a person. | Supported. |
| If the board refuses the block, the unopened claim is released. | [`blockUnrunnable`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L95-L109) catches the block failure and calls `releaseUnopened`. | Supported. |
| Regression tests require one block with no release, and block-then-release when blocking is refused. | The merged [characterization tests](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch.characterization.test.ts#L1149-L1219) assert exactly those outbound traces. | Supported. |
| Recovery is to add or repair the plan and resume the card. | The merged [operator guide](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/docs/OPERATING.md#L1905-L1910) documents the blocked state, correction, and `supi resume` recovery action. | Supported. |

I also checked the article against the brief's guardrails. It does not claim exactly-once execution, does not generalize the block behavior to every validation error, preserves circuit breakers as useful for retryable failures, does not imply that a session opened during the 230 rejections, and keeps the incident count attributed to the public PR.

## What I changed

- Added this verification record.
- Made no factual edits to `src/content/blog/when-retry-is-the-bug.md`; the draft already matches the public evidence and uses the required qualifications.

## Local validation

- `npm test`: **41 passed, 0 failed**.
- `npm run build`: Astro check completed with **0 errors** and the static production build completed successfully. The check reported five pre-existing hints, and Vite retained its existing large-chunk warning; neither affects this draft.

## Publication blockers

None.
