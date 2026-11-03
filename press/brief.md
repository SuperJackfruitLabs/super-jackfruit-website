# Brief: Every pull request gets an AI review that cannot approve it

## Working title

**Every pull request gets an AI review that cannot approve it**

## Thesis

The interesting design choice is not that Claude reviews pull requests; it is that the review has deliberately limited authority. A shared CI script reads the proposed diff, makes separate bugs, security, and repository-compliance passes, and leaves one advisory comment for a person. It cannot approve the pull request, request changes, or make CI fail. The reviewer and its repository-specific instructions come from the base branch, while the pull request text and diff are fenced as untrusted data, so a pull request cannot rewrite the reviewer that judges it.

This is a concrete, modest example of Anthropic's broader AI-native SDLC pattern: add layers of agentic review while keeping people accountable for judgment. Do not turn it into a claim that review has become autonomous or that human review is obsolete.

## Audience and promise

Write for engineers who are interested in AI-assisted development but distrust bots that produce noisy comments or quietly acquire merge authority. Assume readers understand pull requests and CI but have not seen this implementation.

Promise a short implementation story with inspectable code, not a generic argument for AI code review:

- what the reviewer examines;
- what it is mechanically unable to do;
- how it resists a pull request changing its own instructions;
- how it keeps repeated reviews readable;
- how failed-CI triage fits beside review; and
- what a planted-defect check did and did not establish.

## Recommended opening

Open on the authority boundary:

> Every pull request gets another reader. That reader can point to a bug, a security problem, or a broken repository rule. It cannot approve the change, block it, or request changes. A person still decides.

Then explain why this is more than wording in a prompt. The script posts issue comments rather than GitHub review verdicts, explicitly tells the model that its role is advisory, and catches errors by returning a notice rather than failing CI. The result is a review layer, not a new gatekeeper. [[Shared script: role and failure behaviour](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L1-L15)] [[Review system prompt](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L279-L289)] [[Top-level error handling](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L582-L600)]

## The mechanism, in the order a reader can follow

### 1. One shared reviewer, repository-specific rules

The public SuperLibrary and SuperWitness repositories carry byte-identical copies of the 600-line `claude-ci.mjs` shared kit, but different `REVIEW.md` files. The shared mechanism stays consistent; each repository names its own rule files, generated paths, and high-risk invariants. SuperLibrary highlights deployment and migration safety. SuperWitness adds tenant-scoped reads, documentation/code agreement, and immutable evidence records. [[SuperLibrary reviewer](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs)] [[SuperWitness reviewer](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/.github/claude/claude-ci.mjs)] [[SuperLibrary instructions](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md#L34-L47)] [[SuperWitness instructions](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/REVIEW.md#L34-L50)]

The script itself says every product carries a byte-identical copy. Phrase that as the design of the suite, supported by these two public examples; do not invent a product count. [[Shared-kit comment](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L1-L4)]

### 2. Three passes, with a deliberately high signal bar

`REVIEW.md` requires three labelled passes:

1. **Bugs:** incorrect behaviour, edge cases, races, resource leaks, lost errors, and tests that cannot fail.
2. **Security:** leaked secrets or personal data, injection, missing authentication or authorisation, unsafe shell/query/path input, and weakened checks.
3. **Compliance:** the repository's named rule files and whether the diff matches the pull request's stated plan.

Findings are `important`, `moderate`, or `nit`. “Important” is reserved for broken behaviour, data leakage, or a written-policy breach. At most five nits are shown; extras are counted rather than listed. Generated files, lockfiles, mechanically enforced checks, and matters of taste are excluded. [[SuperLibrary review instructions](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md#L3-L32)] [[Pass and nit enforcement in code](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L326-L363)]

The editorial point is restraint: the reviewer is told to prefer no finding to a weak one, and the renderer enforces the nit cap even if the model returns more.

### 3. One sticky comment follows the pull request

Review and CI triage each have a hidden marker. Before posting, the script searches the bot's existing comments for the marker; if it finds one, it edits that comment, otherwise it creates one. A new push therefore refreshes the same review surface instead of creating a trail of stale bot comments. [[Markers and comment upsert](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L28-L31)] [[Create-or-update logic](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L186-L198)]

Say “the same comment is updated when the review runs again,” not “the old findings remain visible”: the implementation replaces the comment body.

### 4. The pull request cannot rewrite its own reviewer

This is the strongest technical detail and should be the centre of the piece.

The script chooses `CI_BASE_REF`, falling back to the pull request's base SHA, and fetches `REVIEW.md` plus the rule files from that ref. It does not read those trusted instructions from the proposed head branch. The title, description, and diff are separately wrapped in nonce-bearing tags and explicitly labelled untrusted; embedded instructions are to be reported as a security finding rather than followed. Nothing checks out or executes pull-request code. [[Base-ref setting](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L55-L77)] [[Untrusted-data fence](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L200-L225)] [[Prompt trust boundary](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L291-L310)] [[Base-branch file reads](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L499-L518)]

Use a plain-language formulation: **the change is evidence; it is not policy**. Avoid claiming that fencing makes prompt injection impossible. It is a concrete trust boundary and mitigation, not a proof of model-level immunity.

### 5. Failed-CI triage is a second advisory lane

The same script can inspect failed job metadata and bounded log tails. It asks Claude to classify the failure as `likely flaky` or `likely real`, name the most likely cause, and return at most three summary lines. The rendered comment is explicitly read-only and says nothing was rerun. [[Triage contract](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L393-L434)] [[Failure collection and bounds](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L436-L452)] [[Triage command](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L561-L579)]

Do not say triage diagnoses failures conclusively, fixes them, or reruns jobs. Its own vocabulary is probabilistic.

### 6. The planted-bug check

The commission requires this result: **in a planted-bug test, the review caught both planted bugs.** Keep it to that one sentence unless an allowed public source is added before verification. Do not invent the defects, their severity, the repository, a pull-request number, or a success rate.

This claim is **not independently evidenced by the currently allowed public source set** (`REVIEW.md`, `claude-ci.mjs`, and Anthropic's article). Treat it as a commissioned test report that the claim-check stage must either:

- match to a public receipt that the commissioner permits as an additional source;
- obtain an exact, publishable description from the commissioner; or
- remove/qualify before publication if neither is available.

The test is a useful smoke check, not proof of recall, precision, or broad reliability. The article must not extrapolate “caught two out of two planted bugs” into “catches every bug.”

## Connection to Anthropic's playbook

Anthropic argues that as code generation accelerates, review/test and deploy become human-speed bottlenecks. Its AI-native alternative calls for “layers of agentic review,” with human review retained for regulated and critical code, and says people remain accountable for decisions requiring judgment. This implementation is a small, inspectable example of that separation: AI adds a review pass, while authority remains human. [[Anthropic, “The AI-native SDLC playbook”](https://claude.com/blog/the-ai-native-sdlc-playbook)]

Keep the relationship precise:

- Anthropic provides the broader pattern and language.
- The repository files provide the implementation facts.
- Do not imply Anthropic designed, reviewed, endorses, or has measured this particular system.
- Do not repeat Anthropic's generalized speed or value claims as measured facts about this suite.

## Important limits and honest wording

The title is intentionally compact, but the body must disclose the exceptions visible in code:

- Draft pull requests are skipped.
- A missing API key is a no-op.
- A diff over the default 200 KB post-filter cap gets a “not reviewed” note rather than a model review.
- A diff containing nothing after generated paths and lockfiles are removed is skipped.
- Model or API errors do not fail CI.

These are part of the advisory design, not footnotes to hide. [[Review command and limits](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs#L499-L558)]

Prefer:

> The workflow runs as an advisory review lane on pull requests, subject to explicit skip and size conditions.

Avoid the technically absolute claim that every pull request is successfully reviewed on every push. The allowed source files prove how the command behaves when invoked; they do not, by themselves, prove workflow trigger coverage or operational uptime.

## Suggested article spine

1. **A reviewer with no vote.** Open with the inability to approve or block.
2. **What it actually reads.** Diff plus repository instructions, reviewed in bugs/security/compliance passes.
3. **Policy comes from the base branch.** Explain why the change cannot rewrite `REVIEW.md` or rule files for its own review, and how untrusted inputs are fenced.
4. **One comment, not bot sediment.** Show the marker-based update and five-nit cap.
5. **A second lane for red CI.** Explain likely-flaky/likely-real triage and its read-only boundary.
6. **The planted-bug smoke test.** State only that both planted defects were caught, with the verification caveat above.
7. **Why advisory matters.** Connect to Anthropic's layered-review model: automation supplies attention; a person retains judgment.
8. **Close on the design principle.** The useful question is not only “can an AI review code?” but “what authority should that review have, and who controls its instructions?”

## Claims ledger and confidence

| Claim | Confidence | Public support |
|---|---|---|
| The reviewer makes bugs, security, and compliance passes. | High | Both repositories' `REVIEW.md`; pass enum and JSON contract in `claude-ci.mjs`. |
| It never approves, requests changes, blocks, or fails CI. | High | Script header, system prompt, comment renderer, and top-level error handling. |
| Review instructions and named rule files are read from the base ref. | High | `review()` resolves `baseRef || pull.base.sha` before API file reads. |
| Pull-request text, diff, and logs are treated as untrusted data. | High | Nonce fence and `DATA_RULE`; prompt construction. |
| Review and triage update one marker-bearing comment each. | High | `MARKERS` and `upsertComment()`. |
| At most five nits are shown. | High | `MAX_NITS = 5` and renderer slicing/counting. |
| Failed-CI triage reports likely flaky/likely real and does not rerun jobs. | High | Triage system/output contract and renderer. |
| The shared reviewer is byte-identical in SuperLibrary and SuperWitness. | High | The two pinned public files match; both copies identify themselves as shared-kit files. |
| Every product carries the shared reviewer. | Medium | The script says this; the allowed public evidence directly exposes only SuperLibrary and SuperWitness. Do not give a count. |
| Every pull request is reviewed on every push. | Medium/low as an absolute | The command supports repeated comment updates, but explicit skips exist and workflow-trigger files are outside the allowed source set. Qualify in body. |
| A planted-bug test caught both planted bugs. | Low until public receipt is allowed | Supplied by the commission, not demonstrated in the allowed source files. Verification required before publication. |

## Source list for the eventual post

Use only these public URLs unless the commissioner explicitly expands the source set:

1. [SuperLibrary `REVIEW.md` at the introducing merge commit](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md)
2. [SuperLibrary `.github/claude/claude-ci.mjs` at the introducing merge commit](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs)
3. [SuperWitness `REVIEW.md` at the introducing merge commit](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/REVIEW.md)
4. [SuperWitness `.github/claude/claude-ci.mjs` at the introducing merge commit](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/.github/claude/claude-ci.mjs)
5. [Anthropic: “The AI-native SDLC playbook”](https://claude.com/blog/the-ai-native-sdlc-playbook) — published August 21, 2026, by Louis Claxton.

Pin repository citations to the commits above rather than `main`, so the evidence does not move under the article.

## Constraints for the writer

- Do not name internal agents, machines, hosts, or teams. Discuss only the public repositories named in this brief.
- Do not describe the provenance or location of the suite's shared kit beyond what the cited public files say.
- Do not make cost, usage, adoption, accuracy, or productivity claims; the allowed sources provide no suite measurements.
- Do not call the output an approval, verdict, gate, or merge decision.
- Do not claim prompt injection is solved; describe the base-branch and fencing mitigations exactly.
- Do not imply the model executes code or reproduces CI; it reads API-fetched data.
- Do not turn probabilistic CI triage into a factual root-cause diagnosis.
- Keep the planted-bug result narrow and subject to verification.

## Tone and length

Aim for 800–1,100 words: engineer-to-engineer, concrete, and lightly skeptical. Let code-level boundaries carry the argument. Avoid “revolutionary,” “autonomous,” “zero-risk,” “catches everything,” and “replaces reviewers.” The strongest closing note is restraint: a useful AI reviewer can be present everywhere without being granted the final say.
