# Brief: When retry is the bug

## Recommendation

Write the Wednesday article about [AgentPod PR #858](https://github.com/SuperJackfruitLabs/agentpod/pull/858), merged into the public repository's `main` branch on 11 November 2026. The change stops a permanently unrunnable Salaam card from being released and immediately reclaimed over and over. It now blocks the card once, explains what is wrong with its plan, and waits for a person to fix and resume it.

**Confidence: high.** The pull request is merged, the repository is public, the implementation and regression tests are visible at the merge commit, and no published Super Jackfruit Labs article covers this change.

## Working title

**When retry is the bug: block work that cannot succeed**

Alternatives:

- **The card that failed 230 times because every failure looked retryable**
- **Release, fail or block? A retry taxonomy for agent work**

## One-sentence angle

A real release-and-reclaim loop shows why durable agent systems must distinguish transient execution failures from invalid work: retry the former, but park the latter with an actionable reason and a path back to runnable state.

## Why an outside developer should care

This is not primarily an AgentPod product announcement. It is a compact reliability lesson for anyone building workers, queues, schedulers or agent orchestration:

- Returning a claim is safe only when a later attempt can plausibly behave differently.
- A circuit breaker does not repair a category error; treating invalid input as a retryable failure merely makes the same loop slower.
- “Blocked” is a useful first-class state when work itself is invalid but can become valid after a person changes it.
- Error text is part of the recovery interface. A schema-library diagnostic is less useful than the exact field to add or fix and the action that resumes work.
- The fallback path matters: if the board refuses the block transition, the worker still releases the claim rather than silently holding it.

The concrete incident gives the general rule weight. The public PR records one plan-less card being claimed and handed back **230 times in two hours**, with only `Invalid input: expected object, received undefined` in each hand-back. [[PR #858](https://github.com/SuperJackfruitLabs/agentpod/pull/858)]

## The shipped change

Before the fix, a strict Salaam station rejected a card without a valid `spec.salaam` plan before opening a session. The startup path handled that rejection like other pre-session errors: it released the claim. Because the card itself had not changed, it remained claimable and was rejected again.

The merged change introduces a typed `SalaamPlanRefused` condition and separates it from ordinary startup failures. Missing plans now produce a sentence that says which object is required; invalid plans name up to five failing paths. [[plan validation](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-plan.ts#L48-L84)]

When that condition occurs before a session opens, the dispatcher calls the board's block operation and returns a new `blocked` dispatch status. The error remains actionable on the card. If the block call is refused, the dispatcher falls back to the prior release behavior. [[dispatch path](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L67-L112)]

Regression coverage fixes both sides of the state transition: a missing-plan card produces one block and no release, while a refused block produces a block attempt followed by release. [[characterization tests](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch.characterization.test.ts#L1149-L1223)]

The operator guide now documents what the person sees and how recovery works: add or repair the plan, then resume the card. [[operator guide](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/docs/OPERATING.md#L1905-L1911)]

## Suggested article structure

### 1. Open with the loop

Start with the observable failure: one card, 230 claims in two hours, no progress, and a bare validation message. Avoid turning this into a dramatic outage story; the useful detail is that each individual transition looked locally defensible while the system-level behavior was wrong.

### 2. Explain why release was the wrong verb

Define the three outcomes precisely:

- **Release:** this worker did not start; another claim may succeed because capacity, connectivity or ownership can change.
- **Fail:** an attempt ran and failed; retry policy or a circuit breaker may apply.
- **Block:** the work cannot run as written; it must wait until its input changes.

The bug was not “too many retries” in the abstract. It was assigning a permanent input defect to the release path.

### 3. Show the smallest useful fix

Walk through the design, not a line-by-line diff:

1. Classify the known permanent refusal with a dedicated error type.
2. Translate schema failures into card-level, actionable text.
3. Block before a session or execution ledger entry is opened.
4. Preserve release as a fallback if the control plane cannot accept the block.
5. Add a distinct `blocked` status and operator-facing log message.

### 4. Make the state transition testable

Use the characterization test as the centerpiece. The important assertion is not merely that a function throws; it is that the external trace changes from repeated release to exactly one block, and that the fallback trace remains block-then-release.

### 5. Generalize the lesson

Offer a retry-decision test readers can apply:

> Before retrying, ask what fact could be different on the next attempt.

If the answer is “the input must change,” stop consuming retry budget and expose that required change. If the answer is “the dependency, lease or worker may recover,” release or retry can be appropriate.

Close with the broader point: retries are not neutral. A retry policy encodes a theory about whether time or a new worker can change the outcome.

## Claims and public evidence

| Claim | Public evidence | Confidence |
| --- | --- | --- |
| PR #858 was merged into AgentPod `main` on 11 November 2026. | [Merged pull request](https://github.com/SuperJackfruitLabs/agentpod/pull/858) and [merge commit](https://github.com/SuperJackfruitLabs/agentpod/commit/f93088796d26e30cc91ceba0992a7f02c6192fd1) | High |
| The observed loop claimed and returned the same invalid card 230 times in two hours. | [PR description](https://github.com/SuperJackfruitLabs/agentpod/pull/858) and the source comment at the [merge commit](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L86-L94) | High for the published repository record; do not embellish beyond it |
| Missing or invalid plans are now classified separately and reported with actionable field paths. | [`salaam-dispatch-plan.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-plan.ts#L48-L84) | High |
| The dispatcher blocks this work instead of releasing it, but falls back to release if blocking fails. | [`salaam-dispatch-start.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L67-L112) | High |
| Tests cover one block with no release and the block-refused fallback. | [`salaam-dispatch.characterization.test.ts`](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch.characterization.test.ts#L1149-L1223) | High |
| Recovery is to fix the plan and resume the card. | [AgentPod operator guide](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/docs/OPERATING.md#L1905-L1911) | High |

## Blog-overlap check

The published blog currently has eight articles. None covers PR #858, missing `spec.salaam` plans, or a release-and-reclaim loop.

Two nearby articles require deliberate differentiation:

- [“SuperPipeline: a durable work board for AI agents”](https://superjackfruit.com/blog/superpipeline-a-durable-work-board-for-ai-agents/) explains leases, reclaiming disappeared workers and bounded retries. This article should not re-explain the board. Its new subject is the semantic decision **before** retry: invalid work should be blocked rather than released or failed.
- [“Why we built Salaam”](https://superjackfruit.com/blog/why-we-built-salaam/) uses a different shipped change to discuss durable sessions and authority. Mention Salaam only as the strict executor in this incident; do not repeat the product introduction.

This topic is also distinct from the open Monday card's selected change, which concerns version-bound decisions in SuperMessage.

## Guardrails for the draft

- Cite only the public URLs above.
- Do not name private environments, people, internal workers or organizational teams. “A staging card” is enough context for the 230-attempt observation already disclosed in the public PR.
- Do not call this “exactly once” execution. The fix changes the invalid-input transition; it is not a general exactly-once guarantee.
- Do not say every validation error should block. The implementation recognizes one specific, typed refusal; ordinary startup errors retain the release path.
- Do not say a circuit breaker is useless. It is useful for repeated attempts; it is simply the wrong primary treatment when only changing the work item can alter the outcome.
- Do not imply a session started 230 times. The rejection occurs before a session opens.
- Attribute the 230-in-two-hours figure to the public PR rather than presenting it as independently reproduced telemetry.
- Keep implementation identifiers such as `SalaamPlanRefused`, `spec.salaam` and `blocked` in code formatting.

## Fact gaps

No publication blocker. The repository record is sufficient for the proposed engineering lesson. The brief does not independently verify the underlying staging telemetry behind the 230-attempt count; the article should treat the merged PR's public account as the source for that number.
