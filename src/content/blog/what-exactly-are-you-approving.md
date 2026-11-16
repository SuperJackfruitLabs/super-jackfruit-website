---
title: What exactly are you approving?
description: A trustworthy approval binds the decision to evidence from the run under review and to the exact version the reviewer opened.
date: 2026-11-16
draft: false
tags: [agents, engineering, human-in-the-loop]
sources:
  - claim: On the same station, AgentPod gives a titled artifact on a card a stable logical source path, so linking a renamed revision under the same title creates the next version of the same item.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/889
  - claim: AgentPod's regression test links two differently named files under one title and requires the second link to return the original item at version 2.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.test.ts#L108-L175
  - claim: SuperPipeline checks a stage's reference requirement against the completing run's references while allowing explicit person-added references.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/run-verbs.ts#L280-L292
  - claim: SuperPipeline attributes an agent-added reference to the authenticated run rather than accepting attribution from the request body.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/references.ts#L41-L45
  - claim: AgentPod's artifact-linking tool returns both a floating item URL and the version-pinned URL created by that link operation.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/src/mcp/tools.ts#L194-L204
  - claim: SuperPipeline gate payloads select references from the opening run.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/api/src/board/gates.ts#L681-L687
  - claim: SuperPipeline web gates pin known SuperLibrary versions and render an explicit empty state.
    url: https://github.com/SuperJackfruitLabs/superpipeline/blob/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/web/src/lib/components/card/gate/GateReferences.svelte#L19-L63
  - claim: Treaty gate prose lists the opening run's linked artifacts or states that the run linked no artifact.
    url: https://github.com/SuperJackfruitLabs/treaty/commit/855d57d05c66f54d3e3fcb9e1702f6b1abf1260c
  - claim: Treaty validates and escapes gate references before rendering them into Markdown room messages.
    url: https://github.com/SuperJackfruitLabs/treaty/commit/d832f606f83b5d6963aa7e56009b4e5cb6dc244a
  - claim: The Treaty gate-prose and hardening changes shipped in Treaty v0.0.14.
    url: https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.14
  - claim: SuperExchange now consumes treaty-matrix-events 0.0.14, carrying the new gate prose into its room-message path.
    url: https://github.com/SuperJackfruitLabs/superexchange/commit/fb328cf0bcc0284a3e449e6b3e23c9f458cbbce1
---

A file was revised and linked again under a new filename. Instead of appearing as version 2 of the artifact already handed off, it became a second item at version 1.

Nothing had gone wrong with version storage. The system had lost track of the more basic fact that both files represented the same logical deliverable. For a reviewer, that difference is decisive. A version history cannot support an approval if the revision quietly leaves that history.

The regression behind [AgentPod PR #889](https://github.com/SuperJackfruitLabs/agentpod/pull/889) is a small example of a broad problem in human-in-the-loop systems: **what exact evidence does an approval approve?**

A useful answer needs two coordinates. The evidence must belong to the attempt under review, and the link must identify the revision that attempt handed off. Recent changes across AgentPod, SuperPipeline, Treaty and SuperExchange carry those coordinates from artifact creation through completion checks, the web gate and the room message.

## Identity comes before versioning

The AgentPod regression test uses two files: `docs-voice-pass-spec.md` and `docs-voice-pass-spec-v2.md`. Both are linked from the same card under the same explicit artifact title. The test requires the second result to return the first item's id and URL, now at version 2 ([source](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.test.ts#L108-L175)).

Previously, the workspace filename contributed the upload's source identity. Renaming the file therefore made the revision look like a new object. The fix gives a titled artifact on a card a stable source path based on the card and encoded title: `artifacts/<card>/<encoded title>` ([implementation](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.ts#L338-L356)).

That is a logical identity, not a content hash. Change the title and you name a different item. On the same station, keep the card and title, and a renamed working file can remain the next revision of the same deliverable. A different station still starts a new item because the station remains part of SuperLibrary's matching key ([documented limit](https://github.com/SuperJackfruitLabs/agentpod/pull/889)).

The distinction matters anywhere files pass through temporary workspaces. A pathname describes where a worker happened to write something. It does not necessarily describe what the artifact means to the workflow. If reviewers approve logical deliverables, the storage identity needs to preserve that meaning before version numbers can do useful work.

## An approval subject has two coordinates

Stable artifact identity solves only the first boundary. A workflow can still put the wrong evidence in front of a reviewer.

Imagine a card that has already gone through one attempt. That attempt linked an artifact, failed review and returned for revision. If the next attempt links nothing, a card-wide query may still find the old reference. The workflow can appear complete even though the current attempt did not hand off evidence.

A [SuperPipeline change](https://github.com/SuperJackfruitLabs/superpipeline/commit/9a4b9989a7a18bfd6614168fb8ea660a630e7a98) now associates an agent-added reference with the authenticated run. When a stage requires a reference, completion checks references from the run that is completing. A person-added reference remains valid as an explicit intervention, but an artifact left by an earlier agent run no longer silently satisfies the current one.

The attribution is derived at the server boundary rather than accepted as a caller's claim. The run-reference path supplies `addedBy: 'agent'` and the current `runId` itself ([source](https://github.com/SuperJackfruitLabs/superpipeline/blob/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/references.ts#L41-L45)). Provenance is only useful if the party submitting a reference cannot rewrite it in the request body.

That gives us the first coordinate: **which attempt produced this evidence?**

The second coordinate is the revision. AgentPod's artifact-linking tool now returns two related URLs:

- `url` names the logical item and opens its latest version;
- `versionUrl` names the version created by this link operation.

Both are useful. The floating URL is right for “show me the latest state of this document.” It is the wrong choice for “show me what was reviewed in this decision.” The tool therefore keeps the floating URL while directing workflow callers to attach the version-pinned one ([implementation](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/src/mcp/tools.ts#L194-L204)).

Together, run provenance and version identity define the approval subject: **the artifact linked by this attempt, at the revision this attempt handed off.** Neither coordinate is sufficient alone. A pinned link from the wrong run is stale evidence. A current-run link that floats to the latest version can show content that changed after the gate opened.

## Follow the same evidence to every decision surface

A trustworthy subject cannot exist only in an API response. People make decisions in interfaces, and every interface can accidentally widen or erase the binding.

SuperPipeline's web gates now load the references associated with the run that opened the gate ([API query](https://github.com/SuperJackfruitLabs/superpipeline/blob/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/api/src/board/gates.ts#L681-L687)). For a known SuperLibrary item with version metadata, the renderer constructs the version-specific route and displays the version alongside the artifact. If the run linked nothing, the gate says: **“This run linked no artifact.”** ([renderer](https://github.com/SuperJackfruitLabs/superpipeline/blob/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/web/src/lib/components/card/gate/GateReferences.svelte#L19-L63)).

That empty state is part of the evidence model. Silence is ambiguous: perhaps there is no artifact, perhaps the interface failed to load it, or perhaps the workflow never expected one. An explicit statement tells the reviewer what the system knows. “No artifact” may be a reason to reject the work, request a missing deliverable or decide that this gate does not need one. In every case, absence is review information rather than unused space.

The room message needs the same subject. A Treaty change extends the gate-delivery contract so the prose can list each run-linked artifact as a Markdown link, with the URL as a fallback when no title is available. An empty list produces the same explicit sentence: “This run linked no artifact.” Older deliveries without the new field remain compatible ([change](https://github.com/SuperJackfruitLabs/treaty/commit/855d57d05c66f54d3e3fcb9e1702f6b1abf1260c)).

Rendering references into chat also creates an input boundary. A follow-up Treaty change handles a malformed non-list as absent, skips unusable entries, accepts only HTTP or HTTPS URLs, percent-encodes URL characters that Markdown would interpret and escapes titles ([change](https://github.com/SuperJackfruitLabs/treaty/commit/d832f606f83b5d6963aa7e56009b4e5cb6dc244a)). The goal is narrow but important: evidence displayed for a decision should not become a route for adding a deceptive second Markdown link or crashing the message builder.

Those Treaty changes shipped in [v0.0.14](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.14). [SuperExchange has moved its consumer to `treaty-matrix-events` 0.0.14](https://github.com/SuperJackfruitLabs/superexchange/commit/fb328cf0bcc0284a3e449e6b3e23c9f458cbbce1), carrying the artifact list and explicit empty state into the application that sends the room message.

The release boundary is worth stating precisely. The Treaty changes are in a numbered release. The related AgentPod, SuperPipeline and SuperExchange changes are merged into their default branches but are not all in numbered product releases. This is a merged cross-repository design thread with one released package boundary—not a claim that the entire suite shipped under one version.

## Prose is part of the interface

Two implementation details in this thread look secondary but are part of the contract.

First, attribution must follow authentication. A field named `runId` in a request is not provenance if the caller can set it freely. The server has to derive the run from the authorized call path and record that identity with the reference.

Second, agent-facing descriptions and result text matter alongside schemas. Adding `versionUrl` to a tool does not help if callers continue attaching `url` because it is familiar or listed first. The tool's description, response and next-step wording all need to distinguish “latest item” from “revision produced now.” For an automated caller, that prose is operational guidance.

This is a general lesson for APIs used by agents. A human developer may notice a new field in generated types, inspect the docs and infer its purpose. An agent is more likely to follow the tool description in front of it. If correct behavior depends on choosing one of two valid identifiers, the interface has to explain the decision at the moment of use.

## A practical review test

The changes suggest a compact checklist for any system that asks a person to approve generated work, a deployment, a document or a model output:

1. **Does a revision preserve logical identity?** A renamed file should not become a new deliverable unless the workflow means it to.
2. **Is the evidence scoped to the attempt under review?** An earlier attempt's artifact should not silently complete the current one.
3. **Does the link pin the reviewed revision?** Opening the same approval request later should not reveal different content merely because a newer version exists.
4. **Do all decision surfaces show the same subject?** API, web, email and chat should not disagree about which evidence belongs to the gate.
5. **Is absence explicit?** A reviewer should be able to distinguish “no evidence was linked” from a sparse or broken interface.
6. **Is provenance derived from authority?** The system should record who or what added evidence from authenticated context, not untrusted attribution fields.
7. **Can the evidence renderer handle hostile input?** Links and titles need validation appropriate to the output format.

None of this makes an artifact immutable, content-addressed or tamper-proof. A version-pinned route is a precise identifier within the application's version model, not a cryptographic claim. The important property is more modest: the decision surface keeps naming the same recorded revision from the same attempt.

Approval is often implemented as a verb: approve or reject. But the hard part is the noun that follows it. Approve **what**?

A durable answer is not “the card,” “the latest file,” or “whatever the gate happens to render.” It is the evidence produced by the attempt under review, at the versions that attempt handed off—and an explicit statement when there is no evidence at all.
