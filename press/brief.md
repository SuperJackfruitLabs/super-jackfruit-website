# Brief — A review link should not move

## Assignment

Write one developer-facing article about [AgentPod PR #895](https://github.com/SuperJackfruitLabs/agentpod/pull/895), merged into the public repository on 16 November 2026. The change makes `agentpod_link_artifact` return a version-pinned SuperLibrary URL and tells agents to attach that URL to a card, so a review gate opens the artifact version that was actually handed off.

**Confidence:** high. The merged PR, commit-pinned changelog, implementation, documentation and regression test all describe the same behavior.

## Recommended headline

**A review link should not move**

Alternatives:

- **The artifact you approve should be the artifact you opened**
- **Mutable links do not belong in approval gates**

## One-sentence thesis

A workflow may keep a mutable “latest” URL for browsing, but any link used for approval, audit or handoff should identify an exact version; PR #895 turns that rule into the default output and instruction of AgentPod’s artifact-linking tool.

## Why an outside developer should care

This is a small API change with a broadly useful systems lesson. In a human-in-the-loop workflow, a link is part of the approval subject. If the same URL opens version 7 today and version 8 tomorrow, a reviewer can be shown different bytes from the ones the workflow originally asked them to approve. The version number belongs in the handoff, not only in storage metadata.

The concrete design is easy to reuse in other systems:

1. Keep the floating item URL for discovery and “show me the latest.”
2. Return a second URL that names the exact version just created.
3. Make the tool’s own response and documentation direct callers to use the pinned URL for approvals.
4. Test the full tool boundary, including both the returned value and the safety instruction.

**Primary audience:** developers building approval gates, agent workflows, MCP tools, document review systems or evidence pipelines.

## The shipped change

Before this change, the artifact-linking result exposed an item URL whose documented behavior is to open the latest version. PR #895 adds `versionUrl`, constructed as `<item URL>/v/<version>`, while retaining the floating `url`. It also changes the tool description, next-step message, MCP instructions and documentation to tell callers to attach `versionUrl`. A regression test drives the registered tool through an in-memory MCP client and checks both the pinned result and the instruction to use it.

The PR merged as [`a10ffca497bdda0e3de891c7d195510a009ad8c5`](https://github.com/SuperJackfruitLabs/agentpod/commit/a10ffca497bdda0e3de891c7d195510a009ad8c5) with 20 checks reported as passing on the public PR page.

## Suggested article structure

### 1. Open with the moving-target failure

Use a short example: an artifact is linked as version 7, someone revises it to version 8 before the gate is opened, and a floating item link now displays version 8. Storage retained both versions, but the approval request failed to identify which one was under review.

Keep this as an illustrative scenario, not a claim that a specific approval was wrongly granted.

### 2. Separate browsing identity from decision identity

Explain the two legitimate link semantics:

- `url`: stable identity for the item, intentionally following its latest version.
- `versionUrl`: stable identity for the particular revision just linked.

The first is convenient for browsing. The second is appropriate for gates, audit trails and handoffs. Neither URL replaces the other.

### 3. Show the small implementation

At the tool boundary, the implementation derives `versionUrl` from the returned item URL and version, includes it in the response, and changes `next` to say which value should be attached. The safety property is not left to downstream callers to rediscover.

### 4. Show why instructions are part of the interface

Returning a safer field is insufficient if examples and tool descriptions still steer callers toward the floating one. PR #895 updates the tool description, server instructions and public MCP documentation together. For agent-facing APIs, prose emitted alongside the schema affects which field is actually used.

### 5. Close with a reusable review rule

When a person’s decision is supposed to bind to a particular artifact, make the subject identifier immutable at that boundary. A practical review question: **“If this object changes after the request is created, will the same link show different content?”** If yes, the request needs a versioned identifier.

## Claims ledger

| Claim | Public evidence | Confidence / wording note |
|---|---|---|
| PR #895 was merged on 16 November 2026 and adds a version-pinned link to the artifact-linking tool. | [Merged PR #895](https://github.com/SuperJackfruitLabs/agentpod/pull/895) | High. Use “merged,” not “included in a numbered release”; the changelog entry is still under `Unreleased`. |
| The floating `url` opens the latest item version, while `versionUrl` identifies the version just linked using `/a/<item>/v/<n>`. | [Commit-pinned changelog, lines 13–17](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/CHANGELOG.md#L13-L17) and [public MCP docs, lines 44–47](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/docs-site/src/content/docs/build/mcp.md#L44-L47) | High. Call it version-pinned, not content-addressed or cryptographically immutable. |
| The implementation constructs `versionUrl` from the item URL and returned version, includes it in the tool result, and directs the caller to attach it. | [`tools.ts`, lines 194–204](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/src/mcp/tools.ts#L194-L204) | High. |
| The regression test says a floating URL could let a reviewer approve a different version and verifies the returned pinned URL plus the tool instruction. | [`exact-artifact-gate.test.ts`, lines 45–79](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/tests/unit/exact-artifact-gate.test.ts#L45-L79) | High. Describe this as a tested failure mode, not evidence of a past real-world approval incident. |
| The public PR reports 20 passing checks. | [Merged PR #895](https://github.com/SuperJackfruitLabs/agentpod/pull/895) | High at research time. This supports merge quality, not a claim of formal verification. |

## Guardrails

- Do not say the feature is in AgentPod v0.1.128. That release predates the merge; the relevant changelog entry is under `Unreleased`.
- Do not claim content-addressed storage, tamper-proof records, signatures or cryptographic immutability. The shipped change adds a version-addressed route.
- Do not imply the floating item URL is defective. It is useful when “latest” is the intended behavior.
- Do not claim PR #895 changes SuperLibrary’s versioning model or SuperPipeline’s gate renderer. It changes the AgentPod tool result and the instructions about which existing link form to attach.
- Do not invent a customer incident. The moving-target example should be explicitly illustrative.
- Keep the piece centered on this one merged change. Other artifact-versioning work is unnecessary to explain the lesson.

## Blog-overlap check

The repository currently contains ten published articles. None discusses version-pinned artifact links, `versionUrl`, mutable review subjects or PR #895. The nearest pieces are [“AgentPod: a console for the machines your agents live on”](https://github.com/SuperJackfruitLabs/super-jackfruit-website/blob/master/src/content/blog/agentpod-a-console-for-the-machines-agents-live-on.md), which is a product overview, and [“The suite, explained”](https://github.com/SuperJackfruitLabs/super-jackfruit-website/blob/master/src/content/blog/the-suite-explained.md), which mentions SuperLibrary at a high level. This article should avoid repeating either overview and go directly to the approval-link design lesson.

A SuperLibrary search of this board found no other open article card with a competing topic at research time. Recent published topics to avoid duplicating include durable agent sessions, advisory AI review, retry loops, event-plus-sweep reliability and product introductions.

## Public source list

1. [AgentPod PR #895 — `link_artifact` returns a version-pinned link](https://github.com/SuperJackfruitLabs/agentpod/pull/895)
2. [Merge commit `a10ffca497bdda0e3de891c7d195510a009ad8c5`](https://github.com/SuperJackfruitLabs/agentpod/commit/a10ffca497bdda0e3de891c7d195510a009ad8c5)
3. [Commit-pinned changelog entry](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/CHANGELOG.md#L13-L17)
4. [Commit-pinned implementation](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/src/mcp/tools.ts#L194-L204)
5. [Commit-pinned regression test](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/tests/unit/exact-artifact-gate.test.ts#L45-L79)
6. [Commit-pinned MCP documentation](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/docs-site/src/content/docs/build/mcp.md#L44-L47)

## Research gaps

No material source gap blocks drafting. The only deployment boundary is important: the evidence proves a public merge to `main`, not inclusion in a numbered AgentPod release. Frame the article as a newly merged change and avoid release-version language.
