---
title: "When retry is the bug: block work that cannot succeed"
description: A card was claimed and handed back 230 times because a permanent input defect looked retryable. The fix was not a longer backoff, but a better state.
date: 2026-11-11
draft: true
tags: [agents, engineering, reliability]
sources:
  - claim: AgentPod PR #858 was merged into main on 11 November 2026 and records one invalid staging card being claimed and handed back 230 times in two hours.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/858
  - claim: Missing or invalid spec.salaam plans now raise a typed refusal with an actionable message and up to five invalid field paths.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-plan.ts#L48-L84
  - claim: The dispatcher blocks a pre-session plan refusal, returns a blocked status and falls back to release if the board refuses the block.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L67-L112
  - claim: Characterization tests require one block with no release for a missing plan and block followed by release when the block is refused.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch.characterization.test.ts#L1149-L1223
  - claim: The operator guide says to add or repair the plan and then resume the card.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/docs/OPERATING.md#L1905-L1911
---

One card was claimed and handed back 230 times in two hours. No session opened. No work began. Each cycle ended with the same message: `Invalid input: expected object, received undefined`.

Nothing transient was failing. The card was missing a valid plan, so another attempt by the same worker could not produce a different result. Yet releasing the claim made the card immediately available to be claimed again.

That loop, recorded in the public account for [AgentPod PR #858](https://github.com/SuperJackfruitLabs/agentpod/pull/858), is a useful warning for anyone building a queue, scheduler or agent system: retry is safe only when the next attempt has a reason to behave differently.

The fix was not a longer delay or a lower retry limit. It was to choose the right state. AgentPod now blocks this specific kind of unrunnable work once, explains what must change, and waits for a person to repair and resume the card.

## Every local decision looked reasonable

A strict Salaam station accepts only cards with an explicit `spec.salaam` plan. Before opening a session, the dispatcher reads the card and validates that plan. If the plan is absent or invalid, execution cannot be admitted.

Previously, that pre-session rejection followed the general path for work that could not be started: release the claim. In many cases, release is exactly right. A worker may have lost connectivity. Capacity may have changed. A different worker may have the required capability. Returning the work to the queue gives a future claim a chance to succeed.

But none of those changing conditions could create a missing field in the card.

The worker rejected the input, released its claim, saw the unchanged card become claimable, and claimed it again. Each transition was locally defensible. Together they formed a system-level bug.

This is why “too many retries” is an incomplete diagnosis. The loop did not begin with an excessive retry count. It began when a permanent input defect was assigned to a transition intended for temporary inability.

## Release, fail or block

Reliable orchestration needs more than one negative outcome. Three verbs cover different facts:

- **Release:** this worker did not start the work, but a later claim may succeed because the worker, lease, capacity or dependency can change.
- **Fail:** an attempt ran and failed. Retry policy, backoff and a circuit breaker may decide whether another attempt is justified.
- **Block:** the work cannot run as written. It must wait for its input—or a decision about that input—to change.

The distinctions matter because each state predicts a different future.

A circuit breaker can bound damage from repeated failures, and backoff can reduce pressure on a recovering dependency. Neither repairs invalid work. Treating a missing plan as a failure would still spend attempts before asking for the one intervention that can help. Treating it as a release skips even that bound and can send the item straight around the claim loop.

Blocking states the actual condition: time is not the missing ingredient; changed input is.

That does not mean every validation error should block. PR #858 recognizes one narrow, typed condition: a strict Salaam card whose required plan is missing or invalid. Other startup errors keep their existing release behavior. The lesson is not “make all errors permanent.” It is “classify the errors whose recovery condition you already know.”

## Turn validation into a recovery interface

The implementation starts by giving the known refusal its own type, `SalaamPlanRefused`. That lets the dispatch path distinguish a plan defect from an ordinary exception without guessing from a message.

The message changes too. If the plan is absent, the card now says that it needs `salaam: { version: 1, plan }` under `spec.salaam`, and tells the operator to add it and resume. If validation fails, the diagnostic names up to five failing paths rather than returning only the schema library's generic error ([source](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-plan.ts#L48-L84)).

That text is not cosmetic. Once a system parks work for a person, the error becomes part of the recovery interface. A useful blocked reason should answer three questions:

1. **What is wrong?** Name the missing or invalid object.
2. **Where is it wrong?** Point to the field path a person can inspect.
3. **How does work continue?** Name the action that returns the item to a runnable state.

Without those answers, “blocked” can become another dead end. With them, it is a controlled pause.

## Change the trace, not just the exception

The important behavior happens before an execution session opens. The dispatcher validates the plan first. When it catches `SalaamPlanRefused` at that boundary, it calls the board's block operation, leaves the reason on the card, and returns a distinct `blocked` dispatch status. The card waits in an input-required state until someone repairs its plan and resumes it ([dispatch path](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch-start.ts#L67-L112), [operator guide](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/docs/OPERATING.md#L1905-L1911)).

The fallback is equally important. A block request crosses a control-plane boundary and can itself be refused. In that case, the dispatcher releases the unopened claim as it did before. It does not silently keep ownership of work it could neither run nor park.

The regression tests pin both external traces:

- A missing-plan card produces one block carrying the actionable reason and no release.
- A refused block produces a block attempt followed by a release.

Those assertions are stronger than checking that plan validation throws. They specify what the rest of the system can observe: which operation reached the board, in what order, and whether the claim was returned ([tests](https://github.com/SuperJackfruitLabs/agentpod/blob/f93088796d26e30cc91ceba0992a7f02c6192fd1/apps/hub/src/services/bridge/salaam-dispatch.characterization.test.ts#L1149-L1223)).

For workflow engines, that is the behavior worth testing. Exceptions are implementation details. State transitions and outbound effects are the contract.

## Ask what can change

A compact retry test falls out of this incident:

> Before retrying, ask what fact could be different on the next attempt.

If the answer is “the network may recover,” “the lease may expire,” “capacity may free up,” or “another eligible worker may claim it,” retry or release may be appropriate.

If the answer is “someone must change the input,” another attempt is not recovery. It is repeated observation of the same defect. Park the work, preserve the reason, and make the route back to runnable state explicit.

This test also helps with less obvious cases:

- A malformed configuration known to be stored on the work item should usually wait for correction.
- A dependency returning a temporary availability error may deserve backoff.
- A worker lacking authority might be released if another worker can possess it, but blocked if the task itself requests an operation no policy can permit.
- An attempt with uncertain external effects should be inspected, not blindly replayed.

The useful question is not whether an error happened before. It is whether time, a new claimant or a recovering dependency can change the premises of the next attempt.

Retries are not neutral plumbing. Every retry policy encodes a theory of change: something about the world is expected to be different next time. When that theory is false, backoff only spaces out the mistake and a circuit breaker only stops it later.

One invalid card circling 230 times made that mismatch visible. The durable fix was a state that told the truth: this work cannot succeed yet, here is why, and here is what must change before it runs again.
