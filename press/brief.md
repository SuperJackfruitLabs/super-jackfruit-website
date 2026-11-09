# Brief: When “approve” must name a version

## Recommendation

Write the article. Anchor it on the variant-gate change merged in AgentPod PR #847 on 8 November 2026, with SuperMessage PR #164 as the public client-side companion.

**Proposed headline:** When “approve” must name a version

**Alternative:** An approval button is a content-addressed decision

**One-sentence angle:** A multi-option approval is not a larger yes/no dialog: the approval has to bind the exact version and digest the person saw, and the system must refuse to infer consent when that preview is incomplete, stale or missing.

**Confidence:** High. The merged pull requests, implementation and tests are public and mutually consistent.

## Why this change is worth an article

Agent systems increasingly produce several plausible outputs—a short announcement, a thread and a long-form post, for example—then ask a person to choose one. A naive implementation treats that as a radio group followed by an Approve button. That leaves the important question unanswered: *what exact artifact did the person approve?*

AgentPod PR #847 turns the choice into a bound protocol decision. An approving answer must identify one recorded variant by subject ID and digest. That variant must have been shown completely and must not have expired. Missing, unknown, truncated and expired choices fail closed. Request changes and reject still act on the whole set. The resulting receipt names the selected variant. SuperMessage PR #164 implements the corresponding picker and disables approval until a complete, approvable variant is selected.

That is useful beyond these products. Any developer building review queues, deployment approvals, generated-content workflows or human-in-the-loop agent systems faces the same design problem: approval should authorize immutable content, not a mutable label such as “version B.”

## Reader and payoff

**Reader:** Developers designing approval flows for generated artifacts, especially across services or clients.

**Payoff:** A practical four-part test for trustworthy approvals:

1. **Identity:** Does the answer bind the exact artifact, not just a display label?
2. **Evidence:** Was the complete artifact actually visible in the surface that offered approval?
3. **Freshness:** Is the selected artifact still active and unexpired when the answer is judged?
4. **Receipt:** Can the audit record say which version was approved without reconstructing intent later?

## The shipped change

Primary public change:

- [AgentPod PR #847 — “hub: carry a gate's choice of variants and judge the choice (step 4b)”](https://github.com/SuperJackfruitLabs/agentpod/pull/847), merged 8 November 2026.

Public companion change:

- [SuperMessage PR #164 — “step 4b: a picker for a gate's variants”](https://github.com/SuperJackfruitLabs/supermessage/pull/164), merged 8 November 2026.

The article should remain about one engineering change—the exact binding of a multi-variant approval—rather than becoming a product announcement or an account of every repository involved.

## Suggested narrative

### 1. Start with the deceptively simple UI

Use a concrete example: a system offers **Short**, **With the thread** and **Long form**. The person chooses one and taps Approve.

Then ask what the backend can actually prove:

- Was “With the thread” still the same content when approval arrived?
- Did the person see the whole version or only a truncated preview?
- Could an old client send an unbound generic `approve`?
- If the version expired or was replaced, would the system silently approve something else?

### 2. Show why a label is not authority

A label is presentation. The approval in PR #847 is instead matched by subject ID **and** digest against the variants recorded when the gate was projected. The stored record also carries preview completeness and expiry.

This is the central lesson: a human-friendly label explains the choice, while a content-bound identity authorizes it.

### 3. Follow the refusal path, not only the happy path

The implementation refuses an approving answer when:

- it names no variant;
- its binding matches no recorded variant;
- the selected variant was not shown in full in that surface; or
- the selected variant has expired.

Older or reduced-capability surfaces do not guess. They can still reject or request changes, but cannot approve a choice they cannot bind.

### 4. Connect protocol and interface

SuperMessage's picker makes the protocol constraint visible: there is no default selection, and approval remains disabled until the person picks a variant that the core marked approvable. The backend still rechecks the choice; the disabled button is usability, not the security boundary.

### 5. End with a reusable design checklist

Recommend that developers model approval as:

```text
approve(
  decision_id,
  artifact_id,
  artifact_digest,
  observed_revision_or_expiry
)
```

The exact schema can differ. The invariants should not: no implicit default, no approval of unseen content, no stale binding, and a receipt that names the selected artifact.

## Claim ledger

| Claim | Public evidence | Confidence / wording |
| --- | --- | --- |
| AgentPod PR #847 was merged on 8 November 2026 and added variant-bound gate decisions. | [PR #847](https://github.com/SuperJackfruitLabs/agentpod/pull/847) | High. State as a merged pull request, not as a tagged release. |
| A recorded variant includes an ID, label, subject ID, digest, preview-complete flag and expiry. | [Schema at the PR head commit](https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/db/schema/matrix.ts#L502-L516) and [stored variant set](https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/db/schema/matrix.ts#L568-L575) | High. |
| An approval must bind a known variant whose preview was complete and whose subject has not expired. | [Decision checks](https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/services/matrix-as/gate-decision.ts#L272-L295) | High. |
| Reject and request-changes act on the whole set rather than requiring one selected variant. | [PR #847 description](https://github.com/SuperJackfruitLabs/agentpod/pull/847) and [decision handling](https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/services/matrix-as/gate-decision.ts#L272-L295) | High. Say “in this protocol,” not as a universal rule. |
| The receipt can name the chosen variant. | [Outcome wording and `chosen_variant`](https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/services/matrix-as/gate-decision.ts#L560-L584) | High. |
| SuperMessage PR #164 added a picker and keeps approval disabled until an approvable variant is selected. | [PR #164](https://github.com/SuperJackfruitLabs/supermessage/pull/164), [selection predicate](https://github.com/SuperJackfruitLabs/supermessage/blob/e42f03763a60c554396546f2240598cd24181dff/android/app/src/main/kotlin/dev/supermessage/DecisionCard.kt#L704-L724), [picker](https://github.com/SuperJackfruitLabs/supermessage/blob/e42f03763a60c554396546f2240598cd24181dff/android/app/src/main/kotlin/dev/supermessage/DecisionCard.kt#L725-L786), and [button guard](https://github.com/SuperJackfruitLabs/supermessage/blob/e42f03763a60c554396546f2240598cd24181dff/android/app/src/main/kotlin/dev/supermessage/DecisionCard.kt#L1041-L1058) | High. The cited UI is Android; the PR describes the wider client change. |
| Tests cover no selection, known complete variants, a truncated variant and an unknown variant. | [SuperMessage decision-choice tests](https://github.com/SuperJackfruitLabs/supermessage/blob/e42f03763a60c554396546f2240598cd24181dff/android/app/src/test/kotlin/dev/supermessage/DecisionChoiceTest.kt#L470-L501) | High. Do not convert the PR's test counts into an independent quality claim. |
| No published lab note currently covers variant-bound approvals. | [Live blog index](https://www.superjackfruit.com/blog/) | High as checked on 9 November 2026. The index listed eight published notes; none addressed variant gates or content-bound choice. |

## Boundaries and caveats

- Say **merged** or **shipped change**, not “released to every user.” The evidence is a merged PR, not a public app-store or binary-release receipt.
- Do not claim the UI check is the security boundary. The backend independently validates the binding, completeness and expiry.
- Do not claim that a digest proves a person understood the content. It proves which content the decision names.
- Do not imply every approval system needs this exact event schema. Generalize the invariants, not the product-specific wire format.
- The PR notes a current client limitation: there is no web picker yet. Mention it only if discussing progressive capability across clients.
- Avoid internal process, infrastructure or unpublished decision records. The public PRs and commit-pinned code are sufficient.

## Originality check

The live blog index was read before selecting the topic. Existing posts cover the lab, the suite, SuperPipeline, AgentPod, SuperWitness, a CLI self-update failure, AI pull-request review and Salaam. None covers multi-variant gates, exact subject binding, or the rule that incomplete previews cannot be approved.

The only other open scheduled article card found on this board had not selected an angle, so there was no conflicting topic to avoid at brief time.

## Source list for the eventual post

Use only public URLs:

1. https://github.com/SuperJackfruitLabs/agentpod/pull/847
2. https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/db/schema/matrix.ts#L502-L516
3. https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/services/matrix-as/gate-decision.ts#L272-L295
4. https://github.com/SuperJackfruitLabs/agentpod/blob/6e133dfd3a7ffdec27d652bfa065c1906b0a9f92/apps/hub/src/services/matrix-as/gate-decision.ts#L560-L584
5. https://github.com/SuperJackfruitLabs/supermessage/pull/164
6. https://github.com/SuperJackfruitLabs/supermessage/blob/e42f03763a60c554396546f2240598cd24181dff/android/app/src/main/kotlin/dev/supermessage/DecisionCard.kt#L704-L786
7. https://github.com/SuperJackfruitLabs/supermessage/blob/e42f03763a60c554396546f2240598cd24181dff/android/app/src/test/kotlin/dev/supermessage/DecisionChoiceTest.kt#L470-L501
8. https://www.superjackfruit.com/blog/
