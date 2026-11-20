---
title: The tool call finished. The work had not.
description: A launcher can return successfully while the work it started is still running. Reliable agent systems need separate states for RPC, turn and semantic completion.
date: 2026-11-20
draft: true
tags: [agents, engineering, reliability]
sources:
  - claim: AgentPod PR #877 kept runs open for pending or in-progress ACP tool calls, woke the same session after the final call settled and bounded the wait with the turn limit.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/877
  - claim: The pending-tool-call repair shipped in AgentPod v0.1.127.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.127
  - claim: AgentPod PR #881 records that detached delegation and notification-enabled process launchers complete before their useful wake result, and implements same-run wake handling with quiet and hard time limits.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/881
  - claim: AgentPod PR #882 records a canary failure caused by a Markdown terminal result bypassing a detector that expected JSON.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/882
  - claim: The v0.1.128 marker tests use the exact Markdown terminal-result shape observed on staging and retain negative and JSON cases.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.128/apps/hub/src/services/bridge/background-marker.test.ts
  - claim: AgentPod v0.1.128 shipped attached background wake turns, a 30-second quiet period, Markdown marker handling and tests for those cases.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128
---

A background launcher returned successfully. The agent ended its turn. The workflow recorded a handoff that amounted to “waiting…” and disconnected the run.

About a minute later, the useful result arrived. There was no live run left to receive it.

That failure, recorded in [AgentPod PR #881](https://github.com/SuperJackfruitLabs/agentpod/pull/881), came from an easy assumption to make in any asynchronous system: if the call that starts work has completed, perhaps the work has completed too.

It had not. The call had only accepted the job.

The repair took three pull requests and two releases because each real canary exposed a different boundary: first an open tool call, then detached work behind an already completed call, then a production payload formatted differently from the test fixture. Together they point to a general rule for agent runtimes, job launchers and workflow engines: **transport completion, turn completion and work completion are different events.**

## Three clocks, one false ending

The failed run contained three legitimate milestones:

1. **Tool-call completion:** the launcher accepted the request and returned an identifier.
2. **Turn completion:** the agent had no more synchronous work to do and emitted `end_turn`.
3. **Work completion:** the delegated task or background process later produced its result and triggered a wake turn.

None of those events is inherently wrong. The bug appears when the workflow treats the first or second as proof of the third.

This is not unique to agents. A `202 Accepted` response does not mean a video has finished transcoding. Returning a process id does not mean the process exited. Registering a webhook does not mean its callback has arrived. A queue publisher can confirm that it stored a message without saying anything about the consumer’s outcome.

Agent systems make the confusion unusually visible because a turn sounds semantically final. The model has stopped speaking, the tool invocation says `completed`, and the orchestration layer has a plausible sentence to save as the handoff. Every local signal suggests closure. The actual work is still somewhere else.

## The first repair followed tool-call state

The first observed failure was simpler. An agent turn became idle while one of its own ACP tool calls was still `pending` or `in_progress`. The bridge closed the run even though the call had not settled.

[AgentPod PR #877](https://github.com/SuperJackfruitLabs/agentpod/pull/877) changed that lifecycle. If a turn went idle with an open tool call, the bridge kept the run attached and recorded that it was waiting on its own work. When the last call became `completed`, `failed` or `cancelled`, the bridge prompted the same session again so the agent could continue from the result. The existing turn limit remained a hard ceiling; exceeding it blocked the run with the pending calls named instead of hanging forever.

That fix shipped in [AgentPod v0.1.127](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.127). It was the right model for work represented by an open call:

```text
idle turn + open tool call
  -> preserve run
  -> observe final tool-call state
  -> resume same session
```

But the state signal was narrower than the concept it represented. It answered “is this RPC still open?” The next canary asked a different question: “is work launched by this RPC still open?”

## “Completed” was still pending

Delegated tasks and notification-enabled terminal processes are deliberately detached. Their launch calls return immediately so the agent is not forced to hold a synchronous request open for the life of the job. The returned result includes a durable clue—a delegation id, a background mode, or a notification-enabled process id—and the runtime sends the useful output later as an unsolicited wake.

For those tools, a `completed` call is healthy behavior. Waiting for a `pending` call therefore waits for nothing.

That is what the staging canary behind [PR #881](https://github.com/SuperJackfruitLabs/agentpod/pull/881) exposed. The bridge saw a completed launcher and then `end_turn`, completed the card, and disconnected. The runtime’s wake arrived later with a new message id, after its owner had gone away.

The next repair moved pending-work detection up one semantic level. Instead of looking only at the tool-call status, the bridge inspected completed results for markers of durable work. When it found one, it kept the session, lease and heartbeat attached past `end_turn`. A later unsolicited update became a wake turn in the **same run**; the bridge did not invent a synthetic prompt or a replacement attempt. The final handoff came from that wake rather than from the earlier promise to report back.

The distinction matters beyond bookkeeping. The original run carries the identity, authority and history under which the work began. Creating a new run for the callback can lose those boundaries or make one logical attempt look like two. Correlation should reconnect the result to its owner, not manufacture a new owner after the fact.

## A callback stream needs two bounds

Once a wake can arrive later, “when should the run close?” no longer has a single obvious event.

A detached worker may emit more than one update. The consumer may not know which message is last. Closing on the first wake risks another partial handoff; waiting forever turns a lost callback into a permanent lease.

AgentPod v0.1.128 uses two bounds for that uncertainty:

- a **30-second quiet window** closes a wake turn after output stops arriving;
- a **30-minute hard ceiling** stops waiting if completion never becomes observable and reports the pending inventory.

The quiet period is not a substitute for work identity. It only answers how to infer the end of a stream whose final message is not declared in advance. The hard ceiling is not the completion signal either. It is the failure boundary for a signal that may never arrive.

That yields a useful ordering:

1. Detect semantic pending work.
2. Preserve its correlation to the original workflow.
3. Consume the later completion channel.
4. Use quiet time to settle an open-ended stream.
5. Use a hard deadline to bound a missing stream.

“Sleep longer” solves none of the first three.

## JSON in the test, Markdown in production

The next canary showed why the producer’s actual wire representation belongs in the test.

Delegated work passed. A terminal process launched with completion notification did not. Its card completed two seconds after launch with another “I’ll report…” handoff.

The detector expected a JSON result. The runtime had emitted Markdown:

```text
terminal result
- **output:** Background process started
- **session_id:** proc_…
- **pid:** …
- **exit_code:** 0
- **notify_on_complete:** True
```

The semantics were present: this was a notification-enabled process, and it had a correlation id. But the adapter could not read the representation, so the workflow behaved as if no background work existed.

[PR #882](https://github.com/SuperJackfruitLabs/agentpod/pull/882) added a Markdown fallback for those markers. More importantly, its unit test copied the exact terminal-result shape sent by the canary. The released test checks that `notify_on_complete: True` plus a process id creates pending work, that ordinary or disabled terminal results do not, and that the existing JSON forms still work ([test source](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.128/apps/hub/src/services/bridge/background-marker.test.ts)).

This parser is an adapter, not an ideal universal protocol. A typed result contract would be preferable to recovering state from presentation text. But when an integration must consume the producer that exists, a fixture shaped like the consumer wishes it existed is false confidence. Characterization tests should begin with captured boundary data and then assert the semantics extracted from it.

The Markdown repair, same-run wake handling, 30-second quiet period and their tests shipped in [AgentPod v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128). That is a numbered-release claim, not a claim that every installation has deployed it.

## A state machine for work that calls back later

A compact model separates the events that the failed implementation had collapsed:

```text
RUNNING_SYNCHRONOUSLY
  ├─ pending tool call at idle ──> WAITING_FOR_TOOL_CALL
  ├─ detached-work marker + end_turn ──> WAITING_FOR_WAKE
  └─ no pending work + end_turn ──> COMPLETE

WAITING_FOR_TOOL_CALL
  ├─ final tool call settles ──> RESUME_SAME_RUN
  └─ hard deadline ──> BLOCK_WITH_PENDING_INVENTORY

WAITING_FOR_WAKE
  ├─ unsolicited wake begins ──> RECEIVING_WAKE
  └─ hard deadline ──> BLOCK_WITH_PENDING_INVENTORY

RECEIVING_WAKE
  ├─ more output ──> reset quiet window
  └─ quiet window elapses ──> COMPLETE_FROM_WAKE_HANDOFF
```

The exact state names are not important. The explicit questions are:

- What fact proves the launcher accepted work?
- What identifier lets a later result name that work?
- What fact proves the synchronous turn is over?
- What event or bounded inference says the detached work is over?
- Which workflow identity remains authoritative while the system waits?
- What diagnostic survives if the callback never comes?

If one boolean named `completed` answers all six, the model is probably hiding a race.

## Five rules to carry into another system

The incident sequence suggests five implementation rules.

### 1. Model accepted separately from finished

A successful launch is an acknowledgement, not an outcome. Name the states differently in APIs, storage and operator interfaces. If both are called “complete,” callers will eventually close something too early.

### 2. Persist a correlation key for detached work

A callback without a durable owner is just an event. Store the delegation id, process id, job id or equivalent before releasing the synchronous path, and retain enough pending inventory to explain a timeout.

### 3. Keep the original workflow alive

The later result belongs to the attempt that authorized and launched it. Preserve that run’s session, lease and history while waiting, rather than creating a replacement attempt merely because the delivery arrives in a new message.

### 4. Test the boundary you actually receive

Capture real callback payloads, including formatting, capitalization and nesting. Keep negative cases beside the positive one so an adapter does not interpret ordinary output as background work. Preserve tests for older supported forms when adding a fallback.

### 5. Bound liveness twice

Use a short quiet window when a callback is a stream without an explicit final marker. Use a separate hard deadline for lost callbacks. Report what remained outstanding at that deadline; “timed out” is much less useful than “timed out waiting for process `proc_…`.”

## Completion is a domain event

RPC frameworks can tell us when a request returned. Agent harnesses can tell us when a turn stopped. Neither can decide, on its own, when the business work those actions launched is finished.

That decision belongs to the domain protocol: an explicit terminal event when one exists, or a carefully bounded inference when it does not. The orchestration layer has to retain the correlation and authority needed to observe it.

The failed handoff looked plausible because every transport-level event had finished cleanly. Only the semantic work was missing.

That is the dangerous version of an asynchronous bug: not an obvious crash, but a tidy success recorded one state too soon.