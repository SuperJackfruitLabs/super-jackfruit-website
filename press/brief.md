# Brief: The tool call finished. The work had not.

## Recommendation

Write a practical engineering post about a deceptively hard asynchronous-agent failure: a tool invocation can be *complete* while the work it launched is still running. The first repair correctly waited for ACP tool calls whose state remained pending. A staging canary then exposed the deeper protocol mismatch: delegated tasks and background processes return from their launch call immediately and deliver their useful result later, in an unsolicited wake turn. A second canary found that one launcher described this detached work in Markdown rather than JSON, bypassing the new detector. Three merged pull requests and two numbered releases show the repair evolving in response to real failures rather than a fabricated example.

**Working title:** **The tool call finished. The work had not.**

**Alternative titles:**

- **`end_turn` is not the end of the work**
- **A completed RPC can still mean “come back later”**
- **The missing state in asynchronous agent runs**

**One-sentence thesis:** In an asynchronous agent system, transport completion, turn completion and work completion are different events; preserve the run until the system has observed the semantic completion signal, while bounding that wait with quiet and hard timeouts.

**Why an outside developer should care:** The same trap appears in job launchers, workflow engines, webhooks and message-driven systems. If a launcher returns a process id or delegation id, treating the returned RPC as the work’s terminal event produces plausible but false success: the workflow closes with “I’ll report back” while the real result arrives to nobody.

**Confidence in the angle: high.** The failure sequence, fixes, tests, merge status and releases are all visible in public GitHub material. Deployment status beyond the numbered releases is deliberately not claimed.

## The story to tell

### 1. Start with the false handoff, not an invented demo

Open on the observable failure described in [AgentPod PR #881](https://github.com/SuperJackfruitLabs/agentpod/pull/881): a background launcher returned “completed,” the agent ended its turn, and the bridge completed and disconnected the run. Roughly a minute later the runtime sent the actual result as an unsolicited update with a new message id, but no live run remained to receive it. The recorded handoff was merely “waiting…”.

This makes the central distinction concrete:

1. **Tool-call completion:** the launcher accepted the request and returned an identifier.
2. **Turn completion:** the agent had nothing else to say synchronously and emitted `end_turn`.
3. **Work completion:** the delegated task or process later produced its result and triggered a wake turn.

The bug came from collapsing those three clocks into one.

### 2. Show why the first fix was correct but insufficient

[AgentPod PR #877](https://github.com/SuperJackfruitLabs/agentpod/pull/877) addressed the first observed class of failure. When a turn became idle with an ACP tool call still `pending` or `in_progress`, the bridge kept the run open, recorded that it was waiting on its own work, and prompted the same session again after the last call settled. A hard ceiling prevented the wait from hanging forever. The PR says its wake, failure/cancellation and timeout cases were revert-tested; GitHub records the PR as merged to `main` with 17 checks passing.

That repair used **tool-call state** as the pending-work signal. It was right for tool calls that actually stay open. It could not cover detached work whose launch call legitimately completes at once.

Release status: PR #877 merged to the default branch on 14 November 2026 and its functional commits shipped in [AgentPod v0.1.127](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.127), published 15 November. The release notes list “Wake turns after pending tools settle” and the associated test.

### 3. Follow the canary to the missing state

[AgentPod PR #881](https://github.com/SuperJackfruitLabs/agentpod/pull/881) records what the next canary found: delegated work and `notify_on_complete` terminal work return from their launcher immediately. Waiting for `pending` tool-call state therefore waits for nothing.

The repair moved pending-work detection up one semantic level:

- inspect completed tool results for durable work markers such as a delegation id, background mode, or a notification-enabled process id;
- keep the session, lease and heartbeat attached after `end_turn` while that inventory is outstanding;
- accept later unsolicited updates as a wake turn in the **same run**, without sending a synthetic prompt;
- build the handoff from that wake turn rather than from the earlier promise to report;
- close only after 30 seconds of wake-turn quiet, with a 30-minute hard ceiling and the still-pending inventory in any failure.

The useful design lesson is not “sleep longer.” It is **represent detached work explicitly and reconcile its later signal back to the run that launched it**. The quiet window handles a stream whose last message is not known in advance; the hard ceiling bounds failure.

The PR’s characterization test drives a fake ACP agent through the exact lifecycle: launch marker, `end_turn`, unsolicited update, and final handoff. GitHub records the PR as merged to `main` with 20 checks passing.

Release status: PR #881 merged to the default branch on 15 November 2026 and shipped in [AgentPod v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128), published later that day. The release notes name the attached wake turn, 30-second quiet period and characterization test.

### 4. Let the second canary break the representation assumption

The next failure is the detail that makes the post useful rather than generic. [AgentPod PR #882](https://github.com/SuperJackfruitLabs/agentpod/pull/882) says delegated work passed the canary, but a notification-enabled background terminal process still completed its card two seconds after launch with an “I’ll report…” handoff.

The detector expected JSON. The runtime’s real terminal result was Markdown:

```text
terminal result
- **output:** Background process started
- **session_id:** proc_…
- **pid:** …
- **exit_code:** 0
- **notify_on_complete:** True
```

The fix added a Markdown fallback for the same semantic markers. The new unit test uses the exact shape sent by the canary, checks that `notify_on_complete: True` plus a process id creates pending background work, checks negative Markdown cases, and preserves the JSON cases. The public test is visible at [`background-marker.test.ts` in v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.128/apps/hub/src/services/bridge/background-marker.test.ts). A full characterization case uses the same payload. GitHub records PR #882 as merged to `main` with 20 checks passing.

Release status: PR #882 merged to the default branch on 15 November 2026 and shipped in [AgentPod v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128). The release notes explicitly list the Markdown-marker fix and its test.

### 5. Extract a reusable state machine

End the technical body with a compact model an outside developer can apply:

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
  ├─ quiet window elapses ──> COMPLETE_FROM_WAKE_HANDOFF
  └─ more output ──> reset quiet window
```

Then give five implementation rules:

1. Model “accepted” separately from “finished.”
2. Persist a correlation key for every detached unit of work.
3. Keep the original workflow identity and authority alive; do not manufacture a replacement run for the callback.
4. Use the producer’s real wire representation in tests, not the representation the consumer wishes it emitted.
5. Bound liveness twice: a short quiet window for stream completion and a hard deadline for lost callbacks.

## Suggested article structure

1. **The handoff that said “waiting”** — the real canary failure.
2. **Three clocks, one mistaken terminal state** — RPC, turn and work completion.
3. **The first repair** — pending ACP calls, same-session wake, hard ceiling.
4. **Why “completed” was still pending** — detached launchers and semantic markers.
5. **JSON in the test, Markdown in production** — exact-payload characterization.
6. **A state machine for work that calls back later** — reusable model and rules.
7. **What shipped** — v0.1.127 and v0.1.128, with no deployment claim.

## Public source ledger

| Claim | Public source | Status | Confidence |
|---|---|---|---|
| Idle turns with genuinely pending ACP calls used to close early; the first fix kept the run open and woke the same session after settlement. | [PR #877](https://github.com/SuperJackfruitLabs/agentpod/pull/877) | Merged to `main`; included in [v0.1.127](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.127) | High |
| Detached delegated/background work returns from the launcher before its wake result; ending the run loses that result and leaves a “waiting…” handoff. | [PR #881](https://github.com/SuperJackfruitLabs/agentpod/pull/881) | Merged to `main`; included in [v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128) | High |
| The second fix tracks work markers, retains the same run, accepts unsolicited wake updates, waits for 30 seconds of quiet and has a 30-minute ceiling. | [PR #881](https://github.com/SuperJackfruitLabs/agentpod/pull/881), [v0.1.128 release notes](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128) | Numbered release | High |
| A terminal canary still failed because the real result was Markdown while the detector and test expected JSON. | [PR #882](https://github.com/SuperJackfruitLabs/agentpod/pull/882) | Merged to `main`; included in v0.1.128 | High |
| The release test contains the exact Markdown payload and positive, negative and JSON-preservation cases. | [`background-marker.test.ts` at v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.128/apps/hub/src/services/bridge/background-marker.test.ts) | In numbered release | High |
| The full-path test models unsolicited wake updates arriving after the prompted turn. | [`dispatch.characterization.test.ts` at v0.1.128](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.128/apps/hub/src/services/bridge/dispatch.characterization.test.ts) | In numbered release | High |
| v0.1.128 says background wake turns remain attached, Markdown markers are read and new tests cover the cases. | [v0.1.128 release notes](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.128) | Published numbered release | High |

## Scope, scan and novelty check

The research window was the seven days ending 18 November 2026. The scan began at the organization level rather than with a favored pull request: all 15 public SuperJackfruitLabs repositories were enumerated, GitHub’s merged-pull-request index was checked for the window, and the public releases on recently changed repositories were inspected. The scan found 87 merged pull requests after the exact seven-day cutoff and 33 numbered releases. Work was grouped by purpose across repositories before choosing this thread.

The repository’s current blog set and the public blog index were checked. Existing posts already cover permanent failures being misclassified as retryable, event-plus-sweep reconciliation, approval evidence, durable sessions, AI review, product introductions and release self-update. None covers the semantic gap between launcher completion and detached-work completion. No other in-progress article card was returned for this board besides this one.

## Changes intentionally left out

- **AgentPod v0.1.128’s vibekit/npm housekeeping** is in the same release but does not serve the asynchronous-lifecycle purpose. Mention it only as unrelated release content if needed for completeness.
- **AgentPod v0.1.127’s documentation theme, documentation voice and docs CI work** share a release with PR #877 but not its causal thread; including them would turn a reliability story into release-note enumeration.
- **The `[object Object]` activity-rendering cleanup in PR #881** is adjacent but not necessary to explain why a run must remain open. It can be a parenthetical, not a section.
- **The later benchmark/checkpoint work in AgentPod v0.1.129 and v0.1.130** concerns a different orchestration path and would obscure the small, general state-machine lesson here.
- **The suite-wide release workflow, docs-site, voice and dependency rollouts** span many repositories but address distribution and presentation rather than detached-work lifecycle.
- **Other strong standalone failures found in the scan**, including transient board failures wedging dispatch and a broker certificate reused past expiry, deserve separate articles. They are not missing pieces of this thread.
- **Artifact provenance and exact-version approval changes** are already covered by the blog’s “What exactly are you approving?” article, so they fail the novelty requirement.
- **Event relay plus reconciliation work** is already covered by “The event is the fast path; the sweep is the guarantee,” so it is also excluded on overlap.

No related pull request in the selected lifecycle thread is omitted: #877 establishes the pending-call state, #881 handles detached work and #882 fixes the real payload representation.

## Accuracy guardrails for the writer

- Say **“shipped in AgentPod v0.1.127/v0.1.128”**, not “deployed everywhere” or “live in production.” The public evidence proves merge and numbered-release status, not every deployment.
- Attribute the examples to the public PRs as staging canary observations; do not invent user names, infrastructure names, board ids or private operational details.
- Do not claim that `end_turn` is always wrong. It is terminal when no pending tool or detached work remains.
- Do not reduce the fix to a timeout. The key change is semantic pending-work inventory plus correlation to a later wake; the timers only bound liveness.
- Do not claim the marker parser is a universal protocol. Present it as an adapter to the producer’s actual output, with the broader recommendation that a typed completion contract would be preferable.
- The PR pages contain advisory review comments as well as passing checks. Avoid “proved bug-free”; say the public tests characterize the observed failures and the fixes shipped.
