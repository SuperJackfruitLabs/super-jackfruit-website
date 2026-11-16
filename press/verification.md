# Verification — What exactly are you approving?

## Verdict

**Publishable: true.** The article's material factual claims are supported by the cited public sources after the corrections below. No publication blocker remains.

## What I checked

Research and claim verification used the public, commit-pinned sources listed in the article and the brief, with a research cutoff of 16 November 2026.

| Claim area | Public evidence checked | Finding |
|---|---|---|
| Renamed revisions and artifact identity | AgentPod PR #889; merge commit `426caf22658556d8ec47ac7673874966e4c9f5f0`; `link.ts` and `link.test.ts` at that commit | Confirmed. For a titled artifact on a card, AgentPod sends `artifacts/<card>/<encoded title>` as the source path. The regression links `docs-voice-pass-spec.md` and `docs-voice-pass-spec-v2.md` under the same title and requires the original item id/URL at version 2. The PR also documents the station boundary: a different station still starts a new item. |
| Current-run completion evidence and attribution | SuperPipeline merge commit `9a4b9989a7a18bfd6614168fb8ea660a630e7a98`; `run-verbs.ts` lines 280–292; `references.ts` lines 41–45 | Confirmed. The completion query accepts references from the completing run plus explicit person-added references. The authenticated run path supplies `addedBy: 'agent'` and the current `runId`; those values are not taken from the request body. |
| Version-pinned artifact links | AgentPod PR #895; merge commit `a10ffca497bdda0e3de891c7d195510a009ad8c5`; `tools.ts` lines 194–204 | Confirmed. `agentpod_link_artifact` retains the floating item `url`, constructs `versionUrl` as `<item-url>/v/<version>`, and tells callers to attach `versionUrl`. |
| Run-scoped evidence in web gates | SuperPipeline merge commit `c1f76fe689d182faa8938be0fd9f818a2ff1bf5f`; `gates.ts` lines 681–687; `GateReferences.svelte` lines 19–63 | Confirmed. Gate references are selected by the gate's `run_id`. The renderer recognizes an already pinned route or adds `/v/<version>` to a known SuperLibrary item when version metadata is available, displays the version, and renders “This run linked no artifact” for an empty list. |
| Artifact evidence in room-message prose | Treaty implementation commit `855d57d05c66f54d3e3fcb9e1702f6b1abf1260c` | Confirmed. The delivery contract gains optional references; gate prose lists them, falls back to the URL when the title is missing, preserves older deliveries when the field is absent, and states “This run linked no artifact” for an empty list. |
| Malformed and hostile room-message references | Treaty implementation commit `d832f606f83b5d6963aa7e56009b4e5cb6dc244a` | Confirmed. Non-arrays are treated as absent, unusable entries are skipped, only HTTP(S) URLs are emitted, Markdown-sensitive URL characters are percent-encoded, and reference titles are normalized and escaped. |
| Treaty release boundary | Treaty release `v0.0.14` | Confirmed. The release lists implementation commits `855d57d` and `d832f60`, along with their preceding regression-test commits `49bb2c2` and `420230d`. |
| SuperExchange consumer boundary | SuperExchange merge commit `fb328cf0bcc0284a3e449e6b3e23c9f458cbbce1`; package manifest, lockfile and changelog at that commit | Confirmed. The application dependency and lockfile use `@superjackfruitlabs/treaty-matrix-events` 0.0.14. The behavior is recorded under `Unreleased`, so the article correctly describes the SuperExchange change as merged rather than released. |

## Corrections made

1. **Replaced two misleading Treaty citations.** The draft cited commits `49bb2c2` and `420230d` as the changes that implemented room-message artifact links and hardening. Those commits add the regression tests; at their snapshots, the corresponding implementation was not yet present. I replaced them with the actual implementation commits `855d57d` and `d832f60` in both frontmatter and article prose.
2. **Added the station boundary to artifact identity.** The draft described card-plus-title identity without stating that SuperLibrary also matches on station. I clarified that the renamed revision remains the same item on the same station, while a different station starts a new item.
3. **Separated compound source claims.** I split the SuperPipeline completion and attribution claim so each has the exact source that proves it.
4. **Added the API evidence for web-gate scoping.** The renderer proves pinning, version display and the empty state, but not the run-scoped database selection. I added the commit-pinned `gateReferences` query alongside the renderer citation.
5. **Tightened the Treaty hardening wording.** “Markdown-significant URL characters” became the narrower “URL characters that Markdown would interpret,” matching the implementation's explicit encoded character set.

## Publication blockers

None.
