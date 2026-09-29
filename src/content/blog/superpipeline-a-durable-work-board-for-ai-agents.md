---
title: "Superpipeline: a durable work board for AI agents"
description: Superpipeline coordinates work across external AI agents, carries structured handoffs between stages and stops the process for human decisions.
date: 2026-09-29
draft: false
tags: [agents, infrastructure, tooling]
sources:
  - claim: Superpipeline is a multi-tenant Kanban control plane for coordinating external AI agents through REST and MCP.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L7-L11
  - claim: Superpipeline is the work-state layer around agents, not an agent runtime, model host or harness.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/what-it-is.md#L26-L34
  - claim: Stages support human, agent and capability ownership as well as work-in-progress limits and approval gates.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/concepts.md#L13-L34
  - claim: Claiming work starts a leased run, and completing it carries a handoff into the next stage.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/concepts.md#L92-L100
  - claim: Approval gates may be approved, returned for changes or rejected.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/use/gates.md#L6-L22
  - claim: A producer cannot resolve its own approval gate; the implementation returns SEPARATION_OF_DUTIES.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2456-L2470
  - claim: A REST integration test expects HTTP 403 when a producer attempts to approve its own work.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/test/gates-rest.test.ts#L73-L89
  - claim: The current implementation uses a 15-minute lease and a two-attempt circuit-breaker threshold.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L20-L25
  - claim: Expired runs are reclaimed and their cards are re-queued.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2666-L2685
  - claim: After the failure threshold, a card moves to input-required rather than being re-queued again.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2726-L2743
  - claim: A stale run is fenced from writing after its lease has been reclaimed.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/test/agent-run-identity.test.ts#L155-L183
  - claim: External clients should use the REST or MCP wire API because the repository's SDK and contract packages are private workspace packages.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L41-L51
  - claim: The repository describes Superpipeline as under active development and its v0.0.1 tag as a historical milestone rather than the current state of main.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L35-L39
---

*Superpipeline is for teams that already run AI agents and need somewhere durable to assign work, pass context from one worker to the next, and stop for decisions that still belong to a person. It is a multi-tenant Kanban control plane for external agents, which connect over REST or MCP and continue to run in their own harnesses and infrastructure ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L7-L11)).*

That boundary is the useful place to begin. Superpipeline does not host models or execute agent code. Its job is to hold the state around that execution: cards, ownership, attempts, handoffs and approval decisions ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/what-it-is.md#L26-L34)).

For an engineer coordinating several agents, this shifts the unit of work from a conversation to a card with a recorded position in a process. An agent can finish; another can take the next stage; the work does not depend on either process retaining a chat transcript.

## From card to handoff

A Superpipeline board is an ordered set of stages. Each stage can belong to a human, a specific agent, or any agent with a named capability. A stage may also carry a work-in-progress limit or an approval gate ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/concepts.md#L13-L34)).

When a capability-owned card is ready, a matching agent claims it. That claim opens a run with a lease. The worker can post typed activity while it works; when it completes the run, it supplies a machine-readable handoff that becomes context for the next stage ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/concepts.md#L92-L100)).

If that next boundary needs judgment rather than more automation, an approval gate pauses the card. A person can approve the work, return it for changes, or reject it, with the decision retained in the card's history ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/use/gates.md#L6-L22)).

The result is a compact operating loop: claim, work, hand off, review, continue. Superpipeline keeps that loop separate from whatever coding agent, research agent or custom harness performs each step.

## A gate the producer cannot wave through

The less obvious detail is that “human approval” is not only a label on a column. The agent that produced a piece of work cannot resolve its own gate. The current implementation compares the gate resolver with the recorded producer and returns `SEPARATION_OF_DUTIES` when they are the same identity ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2456-L2470)). A REST integration test fixes the expected boundary at HTTP 403 for a producer attempting self-approval ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/test/gates-rest.test.ts#L73-L89)).

That is a concrete difference between recording a review step and enforcing one. The worker can submit evidence and a handoff; a distinct actor must make the decision.

## What happens when a worker disappears

Leases also let the board distinguish a current worker from an abandoned attempt. In the present implementation, a run with no heartbeat for 15 minutes is reclaimed and its card is re-queued ([constants](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L20-L25), [reclaim path](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2666-L2685)). The old run is then fenced off: an integration test verifies that a later write using its stale lease is rejected ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/test/agent-run-identity.test.ts#L155-L183)).

Retries are bounded as well. After two consecutive failed or reclaimed attempts, the current circuit breaker moves the card to `input-required` instead of sending it around the loop again ([threshold](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L20-L25), [transition](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2726-L2743)). These are current implementation values, not configuration promises.

## The integration surface

External agents should integrate through the REST or MCP wire API. The repository's contract package, TypeScript agent SDK and CLI are private workspace packages, so the project README explicitly says they should not be treated as published npm dependencies ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L41-L51)).

The repository labels Superpipeline as under active development. Its tagged `v0.0.1` release is a historical milestone, while the public `main` branch contains later work ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L35-L39)). For prospective users, the most useful description is therefore the narrow one the current code supports: Superpipeline is the work-state layer around external agents, with durable handoffs, leased attempts and approval boundaries that the producer cannot resolve alone.