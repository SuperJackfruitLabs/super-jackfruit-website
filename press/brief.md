# Brief: introduce Superpipeline

## Project chosen, and why

**Pick: [Superpipeline](https://github.com/SuperJackfruitLabs/superpipeline).**

This is the project I can evidence most cleanly from public material. Its repository has a current product README, task-oriented user documentation, implementation code, behaviour-level tests, and tagged releases; together they let the next writer distinguish what the software does now from design intent. The README itself warns that release notes and roadmap phases are not a complete account of the current app and points integrators to the current contract and source, so the article should follow that evidence hierarchy rather than paraphrase a roadmap. [[README, status and integration boundaries](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L35-L54)]

It also fits the commissioned audience directly: Superpipeline coordinates **external** AI agents while leaving each agent in its own harness and infrastructure. [[README, opening definition](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L7-L11)]

## Recommended opening: purpose first

Lead with this idea, not the Cloudflare architecture:

> **Superpipeline is for teams that already run AI agents and need a durable board for assigning their work, moving it through a repeatable process, and stopping at decisions that still belong to a person.** It is a multi-tenant Kanban control plane, not an agent runtime: agents keep running in their own harnesses and connect to the board over REST or MCP. [[README, opening definition](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L7-L11)] [[User docs, “What it is not”](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/what-it-is.md#L26-L34)]

That answers “what is it for?” before explaining its mechanics. Avoid opening with “Kanban for agents” alone; that phrase does not tell a new reader why an agent-specific board is useful.

## The shortest accurate explanation of how it works

A board is an ordered pipeline of stages. A stage can be assigned to a person, to one named agent, or to any agent holding a named capability; a work-in-progress limit and an approval gate can also be attached to the stage. [[User docs, stage model](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/concepts.md#L13-L34)]

When a capability-owned card is ready, a matching agent claims it. The claim starts a run and returns a lease; while working, the agent can post typed activity and must keep the lease alive. On completion, the card advances with a machine-readable handoff that becomes context for the next stage’s agent. [[User docs, how the model fits together](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/concepts.md#L92-L100)] [[Implementation, claim and handoff return](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2169-L2277)]

If the next stage has an approval gate, the card waits for a person. That person can approve it, return it for changes, or reject it; the decision and any comment become part of the card’s history. [[User docs, approval-gate outcomes](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/use/gates.md#L6-L22)]

## Concrete detail the name does not give away

Use **separation of duties** as the memorable example:

> The agent that produced work cannot approve its own gate. Superpipeline compares the resolver with the recorded producer and returns a `SEPARATION_OF_DUTIES` error when they are the same identity. A REST integration test pins the behaviour by expecting HTTP 403 when the producer attempts self-approval. [[Gate implementation](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2456-L2470)] [[Gate test](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/test/gates-rest.test.ts#L73-L89)]

That is more informative than merely saying “human-in-the-loop”: the gate is enforced as a second-party decision rather than presented as a UI convention.

A second useful engineering detail, if space allows, is lease fencing. A run with no heartbeat for 15 minutes is reclaimed and its card is re-queued; a later write from the old run is rejected as `STALE_LEASE`. After two consecutive failed or reclaimed attempts, the card moves to `input-required` instead of continuing to cycle. These values are current hard-coded constants, not operator-tunable promises. [[Current constants](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L20-L25)] [[Reclaim implementation](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2666-L2685)] [[Circuit-breaker implementation](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/src/board/board-do.ts#L2726-L2743)] [[Stale-run integration test](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/apps/api/test/agent-run-identity.test.ts#L155-L183)]

## Suggested article spine

1. **The problem:** once several agents work across a process, “did the model answer?” is less useful than “who owns this card, which attempt is current, what evidence moved forward, and where must a person decide?”
2. **The product:** a Kanban-style control plane for external agents, not a harness or model host. Cite the opening README definition.
3. **One end-to-end flow:** a capability-matched agent claims a card; the board records its run and activity; completion carries a structured handoff; a human gate may stop the card; the next agent resumes from the handoff. Cite the concepts page and current claim implementation.
4. **The non-obvious mechanism:** self-approval is refused. If the piece has room, add stale-lease fencing and the two-attempt circuit breaker.
5. **Practical integration boundary:** agents connect over REST or MCP, while the repository’s internal contract package, agent SDK, and CLI are private workspace packages rather than published npm dependencies. External clients should use the wire API. [[README, integration boundary](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L41-L51)]
6. **Status sentence, without hype:** the repository labels the project “Active development”; its tagged `v0.0.1` release is described as the first historical milestone, and `main` contains later work. [[README, status](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L35-L39)]

## Claims to avoid or qualify

- Do not call Superpipeline an agent framework, execution runtime, or model host; the public docs explicitly define it as the work-state layer around external agents. [[User docs, “What it is not”](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/start/what-it-is.md#L26-L34)]
- Do not imply capability routing is semantic or fuzzy. The current match is exact string equality, with explicit implication rules available to widen an agent’s effective capability set. [[User docs, routing and implications](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/docs-site/src/content/docs/use/agents.md#L6-L37)]
- Do not present the repository’s internal SDK or contract package as installable dependencies; the README says both are private workspace packages. [[README, package boundary](https://github.com/SuperJackfruitLabs/superpipeline/blob/64132a35ae2b362a1b36cd1e4a31cfdb0de23e26/README.md#L41-L48)]
- Do not pull planned behaviour from roadmap/spec files into present tense. Prefer the README, user docs, current implementation, and tests linked above.
- Do not compare the project with named competitors; the commission does not require a category ranking.

## Tone and length

Aim for a compact engineer-to-engineer introduction: roughly 600–900 words if the next stage wants a full article, shorter if it keeps only one reliability detail. Use “control plane,” “claim,” “lease,” “handoff,” and “gate” only after the opening has established the job the product does. No “revolutionary,” “seamless,” “best,” or unsupported scale claims.
