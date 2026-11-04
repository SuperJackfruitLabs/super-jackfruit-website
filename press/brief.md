# Brief: Local is not the same as coding

## Working title

**The one-word gate that broke image paste in read-only agent sessions**

Alternative: **Local is not the same as coding: fixing attachment parity in Salaam**

## Thesis

A small bug in Salaam exposes a broadly useful design lesson for agent tools: gate an input capability on the boundary that actually matters, not on a nearby product mode. Pasted images and `@` file mentions are safe and meaningful for any session attached to a local workspace, but the submission path checked whether the session was a *coding* session. That made plain, read-only `salaam` sessions reject pasted images and pass mentions through as text. Pull request [#114](https://github.com/SuperJackfruitLabs/salaam/pull/114) changed the predicate from `localCoding` to `localWorkspace`, added a regression test, and deliberately left board sessions unchanged. The fix shipped in [Salaam 0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7).

The article should use the concrete fix to explain a reusable principle: model capabilities from trust and data-flow boundaries rather than UI labels or permission bundles.

## Why this change

- **Recent and shipped:** PR #114 merged on 1 November 2026 and the fix appears in the tagged 0.0.7 release published on 2 November 2026.
- **Useful outside the company:** developers building agent clients, chat composers, IDE integrations, or multimodal tools routinely decide which session types may resolve local files and accept binary input. The bug shows how a seemingly reasonable mode check can deny a safe capability to the wrong users.
- **Small enough to explain precisely:** the behavioral change is a one-predicate correction, backed by a focused regression test and release notes.
- **Not already covered:** the public [blog index](https://superjackfruit.com/blog/) has no article about Salaam attachment handling, PR #114, or release 0.0.7 as of 4 November 2026. Do not turn this into another article about the advisory AI review; that topic is already covered by “Every pull request gets an AI review that cannot approve it.”

## Reader

Developers designing persistent agent sessions, terminal or editor chat interfaces, and permission/capability models. Assume they understand local versus remote execution, but not Salaam’s internal session taxonomy.

## Reader payoff

By the end, a reader should be able to ask three better questions in their own system:

1. What boundary actually determines whether an attachment can be resolved?
2. Is a mode label such as “coding” accidentally standing in for locality, ownership, or authority?
3. Does the regression test cover both the newly allowed case and the boundary that must remain denied?

## Suggested structure

### 1. The symptom was inconsistent, not random

Open with the user-visible contrast:

- a plain `salaam` session is a local, read-only workspace session with no commands;
- it refused a pasted image with “Only a local session takes pasted images”;
- the same session sent `@` mentions as bare text;
- coding sessions already accepted both.

The error was especially misleading because the session *was* local. Cite the [PR description](https://github.com/SuperJackfruitLabs/salaam/pull/114) and [0.0.7 release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7).

### 2. The predicate encoded the wrong concept

Show the minimal diff from the [merge commit](https://github.com/SuperJackfruitLabs/salaam/commit/f23624f3a0338c11b751f195a457fdd829687603):

```ts
- const local = this.store.localCoding(id);
+ const local = this.store.localWorkspace(id);
```

Explain only what the public diff proves:

- the submission route already treated pasted images and mention expansion as a local-only behavior;
- it used “coding” as the test for “local”;
- a read-only workspace session is local without being a coding session;
- the corrected check aligns the behavior with workspace locality.

Do **not** claim this one line is a complete security mechanism or that `localWorkspace` is a general authorization primitive. The evidence supports a classification fix in this route, not a security audit.

### 3. Preserve the boundary while widening the valid set

The change does not enable attachment resolution everywhere. The code comment, changelog, release notes, and test all say board sessions still receive exactly what was typed. Frame the shape as:

- previously allowed: local coding workspace;
- newly allowed: local read-only workspace;
- still not allowed: board/non-workspace session.

This is the useful engineering pattern: widen from a product sub-mode to the true capability boundary without erasing the boundary.

### 4. A regression test should prove both payloads

Use the focused test in the [PR file diff](https://github.com/SuperJackfruitLabs/salaam/pull/114/files): it creates a read-only workspace session, submits one pasted PNG plus `@shot.png`, and expects two image attachments. The adjacent board-session test remains. Point out that this checks the two paths users experienced as one feature—paste and mention resolution—rather than testing only the changed boolean.

Avoid presenting the author-reported “140 unit files / 3,132 tests” as independently reproduced. It may be included only with attribution to the PR description; the focused regression is more important to the story.

### 5. Generalise carefully

Close with a compact checklist:

- Name predicates after the property they prove.
- Keep locality, mutability, and command authority as separate dimensions.
- Test the valid sibling mode that exposed the bug.
- Keep a negative test for the remote or mediated boundary.
- Make the error message derive from the same concept as the gate.

The final point is an inference/recommendation, not a claim that Salaam changed its error architecture.

## Fact and claim ledger

| Claim | Evidence | Confidence / wording |
|---|---|---|
| A plain read-only `salaam` workspace session refused pasted images and left `@` mentions as text. | [PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114), [release 0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) | High. State as the documented pre-fix behavior. |
| The implementation changed the route’s test from `localCoding(id)` to `localWorkspace(id)`. | [Merge commit f23624f](https://github.com/SuperJackfruitLabs/salaam/commit/f23624f3a0338c11b751f195a457fdd829687603) | High. Quote the exact two-line diff. |
| Every local workspace session now accepts pasted images and resolves file mentions; board sessions remain unchanged. | [PR #114 files](https://github.com/SuperJackfruitLabs/salaam/pull/114/files), [tagged release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) | High. Prefer “workspace session” when explaining implementation; the release uses “every local session.” |
| `@` completion is based on git-visible workspace files; ignored files do not appear, and names with spaces are quoted. | [`docs/tui.md` at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/tui.md) | High, but optional context rather than the main claim. |
| The regression test covers a pasted PNG and an `@shot.png` mention in one read-only workspace submission. | [PR #114 files](https://github.com/SuperJackfruitLabs/salaam/pull/114/files) | High. Describe the assertion; do not imply a live end-to-end test. |
| The change shipped in Salaam 0.0.7. | [GitHub release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) | High. |
| Capability gates should reflect the underlying trust/data-flow boundary rather than a product mode. | Analysis derived from the diff and preserved board boundary. | Medium. Present as the article’s lesson, not as a maintainer quote. |

## Public sources to cite

1. [Merged PR #114 — Take pasted images and @ mentions in every local session](https://github.com/SuperJackfruitLabs/salaam/pull/114)
2. [PR #114 file diff](https://github.com/SuperJackfruitLabs/salaam/pull/114/files)
3. [Merge commit f23624f](https://github.com/SuperJackfruitLabs/salaam/commit/f23624f3a0338c11b751f195a457fdd829687603)
4. [Salaam 0.0.7 release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7)
5. [`docs/tui.md` pinned to v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/tui.md)
6. [Public blog index](https://superjackfruit.com/blog/) — novelty check only

## Guardrails for the draft

- Do not call a read-only workspace session a sandbox; the cited sources say read-only/no commands, not that it provides a general OS security boundary.
- Do not say board sessions cannot carry images by any mechanism. The evidence only says this paste/mention submission path leaves board-session input exactly as typed and refuses pasted images.
- Do not claim the feature was newly invented in 0.0.7. Coding sessions already had it; 0.0.7 fixed parity for plain local workspace sessions.
- Do not turn the structural work also included in 0.0.7 into a second thesis. It is a separate change in PR #115.
- Do not rely on the product landing page for version facts; at research time it displayed older version information. Use the tagged release and pinned repository files.
- Cite only the public URLs above. Do not mention internal systems, repositories, infrastructure, or personnel.

## Recommended description

A one-word predicate made a local, read-only agent session behave as if it were remote. Salaam 0.0.7 shows how to gate attachments on the boundary that matters without weakening the one that must remain.
