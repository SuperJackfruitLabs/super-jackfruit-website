# Verification: Every pull request gets an AI review that cannot approve it

## Verdict

**Publishable: true.**

Every factual claim in the article is supported by the permitted public sources. The newly permitted public [Salaam pull request #120](https://github.com/SuperJackfruitLabs/salaam/pull/120) clears the previous blocker: its description says that two bugs were planted on purpose, and the advisory review comment reports both of them. The article states that result narrowly and does not extrapolate from the check to a broader accuracy claim.

The article remains `draft: true` for the publication-approval stage. There is no factual publication blocker.

## Sources checked

All repository links are pinned to commits rather than a moving branch.

- [SuperLibrary `REVIEW.md`](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md)
- [SuperLibrary `.github/claude/claude-ci.mjs`](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs)
- [SuperWitness `REVIEW.md`](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/REVIEW.md)
- [SuperWitness `.github/claude/claude-ci.mjs`](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/.github/claude/claude-ci.mjs)
- [Salaam pull request #120](https://github.com/SuperJackfruitLabs/salaam/pull/120)
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
| A public planted-defect check added two bugs on purpose and the advisory review reported both: directory permissions changed from `0700` to `0755`, and a release function that throws on a second call. | Supported. The pull-request description explicitly says two bugs were planted on purpose. The GitHub Actions advisory comment reports exactly these two findings, and a closing comment confirms that both planted bugs were flagged. | Salaam pull request #120 description and issue comments, including the advisory review at `#issuecomment-6594179216`. |

## Changes made to the article

1. Changed the opening from “Every pull request” to “Every eligible pull request” so the body does not contradict the documented draft, key, state, filtering, and size conditions.
2. Recast suite-wide scope as the script's own shared-kit statement and limited direct public evidence to the two repositories actually inspected.
3. On the earlier verification pass, removed the unsupported planted-bug paragraph and changed `draft: false` to `draft: true`.
4. After Salaam pull request #120 was added to the permitted source set, checked its public description and advisory comment and confirmed that they support the restored, narrowly worded paragraph. No further article change was required on this pass.
5. Kept `draft: true` for the publication-approval stage; this is workflow state, not a factual blocker.

## Constraint check

- The article cites only the six permitted public URLs.
- It names no private repository, internal agent, host, or team.
- It makes no cost, adoption, productivity, or generalized accuracy claim.
- It does not claim that the trust boundary eliminates prompt injection.
- It does not claim that triage reruns jobs or conclusively diagnoses failures.
- The title remains intentionally compact, while the opening and limits section make eligibility exceptions explicit.

## Validation

- `npm test`: 41 tests passed, 0 failed.
- A clean `npm run build` after removing generated `.astro` and `dist` state completed successfully. Astro reported 0 errors and 5 existing hints; Vite also repeated the repository's large-chunk advisory.
- `git diff --check` passed.
