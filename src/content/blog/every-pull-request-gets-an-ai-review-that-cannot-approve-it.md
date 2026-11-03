---
title: Every pull request gets an AI review that cannot approve it
description: A shared Claude reviewer checks pull requests for bugs, security problems and repository-rule breaches while leaving every decision to a person.
date: 2026-11-03
draft: false
tags: [agents, code-review, ci]
sources:
  - claim: SuperLibrary's review instructions require separate bugs, security and compliance passes, cap displayed nits at five and define repository-specific rules.
    url: https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md
  - claim: The shared reviewer reads policy from the base branch, fences pull-request content as untrusted data, updates marker-bearing comments and does not fail CI when it errors.
    url: https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs
  - claim: SuperWitness uses the same three-pass review shape with repository-specific rules for tenant scope, documentation agreement and immutable evidence.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/REVIEW.md
  - claim: The SuperWitness copy implements the same advisory review and failed-CI triage mechanism.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/.github/claude/claude-ci.mjs
  - claim: Anthropic's AI-native SDLC playbook argues for layers of agentic review while keeping people accountable for decisions that require judgement.
    url: https://claude.com/blog/the-ai-native-sdlc-playbook
---

Every pull request gets another reader. That reader can point to a bug, a security problem or a broken repository rule. It cannot approve the change, block it or request changes. A person still decides.

That boundary is the interesting part of the Claude review added across the suite. The public [SuperLibrary](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/.github/claude/claude-ci.mjs) and [SuperWitness](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/.github/claude/claude-ci.mjs) repositories carry byte-identical copies of the shared script. Each repository then supplies its own `REVIEW.md`: one mechanism, local policy.

This is not a new merge authority dressed up as a bot. The script posts an issue comment rather than a GitHub review verdict. Its system prompt calls the result advisory, and top-level errors become notices instead of failed CI. It supplies attention; it does not get a vote.

## Three passes, with a high bar

The reviewer makes three labelled passes over the diff:

1. **Bugs** looks for incorrect behaviour, missed edge cases, races, resource leaks, lost errors and tests that cannot fail.
2. **Security** looks for exposed secrets or personal data, injection, missing authentication or authorisation, unsafe inputs and weakened checks.
3. **Compliance** checks the repository's named rule files and asks whether the diff matches the pull request's stated plan.

The [SuperLibrary instructions](https://github.com/SuperJackfruitLabs/superlibrary/blob/e484a4c3a137f99ef89f18c6f15e2b47341803e6/REVIEW.md) reserve `important` for broken behaviour, leaked data or a written-policy breach. They tell the reviewer to prefer no finding to a weak one. Generated files, lockfiles, mechanically enforced checks and matters of taste are out of scope.

That restraint continues in the renderer. Findings may be `important`, `moderate` or `nit`, but only five nits can appear. Any extras are counted instead of listed. The limit is enforced in code, not merely requested in the prompt.

Repository rules remain specific. SuperLibrary highlights safe deployment and live-data migrations. [SuperWitness](https://github.com/SuperJackfruitLabs/superwitness/blob/cec161e8683a916ae0c44efd537e15a8fc7b35f5/REVIEW.md) adds tenant-scoped reads, agreement between documentation and code, and the immutability of evidence records. Sharing a reviewer does not mean pretending every codebase has the same risks.

## The change is evidence, not policy

A pull request should not be able to rewrite the instructions used to judge that same pull request. The script therefore resolves the base ref—using the configured base ref or the pull request's base SHA—and fetches `REVIEW.md` plus its named rule files from there. Proposed edits to those files do not become policy until after they land.

The title, description and diff travel a different path. The script wraps them in nonce-bearing tags and labels them as untrusted data. Instructions found inside that data are to be reported as a security finding, not followed. The script reads the material through repository APIs; it does not check out or execute the proposed code.

This is a practical trust boundary, not proof that prompt injection has been solved. The plain-language rule is stronger because it is narrower: **the change is evidence; it is not policy**.

## One comment, not bot sediment

Automated review becomes hard to use when every push leaves another stale essay behind. This implementation gives review and failed-CI triage separate hidden markers. On a later run, it searches the bot's existing comments for the relevant marker. If one exists, the script replaces its body; otherwise it creates the comment.

The current review stays attached to one place on the pull request. Old findings do not linger as if they still described the new commit, and the comment itself records the short SHA that was reviewed.

There are honest limits. Draft pull requests are skipped. A missing API key is a no-op. If filtering leaves no reviewable files, there is no model review. A diff above the default 200 KB post-filter limit gets a “not reviewed” note. Model or API failures do not fail CI. The workflow is an advisory lane subject to explicit skip and size conditions, not a promise that every possible change receives a successful model response.

## A second lane for red CI

The same shared script can examine failed job metadata and bounded tails of job logs. It asks Claude to label a failure `likely flaky` or `likely real`, identify the most likely cause and return no more than three summary lines.

The wording matters. This is triage, not diagnosis. The comment is read-only and explicitly says that nothing was rerun. Its job is to help a person decide where to look next, not to quietly retry jobs or declare a root cause.

In a planted-bug test reported for this rollout, the review caught both planted bugs. That is a useful smoke check—and only a smoke check. Two caught defects do not establish a general success rate, prove recall or mean that the reviewer catches every bug.

## Review without transferred authority

Anthropic's [AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook) describes “layers of agentic review” while retaining human review where judgement and accountability matter. This implementation is one small, inspectable version of that separation. The model gets a structured view of the change, three explicit jobs and repository policy it cannot take from the proposed branch. The person keeps the decision.

The useful question is not simply whether an AI can review code. It is which authority that review needs, who controls its instructions and how gracefully it fails. Here, the answer is deliberately modest: let the reviewer read every eligible change, keep its comments current, and never confuse advice with approval.
