---
title: "Why we built Salaam: agent work should outlast the terminal"
description: "We built Salaam around a simple constraint: agent work should not disappear with a terminal window. A recent local-session fix shows why the session—not the client or coding mode—has to be the durable object."
date: 2026-11-04
draft: true
tags: [agents, engineering, reliability]
sources:
  - claim: From its first public release, Salaam described itself as a persistent home for agent work and named three requirements involving client closure, reconnection and evidence of task success.
    url: https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md
  - claim: Salaam 0.0.1 introduced persistent sessions across terminal, SSH and ACP editor clients.
    url: https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1
  - claim: The Salaam 0.0.7 architecture assigns durable state and recovery to a host-local service, conversation ownership to a pinned worker and display plus outbox duties to clients.
    url: https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md
  - claim: Salaam distinguishes client reconnection from service or worker recovery, and requires fresh acceptance evidence for checked-task completion.
    url: https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md
  - claim: PR #114 changed the submission route from checking for a coding session to checking for a local workspace and added a regression test for read-only workspace sessions.
    url: https://github.com/SuperJackfruitLabs/salaam/pull/114
  - claim: Salaam 0.0.7 shipped pasted-image and file-mention support for plain local sessions while leaving board-session input unchanged.
    url: https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7
---

A plain `salaam` session was local. It belonged to a workspace. It was deliberately read-only: no coding tools, no commands. Yet paste an image into it and the response was, “Only a local session takes pasted images.” Type an `@` file mention and the mention went through as bare text.

Coding sessions accepted both.

The contradiction came down to one predicate. The submission route asked whether the session was `localCoding` when it needed to ask whether the session had a `localWorkspace`. [PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114) changed that check, added a regression test for the read-only case and shipped in [Salaam 0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7). Board-session input stayed unchanged.

It was a small fix. It also exposed a product boundary that matters far beyond pasted images.

A session is not a terminal window. A local workspace is not the same thing as permission to modify it. Coding is one way to use an agent session, not the definition of one. Salaam exists because those concepts need separate lifetimes and separate authority.

## The work had inherited the window's lifetime

When we published Salaam's [first release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1), its README opened with a constraint: **work should outlast a terminal**.

That constraint contains three engineering problems:

1. Closing a client should not discard the agent's session.
2. Reconnecting should not submit the same instruction again.
3. An agent saying “done” should not be the only evidence that a task succeeded.

A conventional interactive agent can make all three concerns look like one conversation. The process receives a prompt, streams a response and prints a final message. As long as the window stays open and every operation returns cleanly, the arrangement feels complete.

A dropped connection reveals the missing state.

Was the instruction accepted before the response disappeared? Is the turn still running somewhere? If the client sends the prompt again, will it resume the same work or create a duplicate? If an external operation happened but its reply was lost, is it safe to retry? If the transcript ends with “done,” which checks or deliverables establish that the task actually passed?

These are not display questions. They are questions about identity, admission and evidence. A terminal process cannot answer them reliably if it is also the only place that the work exists.

So we moved ownership elsewhere.

## The terminal is a window onto the work

Salaam runs a session service on the machine or execution host. Terminal, SSH and ACP editor clients connect to that service. The clients show state, keep pending actions in a private outbox and follow committed results; they do not own the session's lifetime.

The service owns the durable parts: session lifecycle, accepted dispatch, task state, policy, approvals, receipts and recovery. A pinned worker owns the conversation tree and runs admitted agent turns. A second client can attach to the same session and see the same task steps, approvals and results.

That division gives us a useful mental model: **the terminal is a window onto the work, not the place the work lives.**

Closing the window therefore means detaching a client. It does not mean deleting the room, cancelling everything inside it or forgetting which requests were accepted. Switching from a terminal to an editor does not create a new identity for the work. Reconnecting from another terminal does not require reconstructing a session from whatever text happened to remain on screen.

This is also why the 0.0.7 bug was revealing. The plain session already had the property that mattered for attachment: a local workspace from which Salaam could read the files the user explicitly mentioned. Requiring coding mode accidentally made a permission bundle stand in for locality. The fix restored those as separate dimensions.

## Reconnecting is not replaying

Persistence is often described too loosely. “The work survives” can sound as if every failure should trigger an automatic retry. That is not Salaam's contract.

Before transmission, a client saves an instruction with a stable request ID. If the response is lost, the outbox can retry that same logical request. The service returns the saved acceptance instead of creating another attempt. On reconnection, the client reads committed events from a cursor and catches up with the existing session.

The identity stays stable. That does not grant permission to repeat uncertain effects.

Detaching a client leaves admitted work running. A service or worker crash is different: work that was already dispatched becomes interrupted. Salaam preserves the attempt and requires inspection plus explicit continuation rather than silently launching it again. Work that was still safely queued keeps its identity.

The distinction matters whenever an agent can affect something outside its own transcript. A timeout does not prove that an API call failed. A missing response does not prove that it succeeded. Retrying because the UI is empty can turn uncertainty into duplication.

Durability should preserve that uncertainty honestly. The system needs to remember the operation that may have happened, not erase the ambiguity by manufacturing a fresh attempt.

That is a less magical promise than “everything keeps running through anything.” It is also a more useful one. Client closure, process interruption and uncertain external effects have different meanings, so they need different recovery paths.

## “Done” needs a durable meaning

Moving session state out of the terminal solves only part of the problem. The completion claim has to outlast the window too.

A model response is useful conversation. It may summarize a change, explain a decision or say that a task is complete. It does not, by itself, certify that a command passed, a file exists at the expected revision or an external operation produced the intended result.

Salaam's checked tasks therefore bind more than prose. A checked task has a plan, steps, budgets, a workspace and acceptance checks. Final success requires fresh check receipts and deliverable evidence for that scope. An old passing command, an inbox acknowledgement or a confident final sentence cannot substitute for those records.

Approvals follow the same principle. An approval belongs to the target, arguments, expected version, policy and worker that were reviewed. It is not a free-floating “yes” that can be reused after the operation changes.

This is the third part of making work durable. Keeping a transcript is not enough. The system also has to keep the evidence that gives state transitions their meaning.

## The session is the durable object

The pasted-image fix did not invent attachment support. Coding sessions already had it. It extended that route to plain local workspace sessions because reading a user-selected attachment did not require coding authority.

That sounds like a narrow implementation detail, but it is a good test of the design. If “local,” “workspace-backed,” “allowed to read an explicit attachment” and “allowed to code” collapse into one mode flag, each new interface will inherit permissions and restrictions that do not belong together. The client or mode starts defining the work again.

Salaam's boundary is different: the session and its admitted work retain their identity; clients attach to them; capabilities remain explicit.

For anyone building an agent CLI, editor integration or unattended workflow, that leads to a practical checklist:

1. **Give work an identity outside the UI process.** Closing or switching a client should not create a different task.
2. **Persist acceptance before the reply can be lost.** A reconnecting client needs to recover the same submission, not guess whether to send another.
3. **Reconnect by cursor and stable request identity.** Catch up with committed events instead of recreating the turn.
4. **Keep interruption distinct from detachment.** A closed client and a dead worker do not imply the same recovery action.
5. **Record uncertain effects.** Silence is neither proof of failure nor proof of success.
6. **Bind completion to fresh evidence.** The model's final message can explain the outcome; it should not be the only thing establishing it.
7. **Separate locality, workspace access and coding authority.** They answer different questions and should not be represented by one convenient predicate.

The design test is simple: if closing, reconnecting or changing clients changes the identity of the work, the client still owns too much state.

We built Salaam so the window can disappear without taking the work's identity with it. Version 0.0.7 corrected one place where “coding session” had become shorthand for “local session.” The code change replaced one predicate. The boundary it restored is the reason the product exists.
