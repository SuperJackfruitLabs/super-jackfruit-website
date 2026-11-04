# Verification: Why we built Salaam

## Verdict

**Publishable: true.** Every material factual claim in the article is supported by the cited public sources after the correction below. No publication blocker remains. The article intentionally remains `draft: true` for the publication stage.

## Scope and method

I checked the draft claim by claim against the public, version-pinned sources listed in its front matter and the brief. For the shipped change, I also inspected merge commit [`f23624f3a0338c11b751f195a457fdd829687603`](https://github.com/SuperJackfruitLabs/salaam/commit/f23624f3a0338c11b751f195a457fdd829687603), including the exact source and regression-test diff. The verification used the tagged `v0.0.1` and `v0.0.7` repository contents rather than the repository's moving default branch.

## Claims checked

| Article claim | Public evidence | Finding |
| --- | --- | --- |
| From its first release, Salaam called itself a persistent home for agent work and said work should outlast a terminal. | [`README.md` at `v0.0.1`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md); [release `v0.0.1`](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1) | Supported. The README uses both formulations, and the release describes persistent sessions across terminal, SSH and ACP editor clients. |
| The initial requirements concern client closure, duplicate resubmission on reconnect and stronger evidence than an agent saying “done.” | [`README.md` at `v0.0.1`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md) | Supported nearly verbatim. |
| The service, rather than a client, owns session lifecycle, durable dispatch, task state, policy, approvals, receipts and recovery; a pinned Pi worker owns the conversation tree. | [`docs/architecture.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md) | Supported by the “Who owns what” table. |
| Terminal, SSH and ACP editor clients attach to the same service and a second client sees the same session IDs, task steps, approvals and results. | [`docs/architecture.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md) | Supported. |
| A client saves a stable request ID before transmission; a lost reply can be retried as the same logical request; the service returns saved acceptance; reconnect catches up from a committed-event cursor. | [`docs/architecture.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md) | Supported by “Detach and reconnect.” |
| Detachment leaves admitted work running, while service or worker death interrupts dispatched attempts; interrupted work requires inspection and explicit continuation rather than silent replay; safely queued work keeps its identity. | [`docs/architecture.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md); [`docs/reliability.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md) | Supported. The article correctly avoids claiming survival through every crash or power loss. |
| Checked tasks bind a plan, steps, budgets, workspace and acceptance checks; final success needs fresh check receipts and deliverable evidence. | [`docs/architecture.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md) | Supported by “Coding and checked completion.” |
| A model response alone does not certify task or operation success, and approvals bind the reviewed target, arguments, expected version, policy and worker. | [`docs/architecture.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md); [`docs/reliability.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md) | Supported. |
| In `0.0.6`, a plain `salaam` session was read-only with no commands, rejected pasted images with the quoted error and sent `@` mentions as bare text; coding sessions already supported attachment. | [PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114); [release `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7); [`CHANGELOG.md` at `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/CHANGELOG.md) | Supported. The article correctly presents this as an extension to plain local sessions, not the invention of attachment support. |
| PR #114 changed the submissions route from `localCoding(id)` to `localWorkspace(id)`, added a read-only workspace regression test and kept board-session input unchanged. | [PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114); [merge commit](https://github.com/SuperJackfruitLabs/salaam/commit/f23624f3a0338c11b751f195a457fdd829687603); [release `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) | Supported by the source diff, `mentions-service` test and release notes. |
| PR #114 shipped in Salaam `0.0.7`. | [PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114); [release `v0.0.7`](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) | Supported: the release lists PR #114 under “What's Changed.” |
| The existing “The suite, explained” post mentions Salaam only as a persistent session rather than covering this origin story and architecture in depth. | [“The suite, explained”](https://superjackfruit.com/blog/the-suite-explained) | Supported as a novelty/overlap check. |

## Correction made

The draft ended by saying, “The fix was six characters longer in code.” That count was incorrect: the functional replacement is `localCoding(id)` → `localWorkspace(id)`, a three-character increase in the predicate name. I replaced the sentence with the accurate, count-free statement: “The code change replaced one predicate.”

No other factual correction was required.

## Publication blockers

None.
