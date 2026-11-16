# Brief — What exactly are you approving?

## Recommendation

Write the article. Treat the shipped work as one cross-repository thread, not as a story about a single new field.

The thread answers one developer-facing question: **when a workflow asks a person to approve work, what exact evidence is the decision attached to?** The answer now converges across completion checks, artifact identity, version-pinned links, the web gate and the room message: the artifacts linked by the run under review, at the versions that run handed off. If the run linked none, the reviewing surfaces say so instead of silently presenting stale evidence or an empty-looking gate.

**Confidence:** high. The six merged public pull requests, commit-pinned code and regression tests, and the Treaty v0.0.14 release all agree on the behavior. The release boundary is also clear: the Treaty pieces are in a numbered release; the AgentPod and SuperPipeline pieces are merged to their default branches but are not in numbered releases.

## Recommended headline

**What exactly are you approving?**

Alternatives:

- **An approval should name its evidence**
- **The artifact in the gate should be the artifact from the run**
- **A review link should name both the run and the version**

## One-sentence thesis

An approval gate is trustworthy only when it identifies both **which run produced the evidence** and **which version of that evidence the reviewer opened**; six recent changes carry that invariant from artifact linking through API completion, the web gate and the room message.

## Why an outside developer should care

This is a reusable design pattern for human-in-the-loop systems, CI promotion, document review, agent workflows and audit trails. Versioned storage alone is not enough. A system also has to preserve logical identity across revisions, associate evidence with the attempt that produced it, pin the reviewed revision, and render the same subject on every decision surface.

The failure modes are subtle:

- a revised file can become a second item because its filename changed;
- an artifact left by an earlier attempt can accidentally satisfy the current attempt's completion rule;
- a floating item URL can open a later version than the one handed off;
- one review surface can show the evidence while another omits it;
- a gate with no evidence can look merely sparse rather than explicitly incomplete.

The shipped thread addresses each boundary rather than assuming that one version field fixes the workflow end to end.

## Open with the real failure

Do not invent a “version 7 became version 8” anecdote. Use the failure captured in [AgentPod PR #889](https://github.com/SuperJackfruitLabs/agentpod/pull/889) and its regression test.

A file was revised and linked again under a new filename. SuperLibrary identifies an agent upload using its source identity, so the changed path started a second item at version 1 instead of producing version 2 of the item already handed off. The revision therefore did not appear as the next version of the evidence a reviewer expected to see.

The regression test makes this concrete with `docs-voice-pass-spec.md` and `docs-voice-pass-spec-v2.md`. It links both under the same artifact title and requires the second result to have the same item id and URL as the first, at version 2: [commit-pinned test, lines 108–175](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.test.ts#L108-L175).

The fix gives a titled artifact on a card a stable source path, `artifacts/<card>/<encoded title>`, rather than using the workspace filename: [commit-pinned implementation, lines 338–356](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.ts#L338-L356). Be precise about the boundary: the logical identity is card plus title on the same station; it is not a content hash, and changing the title still names a different logical item.

## The shipped thread, in narrative order

### 1. Preserve the artifact's logical identity across a renamed revision

[AgentPod PR #889](https://github.com/SuperJackfruitLabs/agentpod/pull/889) makes a revised, renamed file become the next version of the same SuperLibrary item when the card and explicit title are unchanged. The implementation uses `artifacts/<card>/<encoded title>` as the upload's source path. The regression test proves that the renamed second file returns the first item's id and URL at version 2.

This establishes **what the artifact is** across revisions.

### 2. Make completion depend on evidence from this run

[SuperPipeline PR #106](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/pulls/106) records the producing run on a run-linked reference and evaluates a stage's reference requirement against references from the completing run, while still allowing a person-added reference as an explicit intervention. An artifact left on the card by an earlier run no longer makes revised work look complete.

The API also derives attribution from the authenticated call path: the run-reference function supplies `addedBy: 'agent'` and the current `runId`; those values are not accepted from the request body. Cite the [commit-pinned attribution code](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/references.ts#L41-L45) and the [current-run completion query](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/run-verbs.ts#L280-L292).

This establishes **which attempt produced the evidence** and prevents caller-supplied provenance from rewriting that answer.

### 3. Return the exact version that should be attached

[AgentPod PR #895](https://github.com/SuperJackfruitLabs/agentpod/pull/895) adds `versionUrl` to `agentpod_link_artifact`, formed as `/a/<item>/v/<n>`, while retaining the floating item `url`. The tool description, result text, MCP instructions and public documentation all direct callers to attach the pinned URL to the workflow.

The distinction is intentional:

- `url` is the logical item and opens its latest version;
- `versionUrl` is the revision created by this link operation.

The full-boundary regression test drives the registered tool through an in-memory MCP client and checks both the pinned result and the instruction to attach it: [commit-pinned test, lines 45–79](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/tests/unit/exact-artifact-gate.test.ts#L45-L79). The implementation is [commit-pinned here](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/src/mcp/tools.ts#L194-L204).

This establishes **which revision the handoff means**.

### 4. Put the run's exact evidence on the web gate

[SuperPipeline PR #111](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/pulls/111) adds the opening run's references to gate payloads and renders them in every web gate and Operate layout. It selects references by the gate's run, upgrades a known SuperLibrary item-plus-version to `/a/<item>/v/<n>`, displays the version, and says **“This run linked no artifact”** when the list is empty.

Use the [commit-pinned run-scoped gate query](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/api/src/board/gates.ts#L681-L687) and [web renderer](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/web/src/lib/components/card/gate/GateReferences.svelte#L19-L63).

This makes the web decision surface answer plainly: **these are the artifacts from the run you are judging, at these versions**.

### 5. Carry the same subject into the room message, safely

[Treaty PR #41](https://forge.superjackfruit.com/SuperJackfruitLabs/treaty/pulls/41) extends the gate delivery contract and prose builder so a board-room gate message lists each run-linked artifact as `- [title](url)`, falling back to the URL for a missing title. An empty list says **“This run linked no artifact.”** Deliveries without the new field remain backward-compatible.

[Treaty PR #42](https://forge.superjackfruit.com/SuperJackfruitLabs/treaty/pulls/42) hardens that feature before release. The tests found that malformed `references` could throw and that crafted Markdown could add a link. The fix treats a non-list as absent, skips unusable entries, permits only HTTP(S) URLs, percent-encodes Markdown-significant URL characters and escapes titles. This matters because the evidence shown to a reviewer must not become a second injection surface.

Both changes shipped in [Treaty v0.0.14](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.14).

This gives the chat decision surface the same answer as the API and web gate, without trusting reference text as formatting instructions.

## Suggested article structure

### 1. The revision that became a different artifact

Tell the PR #889 regression exactly: same logical deliverable, revised filename, accidental second item at version 1. Explain why versioning cannot help if logical identity changes first.

### 2. An approval subject has two coordinates

Introduce the two dimensions:

1. **Run provenance:** did this attempt produce or explicitly receive this reference?
2. **Version identity:** which exact revision did the attempt hand off?

Use PR #106 for the first coordinate and PR #895 for the second. Neither alone is sufficient.

### 3. Follow the evidence to every decision surface

Trace the same subject through:

- stage completion and gate payloads;
- the web gate;
- the room message.

Use PR #111 and Treaty PRs #41–#42. Emphasize the explicit empty state. “No artifact” is review information, not a cosmetic placeholder.

### 4. Explain why attribution and prose are part of the interface

Two details deserve attention:

- the server derives who linked a reference from the authenticated caller instead of believing request fields;
- an agent-facing API must update its descriptions and next-step text as well as its schema, because those words determine which URL callers actually attach.

### 5. Close with the reusable rule

Use this rule across API, web and chat surfaces:

> A decision surface should render the evidence produced by the attempt under review, using identifiers pinned to the exact revisions, and should state explicitly when there is no evidence.

Practical review questions:

- Could an earlier attempt's artifact satisfy this attempt?
- If a file is renamed, does it remain the same logical deliverable or silently become a new item?
- If the artifact changes after the request is created, will the same approval link open different content?
- Do all approval surfaces show the same run-scoped evidence?
- Does an empty evidence set say so explicitly?
- Is provenance derived from authentication, or can the caller claim who added the reference?

## Release status

- **SuperPipeline #106:** merged to `main` on 15 November 2026; recorded under `Unreleased`, not in a numbered SuperPipeline release.
- **AgentPod #889:** merged to `main` on 15 November 2026; not in a numbered AgentPod release.
- **AgentPod #895:** merged to `main` on 16 November 2026; its changelog entry is under `Unreleased`, not in a numbered AgentPod release.
- **SuperPipeline #111:** merged to `main` on 16 November 2026; recorded under `Unreleased`, not in a numbered SuperPipeline release.
- **Treaty #41 and #42:** merged to `main` on 16 November 2026 and included in the numbered [Treaty v0.0.14 release](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.14), published the same day.

Use **“merged”** for the AgentPod and SuperPipeline pieces. Do not describe the entire cross-product thread as released just because the Treaty contract package has a numbered release.

## Claims ledger

| Claim | Public evidence | Confidence / wording note |
|---|---|---|
| A renamed revision previously selected a new source identity; #889 gives a titled card artifact the stable source path `artifacts/<card>/<encoded title>`. | [PR #889](https://github.com/SuperJackfruitLabs/agentpod/pull/889), [implementation](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.ts#L338-L356) | High. Say “stable logical source path,” not content-addressed identity. |
| The #889 regression links renamed files with the same title and requires the second link to return the first item at version 2. | [Regression test](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.test.ts#L108-L175) | High. This is the real tested failure; do not replace it with an invented incident. |
| Completion accepts current-run references, plus a person-added reference as an explicit intervention, rather than stale references from earlier runs. | [SuperPipeline PR #106](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/pulls/106), [completion query](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/run-verbs.ts#L280-L292) | High. Do not simplify this to “only agents' current-run references”; person-added references remain valid. |
| Run-reference attribution is derived by the authenticated run path rather than accepted from request input. | [Attribution code](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/9a4b9989a7a18bfd6614168fb8ea660a630e7a98/apps/api/src/board/references.ts#L41-L45) | High. |
| `agentpod_link_artifact` returns both a floating item URL and a version-pinned `versionUrl`, and directs callers to attach the latter. | [AgentPod PR #895](https://github.com/SuperJackfruitLabs/agentpod/pull/895), [implementation](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/src/mcp/tools.ts#L194-L204), [test](https://github.com/SuperJackfruitLabs/agentpod/blob/a10ffca497bdda0e3de891c7d195510a009ad8c5/apps/hub/tests/unit/exact-artifact-gate.test.ts#L45-L79) | High. Call it version-pinned, not immutable or content-addressed. |
| Web gates show the opening run's references, pin known SuperLibrary versions and display an explicit empty state. | [SuperPipeline PR #111](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/pulls/111), [gate query](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/api/src/board/gates.ts#L681-L687), [renderer](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/src/commit/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f/apps/web/src/lib/components/card/gate/GateReferences.svelte#L19-L63) | High. “Known” matters: the renderer can pin an item URL when version metadata exists. |
| Room-message gate prose lists the run's artifacts or says none were linked. | [Treaty PR #41](https://forge.superjackfruit.com/SuperJackfruitLabs/treaty/pulls/41) | High. Backward compatibility is preserved when the field is absent. |
| Malformed or hostile reference data is ignored or safely rendered instead of throwing or injecting another Markdown link. | [Treaty PR #42](https://forge.superjackfruit.com/SuperJackfruitLabs/treaty/pulls/42) | High. Describe the concrete validation and escaping, not a general claim that all message content is safe. |
| The two Treaty changes are in a numbered release. | [Treaty v0.0.14](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.14) | High. This release status does not extend to the AgentPod or SuperPipeline changes. |

## Guardrails

- Do not call the URLs or artifacts **immutable**, **content-addressed**, **tamper-proof**, signed or cryptographically bound. The relevant route is version-addressed.
- Do not imply the floating item URL is defective. It is correct for “show me the latest”; it is wrong only when a decision is supposed to bind to one revision.
- Do not claim one PR delivered the whole invariant. The point of the article is that identity, provenance, pinning and presentation were separate failure boundaries.
- Do not claim a real approval was wrongly granted. The real failure was a renamed revision becoming a separate item; the approval consequences are why the regression mattered.
- Do not say every piece is in a numbered release. Only Treaty #41 and #42 are in v0.0.14.
- Do not say the stable source path uses the file's path. It deliberately uses `artifacts/<card>/<encoded title>` when a card and title are present.
- Do not omit the explicit “This run linked no artifact” state. Absence is part of the approval subject.
- Do not name people, internal roles, private systems or work-tracking identifiers from PR descriptions. Tell the story from the public behavior, code and tests.
- Do not cite or describe unmerged downstream work. The article is about what had shipped by the research cutoff.

## Related work included or left out

All merged pieces in this approval-evidence thread are included: SuperPipeline #106 and #111, AgentPod #889 and #895, and Treaty #41 and #42. No merged companion in the thread was intentionally omitted.

A downstream consumer update was still open at the research cutoff, so it is not part of the article and should not be named as shipped. Unrelated changes from the seven-day scan—documentation voice rollouts, release plumbing and other product fixes—serve different purposes and would blur the causal story.

## Blog-overlap and open-card check

The site repository contains ten published articles. None covers run-scoped artifact evidence, renamed-revision identity, version-pinned artifact links, or the same approval subject across API, web and room-message surfaces.

The nearest existing pieces are:

- [“AgentPod: a console for the machines your agents live on”](https://github.com/SuperJackfruitLabs/super-jackfruit-website/blob/master/src/content/blog/agentpod-a-console-for-the-machines-agents-live-on.md), a product overview;
- [“SuperPipeline: a durable work board for AI agents”](https://github.com/SuperJackfruitLabs/super-jackfruit-website/blob/master/src/content/blog/superpipeline-a-durable-work-board-for-ai-agents.md), a workflow overview;
- [“The suite, explained”](https://github.com/SuperJackfruitLabs/super-jackfruit-website/blob/master/src/content/blog/the-suite-explained.md), which mentions the products at a high level.

Go directly to the failure and invariant; do not repeat those product introductions. A fresh SuperLibrary search found no other in-progress article card on this board with a competing topic at research time.

## Public source list

1. [SuperPipeline PR #106 — require current-run stage references](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/pulls/106)
2. [SuperPipeline #106 merge commit](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/commit/9a4b9989a7a18bfd6614168fb8ea660a630e7a98)
3. [AgentPod PR #889 — a revised card artifact becomes the next version](https://github.com/SuperJackfruitLabs/agentpod/pull/889)
4. [AgentPod #889 merge commit](https://github.com/SuperJackfruitLabs/agentpod/commit/426caf22658556d8ec47ac7673874966e4c9f5f0)
5. [AgentPod #889 regression test](https://github.com/SuperJackfruitLabs/agentpod/blob/426caf22658556d8ec47ac7673874966e4c9f5f0/apps/hub/src/services/superlibrary/link.test.ts#L108-L175)
6. [AgentPod PR #895 — return a version-pinned artifact link](https://github.com/SuperJackfruitLabs/agentpod/pull/895)
7. [AgentPod #895 merge commit](https://github.com/SuperJackfruitLabs/agentpod/commit/a10ffca497bdda0e3de891c7d195510a009ad8c5)
8. [SuperPipeline PR #111 — gates show the run's pinned artifacts](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/pulls/111)
9. [SuperPipeline #111 merge commit](https://forge.superjackfruit.com/SuperJackfruitLabs/superpipeline/commit/c1f76fe689d182faa8938be0fd9f818a2ff1bf5f)
10. [Treaty PR #41 — gate prose lists the run's artifacts](https://forge.superjackfruit.com/SuperJackfruitLabs/treaty/pulls/41)
11. [Treaty PR #42 — harden gate references](https://forge.superjackfruit.com/SuperJackfruitLabs/treaty/pulls/42)
12. [Treaty v0.0.14](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.14)

## Research cutoff and gaps

Research cutoff: 16 November 2026.

No source gap blocks drafting. The only important deployment boundary is the mixed release status: every listed PR is merged to its repository's default branch, but only the Treaty pair is confirmed in a numbered release. Keep that distinction visible in the article.