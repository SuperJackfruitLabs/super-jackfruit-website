---
title: The lab never closes
description: Super Jackfruit Labs is one person and a set of named AI agents building open tools for agent work, with identities, bounded authority and human gates.
date: 2026-09-28
draft: false
tags: [agents, infrastructure]
sources:
  - claim: Super Jackfruit Labs describes itself as a solo experimentation lab for AI agent infrastructure.
    url: https://github.com/SuperJackfruitLabs/.github/blob/main/profile/README.md
  - claim: superpipeline coordinates external agents through pipeline stages and human approval gates, with capability-based staffing and a traceable event log.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/main/README.md
  - claim: superpipeline was created on 20 June 2026 and is licensed under MIT.
    url: https://api.github.com/repos/SuperJackfruitLabs/superpipeline
  - claim: AgentPod is the fleet and facilities console for agent runtimes, despite the repository's stale GitHub description.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/main/README.md
  - claim: AgentPod models an agent as a principal acting on its own behalf, distinct from a human or service principal.
    url: https://docs.agentpod.dev/start/concepts/
  - claim: AgentPod gives each agent a Forgejo account and each provisioned station a node-held SSH key whose private half does not leave the node.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/9934f7561eecf2747f15934c659d7a98474875c0/apps/node-agent/internal/gitidentity/identity.go
  - claim: superpipeline approval gates can approve, request changes or reject, and the producing agent cannot resolve its own gate.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/a37327cde125833667b005d18f92f4261f7d74c3/apps/api/src/board/board-do.ts#L2109-L2163
  - claim: supermessage is an agent-aware Matrix client whose clients implement superpipeline gate decisions.
    url: https://github.com/SuperJackfruitLabs/supermessage/blob/main/README.md
  - claim: AgentPod can decrypt encrypted board-room events and pass parsed gate decisions to superpipeline.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/9934f7561eecf2747f15934c659d7a98474875c0/apps/hub/src/services/matrix-as/inbound.ts#L191-L231
  - claim: SuperMD is a native GPU-rendered Markdown editor that keeps plain CommonMark files on disk.
    url: https://github.com/SuperJackfruitLabs/supermd/blob/master/README.md
  - claim: The lab website is a public project catalogue and blog.
    url: https://github.com/SuperJackfruitLabs/super-jackfruit-website/blob/master/README.md
  - claim: The lab's previous post, The CLI that could not update itself, is live on its website.
    url: https://superjackfruit.com/blog/the-cli-that-could-not-update-itself/
---

*Super Jackfruit Labs is one person and a set of named AI agents. The agents do not replace the person, and the person does not pretend the agents work without supervision. The point is narrower: give software workers durable identities, bounded authority and work that survives the end of a chat window.*

Most claims about AI agents become less impressive as soon as a repository gets involved.

A model can produce a patch in a clean demo. Sustained work has harder edges: Who assigned it? Which checkout did it change? Who may push? What happens when another agent receives the card? Where does a person get to say no? If the answers are “the human’s shell, the human’s credentials and the human’s memory,” the agent is not much of an actor. It is a macro with a conversational interface.

[Super Jackfruit Labs](https://github.com/SuperJackfruitLabs/.github/blob/main/profile/README.md) exists to work on those edges. It is a solo experimentation lab for AI agent infrastructure: one person builds systems in which several agents can hold work, hand it off and leave an attributable record.

“The lab never closes” does not mean the agents run without limits or that a person watches them around the clock. It means work is not trapped in one interactive session. A card can wait. A different worker can pick up the next stage. A human gate can stop the line for as long as necessary. The record remains after every process involved has exited.

## What the lab builds

The public work is spread across a small set of repositories. Each has a plain job.

- [**superpipeline**](https://github.com/SuperJackfruitLabs/superpipeline) is the Kanban control plane: it moves cards through stages, routes them by declared capability and stops at human approval gates. It is MIT-licensed and was [created on 20 June 2026](https://api.github.com/repos/SuperJackfruitLabs/superpipeline).
- [**AgentPod**](https://github.com/SuperJackfruitLabs/agentpod) is the fleet and facilities plane: it manages the machines and workspaces where agent runtimes live. GitHub’s short repository description still calls it a mobile app for OpenCode; the current README describes the newer fleet, hub and console architecture.
- [**supermessage**](https://github.com/SuperJackfruitLabs/supermessage) is a Matrix client for rooms shared by people and agents, including structured approval controls for superpipeline gates.
- [**SuperMD**](https://github.com/SuperJackfruitLabs/supermd) is a native GPU-rendered Markdown editor that keeps CommonMark files on disk. It is a writing tool, not another layer in the agent control plane.
- [**This website**](https://github.com/SuperJackfruitLabs/super-jackfruit-website) is the lab’s public catalogue and notebook. It is where finished accounts such as [“The CLI that could not update itself”](/blog/the-cli-that-could-not-update-itself/) live.

There is private work too. It is not evidence. If a reader cannot inspect it, this post will not ask them to treat it as proof.

## A principal, not a borrowed login

The lab’s working distinction is between a macro and a teammate.

A macro borrows the operator’s identity. Its commits, API calls and remote access all appear to come from the person who invoked it. That can be convenient, but it destroys an important boundary: afterward, the system cannot reliably say which actor did what. Revoking the agent may also mean revoking the human.

A teammate has its own identity and a history attached to it. In AgentPod’s public model, a [principal](https://docs.agentpod.dev/start/concepts/) is “who is acting”; `human`, `agent` and `service` are separate kinds, and an agent principal acts on its own behalf. In superpipeline, agents receive scoped credentials, claim runs and encounter surfaces that remain human-only.

This does not make a language model a person. It makes authority legible. The useful properties are prosaic: separate credentials, narrow permissions, attributable actions and the ability to revoke one actor without revoking another.

AgentPod’s public implementation extends that boundary to source control. Each agent gets its own Forgejo account. Each provisioned station gets a separate SSH key, generated and retained on its node, so one station can be revoked without withdrawing the agent’s other stations or the human operator’s access.

Commit authorship and push authentication are different facts. Git author metadata identifies the author recorded in a commit; an SSH key authenticates a push to the forge. A GitHub mirror can show the former. It does not prove which key authenticated a push to a Forgejo server. The public trace for this post therefore needs to show the card history and resulting commit without pretending that GitHub proves a key exchange.

## How this page was made

This article travelled on a superpipeline board called **Press**. Its stages are:

`commission → brief → angle approved → draft → verify claims → publish approved → publish → published`

The two approval stages are refusal points. In superpipeline, a gate can be approved, returned for changes or rejected, and the agent that produced the work cannot resolve its own gate. AgentPod and supermessage implement the path for gate requests and decisions through encrypted Matrix rooms. Public source establishes that mechanism; this article is not itself proof that this card used it.

The card’s intended division of work names four agents, selected by declared capability rather than a hard-coded stage-to-name rule:

| Stage | Declared capability | Worker | Work |
| --- | --- | --- | --- |
| brief | `research` | `research-ray` | Gathered the public sources and wrote the editorial brief. |
| draft | `writing` | `writer-quill` | Turned the approved angle and brief into this article. |
| verify claims | `claim-check`, `analysis` | `analyst-echo` | Checked the factual claims against the public repositories and live site. |
| publish | `code` | `coder-kai` | Added the final file to the website repository, committed it and pushed it. |

The card is `card_1dd097d0939c46fb` on board `brd_6a899b0f0d054046`. The board holds the full record of its stages, workers and human decisions; that record is internal, and this article is a description of it rather than a substitute for it.

## What the human did

The human did not write this article, but the human was not absent.

A human wrote the card’s assignment. A human approved the angle before drafting began, then approved the checked article before publishing. Earlier, that human built the pipeline with an AI assistant. The agents researched, drafted, checked and shipped this page. They did not design the system carrying them for the purpose of this run.

That is the actual division of labour. It is less dramatic than “full autonomy,” and more useful.

The lab never closes because the work has somewhere to live between workers: a card, a repository, an identity and a record. The agents can continue when the person steps away. The person still owns the gates that matter. And when the page arrives, neither side has to borrow the other’s name.