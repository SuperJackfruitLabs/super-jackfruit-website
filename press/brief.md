# Brief: Why we built Salaam

## Working title

**Why we built Salaam: agent work should outlast the terminal**

Alternatives:

- **The terminal is a window, not the home for agent work**
- **Closing the terminal should not end the work**

## Angle

Tell the origin story through the product constraint that has been present since Salaam's first public release: an agent's work must not share the lifetime of the terminal window used to watch it.

The recent shipped hook is [Salaam 0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7), specifically [pull request #114](https://github.com/SuperJackfruitLabs/salaam/pull/114). A plain, read-only local session rejected pasted images and left `@` file mentions as text because the submission route equated “local” with “coding.” Changing `localCoding` to `localWorkspace` fixed the immediate bug. More importantly for this article, it is a small example of the larger reason Salaam exists: the session is the durable object; terminal, SSH and editor clients are ways into it, and coding is only one way to use it.

Do **not** make the predicate bug the main lesson again. Use it as the opening scene and current proof that the original product idea still shapes shipped changes.

## Thesis

We built Salaam because terminal-native agent work had three lifetime and trust problems that a chat transcript alone could not solve:

1. Closing a client should not discard the session or work already admitted.
2. Reconnecting should resume the same work, not submit the same instruction twice.
3. A model saying “done” should not be the only evidence that a task or operation succeeded.

Salaam answers by moving ownership out of the client and into a host-local session service. The service keeps the durable record—accepted instructions, tasks, approvals, results and operation receipts—while terminal, SSH and ACP editor clients attach to it. Version 0.0.7's local-session attachment fix is a useful reminder that this design is about a persistent home for *agent work*, not merely a better coding terminal.

## Reader

Developers building agent CLIs, editor integrations, persistent assistants or unattended workflows. Assume they know terminal agents but have not seen Salaam's service/client split.

## Reader payoff

The reader should leave with a practical design test: if closing, reconnecting or switching clients changes the identity of the work, then the client still owns too much state. Durable agent systems need a work identity and record independent of any one interface, plus evidence for completion that is stronger than the model's final sentence.

## Why this is timely and not already covered

- **Recent shipped change:** PR [#114](https://github.com/SuperJackfruitLabs/salaam/pull/114) merged on 1 November 2026 and shipped in [0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) on 2 November 2026.
- **The change exposes the premise cleanly:** a read-only workspace session was local and persistent even though it was not a coding session. The fix made paste and mention behavior follow workspace locality instead of a coding-mode label.
- **The origin claim is public and contemporaneous:** the [README at v0.0.1](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md) already says “Work should outlast a terminal” and names the same three problems above; the [first release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1) describes persistent sessions across terminal, SSH and ACP clients.
- **Novelty check:** the public blog's [“The suite, explained”](https://superjackfruit.com/blog/the-suite-explained) gives Salaam one sentence as the suite's persistent session. It does not explain why the product was built, the failure modes it addresses, or its service/client architecture. The new article should deepen that sentence, not repeat the suite tour.

## Suggested structure

### 1. Open on a contradiction in 0.0.6

A plain `salaam` session was local, read-only and attached to a workspace. Yet pasting an image produced “Only a local session takes pasted images,” and `@` mentions went through as bare text. Coding sessions already accepted both.

PR [#114](https://github.com/SuperJackfruitLabs/salaam/pull/114) found the mismatch: the route asked whether the session was `localCoding` when it needed to know whether it had a `localWorkspace`. [Version 0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) shipped the correction and kept board sessions unchanged.

Pivot quickly: the interesting distinction is not images. It is that “session,” “client,” “workspace” and “coding mode” are different concepts. Salaam was built around keeping those concepts separate.

### 2. Name the original problem: work inherited the window's lifetime

Use the wording from the [v0.0.1 README](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md):

- closing a client must not discard the agent's session;
- reconnecting must not resend the same instruction;
- “done” in a model response must not be the sole success signal.

Explain the common failure pattern without claiming undocumented history: when conversation, dispatch and evidence live only in an interactive process, a dropped terminal creates ambiguity. Did the service accept the instruction? Is work still running? Should the client retry? Did the operation happen even though its response was lost?

Phrase this as the engineering problem documented by Salaam, not as a quote about a private incident or an unrecorded founder anecdote.

### 3. Make the terminal a client, not the owner

Use the public [architecture document pinned to 0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md) to explain the split:

- terminal, SSH and ACP editor are clients;
- a host-local service owns session lifecycle, durable dispatch, task state, policy, approvals, receipts and recovery;
- a pinned Pi worker owns the conversation tree;
- reconnecting reads committed events from a cursor and returns the saved acceptance for the same request rather than creating a new attempt.

The memorable line for the draft: **the terminal is a window onto the work, not the place the work lives.** Mark it as editorial synthesis, not a maintainer quotation.

### 4. Persistence is not automatic retry

This distinction is essential to the “why.” According to [the architecture](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md) and [reliability guide](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md):

- detaching a client leaves admitted work running;
- a service or worker crash interrupts dispatched work;
- interrupted or uncertain work is inspected and explicitly continued rather than silently replayed;
- stable request IDs let a client recover the same accepted submission.

The goal is not “never lose anything” or “always keep running.” It is to preserve identity and uncertainty honestly so reconnection does not duplicate effects.

### 5. “Done” needs a durable meaning too

The same architecture separates a model response from task success. A checked task requires fresh acceptance evidence tied to its workspace and execution configuration; an approval applies to the operation reviewed. This is the third reason from the original README, not a secondary feature list.

Keep this section concrete and short. The article is about why Salaam exists, not a catalogue of every task, policy or sandbox control.

### 6. Return to the 0.0.7 fix

Close the loop: the attachment bug happened because one product mode stood in for another property. The fix matters beyond image paste because it keeps a plain local session first-class. Salaam's durable object is the session and its work; coding authority is a separate dimension.

End with a compact design checklist for other agent clients:

1. Give work an identity independent of the UI process.
2. Persist acceptance before a client can lose the response.
3. Reconnect by cursor and stable request identity; do not recreate the turn.
4. Record uncertain effects instead of treating silence as failure or success.
5. Bind completion to evidence, not only the model's prose.
6. Keep locality, workspace access and coding authority as separate capabilities.

## Fact and claim ledger

| Claim | Public evidence | Confidence / wording |
|---|---|---|
| Salaam was publicly framed from its first release as a persistent home for agent work, where work should outlast a terminal. | [README at v0.0.1](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md), [release 0.0.1](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1) | High. This supports “why we built it” as a documented product rationale. Do not add private motives. |
| The motivating requirements were that closing a client not discard a session, reconnecting not resubmit an instruction, and model prose not be the only proof of success. | [README at v0.0.1](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md) | High. Paraphrase or quote briefly. |
| Terminal, SSH and ACP editor clients connect to the same service-owned durable record. | [Architecture at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md), [release 0.0.1](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1) | High. |
| Reconnection uses saved acceptance and committed-event cursors instead of creating another attempt. | [Architecture at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md), [reliability at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md) | High. |
| Detach and crash have different semantics; interrupted work is not silently replayed. | [Architecture at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md), [reliability at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md) | High. Avoid “survives every crash.” |
| A checked task needs fresh evidence; a model's final message does not certify success. | [Architecture at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md), [reliability at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md) | High. |
| A plain local workspace session rejected pasted images and left `@` mentions as text until 0.0.7. | [PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114), [release 0.0.7](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7) | High. |
| PR #114 changed the submission check from `localCoding(id)` to `localWorkspace(id)` and added a focused regression test; board sessions remain unchanged. | [PR #114 files](https://github.com/SuperJackfruitLabs/salaam/pull/114/files), [merge commit](https://github.com/SuperJackfruitLabs/salaam/commit/f23624f3a0338c11b751f195a457fdd829687603) | High. |
| “The terminal is a window onto the work, not the place the work lives.” | Synthesis from the documented architecture. | Medium. Use as the article's framing, not as a quotation or claimed maintainer statement. |

## Public sources to cite

1. [Salaam README at the first release](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.1/README.md)
2. [Salaam 0.0.1 release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.1)
3. [Architecture at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/architecture.md)
4. [Reliability guide at v0.0.7](https://github.com/SuperJackfruitLabs/salaam/blob/v0.0.7/docs/reliability.md)
5. [Merged PR #114](https://github.com/SuperJackfruitLabs/salaam/pull/114)
6. [PR #114 file diff](https://github.com/SuperJackfruitLabs/salaam/pull/114/files)
7. [Salaam 0.0.7 release](https://github.com/SuperJackfruitLabs/salaam/releases/tag/v0.0.7)
8. [“The suite, explained”](https://superjackfruit.com/blog/the-suite-explained) — novelty and overlap check only

## Guardrails for the draft

- Do not invent a private founding anecdote, user complaint, timeline or quote. “Why” must mean the rationale documented in the public README, releases and architecture.
- Do not say work always survives a service, worker, machine or power failure. Detach is durable; a crash can interrupt work and requires inspection.
- Do not describe reconnection as automatic replay. The public docs explicitly distinguish reconnecting from retrying uncertain execution.
- Do not imply a model response is worthless. The narrower claim is that it does not by itself certify an operation or checked task.
- Do not portray PR #114 as the invention of attachments. Coding sessions already accepted pasted images and mentions; 0.0.7 extended that behavior to plain local workspace sessions.
- Do not call a plain workspace session a sandbox. The cited source supports read-only/no commands, not a general OS security guarantee.
- Do not say board sessions cannot carry images by any route. The evidence only says this paste/mention submission path left board input unchanged.
- Do not turn the article into a full feature inventory or suite overview. Stay with persistence, identity, reconnect semantics and evidence-backed completion.
- Cite only public URLs. Do not mention internal systems, private repositories or unpublished implementation history.

## Recommended description

We built Salaam around a simple constraint: agent work should not disappear with a terminal window. A recent local-session fix shows why the session—not the client or coding mode—has to be the durable object.
