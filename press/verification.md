# Verification: Every pull request gets an AI review that cannot approve it

## Verdict

**Publishable: false.**

The implementation claims in the article are supported by the permitted public sources after the edits recorded below. One required claim is not: none of the four repository files or Anthropic's article documents a planted-bug test or says that a review caught both planted bugs. I removed that sentence rather than publish an unsupported result and changed the frontmatter to `draft: true`.

To clear the publication blocker, do one of the following:

1. add an explicit public receipt to the permitted source set that documents the planted test and its two caught bugs, then restore a narrow sentence citing that receipt; or
2. remove the planted-bug result from the commission and publish the corrected draft without it.

The receipt need not disclose the defects, repository, or pull-request number, but it must publicly substantiate that two bugs were deliberately planted and both were reported by this reviewer. A private assertion or the commission text alone would not clear the source requirement.

## Sources checked

All repository links are pinned to commits rather than a moving branch.

- [SuperLibrary `REVIEW.md`](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md)
- [SuperLibrary `.github/claude/claude-ci.mjs`](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs)
- [SuperWitness `REVIEW.md`](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/REVIEW.md)
- [SuperWitness `.github/claude/claude-ci.mjs`](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/.github/claude/claude-ci.mjs)
- [Anthropic, “The AI-native SDLC playbook”](https://claude.com/blog/the-ai-native-sdlc-playbook)

The two pinned `claude-ci.mjs` files are each 600 lines and 25,391 bytes. Their SHA-256 digests both equal `8c158cf9415ee7016f662325411febe1bca144ec285fa1dace187a58f9f99db8`, confirming that the two public copies are byte-identical.

## Claim checks

| Article claim | Finding | Evidence |
|---|---|---|
| The review is advisory and cannot approve, block, request changes, or fail CI. | Supported. The shared script posts or edits issue comments, its system prompt states the authority limit, and its top-level handler turns errors into output while completing normally. | Both `REVIEW.md` files, and `claude-ci.mjs` lines 2–12, 150–153, 279–289, and 582–600. |
| The shared kit is described as carried by every product. | Supported as an attributed design statement in the script header. Direct public inspection in the permitted source set covers SuperLibrary and SuperWitness, not an independently enumerated product inventory. The article now makes that attribution explicit and gives no product count. | `claude-ci.mjs` lines 2–4; the two pinned copies have the same digest. |
| Review has separate bugs, security, and compliance passes. | Supported. Both repositories define those passes, and the script restricts output pass labels to the same three values. | Both `REVIEW.md` files lines 8–17; `claude-ci.mjs` lines 39–41 and 279–289. |
| Findings use `important`, `moderate`, and `nit`; only five nits are displayed. | Supported. The instructions define the severities and cap; the renderer also slices displayed nits to five and counts the remainder. | Both `REVIEW.md` files lines 19–26; `claude-ci.mjs` lines 39–41 and 326–363. |
| Generated paths, lockfiles, mechanically enforced checks, and taste are excluded. | Supported. Repository instructions exclude these categories, and the code filters configured generated paths plus named lockfiles before review. | Both `REVIEW.md` files lines 28–32 and generated-path sections; `claude-ci.mjs` lines 42–50 and 270–277. |
| SuperLibrary and SuperWitness supply different repository-specific rules. | Supported. SuperLibrary names deployment and live-data migration constraints; SuperWitness names tenant scoping, documentation agreement, and immutable evidence records. | SuperLibrary `REVIEW.md` lines 43–47; SuperWitness `REVIEW.md` lines 46–50. |
| Trusted review instructions and rule files come from the configured base ref or pull request base SHA. | Supported. `review()` resolves `s.baseRef || pull.base.sha`, then fetches `REVIEW.md` and named rule files at that ref. Both instruction files also state that Claude reads them from the base branch. | Both `REVIEW.md` files lines 3–4; `claude-ci.mjs` lines 55–77 and 499–518. |
| Pull-request title, body, and diff are fenced and treated as untrusted; proposed code is not checked out or run. | Supported as a mitigation, not proof that prompt injection is impossible. The article preserves that distinction. | `claude-ci.mjs` lines 9–12, 200–225, and 291–310. |
| Review and CI triage each update one marker-bearing comment on repeat runs. | Supported. Separate markers are defined, and `upsertComment()` updates the bot's existing marked comment or creates one if absent. The body is replaced, so the article does not claim that earlier findings remain visible. | `claude-ci.mjs` lines 28–31 and 186–198. |
| The review has explicit eligibility and size limits. | Supported. Missing key, missing required context, draft or closed pull requests, oversized post-filter diffs, and empty post-filter diffs all skip or produce a not-reviewed note. The default cap is 200 KB. | `claude-ci.mjs` lines 32–39 and 499–558. |
| Failed-CI triage uses failed job metadata and bounded log tails, labels a result likely flaky or likely real, gives at most three summary lines, and reruns nothing. | Supported. The article correctly calls this probabilistic triage rather than diagnosis. | `claude-ci.mjs` lines 36–38 and 369–452, plus 561–579. |
| Anthropic advocates layers of agentic review while retaining human accountability for judgment. | Supported. Anthropic describes “layers of agentic review,” reserves human review for regulated and critical code, and states that humans remain accountable for decisions requiring judgment. The article does not imply that Anthropic evaluated this implementation. | Anthropic's linked article. |
| A planted-bug test caught both planted bugs. | **Not supported by the permitted sources.** None mentions such a test or result. | No evidence in the allowed source set. |

## Changes made to the article

1. Changed the opening from “Every pull request” to “Every eligible pull request” so the body does not contradict the documented draft, key, state, filtering, and size conditions.
2. Recast suite-wide scope as the script's own shared-kit statement and limited direct public evidence to the two repositories actually inspected.
3. Removed the planted-bug paragraph because its result has no support in the permitted public sources.
4. Changed `draft: false` to `draft: true` while the required planted-bug claim remains unresolved.

## Constraint check

- The article cites only the five permitted public URLs.
- It names no private repository, internal agent, host, or team.
- It makes no cost, adoption, productivity, or generalized accuracy claim.
- It does not claim that the trust boundary eliminates prompt injection.
- It does not claim that triage reruns jobs or conclusively diagnoses failures.
- The title remains intentionally compact, while the opening and limits section make eligibility exceptions explicit.
