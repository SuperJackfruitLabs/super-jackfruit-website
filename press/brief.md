# Brief: A name is not a generation

## Recommendation

Write the article.

Anchor it on a real recovery failure in the new SuperBench–AgentPod path. A bench could be reclaimed and then created again under the same key. The first AgentPod integration treated the key as the identity: seeing that key in `reclaiming` or `reclaimed` was enough to conclude that an unresolved lease was gone. Review exposed the missing dimension. SuperBench assigns every create a fresh `bench_id`; the same key can therefore refer to a different generation. The repair bound journaled lease state to that immutable generation, then used the same rule to recover benches stuck before `ready` without stopping work owned by somebody else.

**Working title:** **A name is not a generation**

**Alternative titles:**

- **The resource came back. It was not the same resource.**
- **Reuse the key; never reuse the identity**
- **Recovery needs a generation, not just a resource name**

**One-sentence thesis:** When a durable resource name can be deleted and recreated, recovery records must bind requests, leases and cleanup evidence to an immutable generation; otherwise a perfectly current status read can be evidence about the wrong object.

**Why an outside developer should care:** This is not peculiar to agent workspaces. Kubernetes objects, cloud instances, queue consumers, lock holders, temporary environments and database jobs are routinely recreated under stable names. A controller that journals only the name can misread a new incarnation as proof about an old request, release the wrong lease, or apply a stale credential to a new owner. The shipped thread demonstrates a reusable pattern: generation-stamp every side effect, make ambiguous recovery park visibly, and test lost replies rather than only ordinary success.

**Confidence in the angle: high.** The original failure modes, review-discovered gap, lifecycle invariants, merge history, tests and numbered releases are all public. The article should retain SuperBench’s own qualification that v0.0.1 is an experimental single-host prototype.

## The story to tell

### 1. Open on the apparently harmless stable key

SuperBench keeps one task’s worktree warm under a stable key. Its first numbered release added automatic reclaim: after a released Fresh bench sits idle for the configured grace period (24 hours by default), the service can reclaim its storage. A later attempt may create the same key again. The public release description is explicit that this is a lifecycle feature, not merely garbage collection: reclaimed keys can be created again, and doing that advances the quota ledger format.

Source and release status: [SuperBench v0.0.1](https://github.com/SuperJackfruitLabs/superbench/releases/tag/v0.0.1), published 22 November 2026.

Treaty v0.0.15 shipped the corresponding public contract vocabulary: the reclaim operation, `reclaiming` and `reclaimed` phases, and lifecycle cases. That release warns readers of SuperBench responses to handle the widened phase enum.

Source and release status: [Treaty v0.0.15](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.15), published 22 November 2026.

The tempting inference was:

```text
status(key) == reclaimed
therefore my old lease on key is gone
```

That inference omits which incarnation of `key` the old lease targeted.

### 2. Show the first integration—and the stale-state failure it repaired

[AgentPod PR #907](https://github.com/SuperJackfruitLabs/agentpod/pull/907) taught the node-side coordinator to understand the new phases. Before it:

- the status read before every prepare could not parse a reclaimed bench;
- a reclaimed key was treated as an existing workspace instead of a request to create a fresh generation;
- an older attempt could keep the key parked forever when its release reply was lost or its lease reply never resolved.

The PR made `reclaimed` choose one create for the same key and made `reclaiming` remain pending until the transition finished. It also used reclaim as cleanup evidence: because SuperBench reclaims only a released, idle bench, `reclaiming` or `reclaimed` appeared to prove that the old attempt held no lease.

The tests were stronger than a happy-path status check. They exercised status and create over the real Unix-socket path, a lost create reply, a lost release reply, an unanswered lease and exactly-once choice reuse. The PR reports that each new guard was reverted independently and its named test went red.

Release status: PR #907 merged to `main` on 18 November as [`87729afe…`](https://github.com/SuperJackfruitLabs/agentpod/commit/87729afe6751ca6edca273da0e364153a7693dcc), with 20 checks passing. Its three commits are listed in [AgentPod v0.1.131](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.131), published 22 November.

### 3. Let review change the model: the key survived; the object did not

The follow-up [PR #908](https://github.com/SuperJackfruitLabs/agentpod/pull/908) records the gap found while reviewing #907:

> SuperBench gives every create a fresh `bench_id` that is never reused, so a reclaim proves a lease gone only for the generation that lease went to.

A stable key answers **where to look**. `bench_id` answers **which incarnation the record describes**.

The fix changed the journal and recovery rules:

1. Before sending a lease, record the generation from the create reply or a status read.
2. When the grant arrives, bind the record to the generation named by the grant.
3. Treat `reclaiming` or `reclaimed` as proof for an unresolved lease only when status names the recorded generation.
4. If status shows a different generation, keep the old record parked; if the late grant later appears in the receipt, release it with its own token.
5. Refuse and release a grant that arrives on a generation other than the one the lease request targeted.
6. Do not retrofit a generation onto old journal records after the request has already left. Ambiguity remains visible rather than being guessed away.

This is the article’s central engineering lesson: **fresh state is not necessarily state about the same object**.

The public test file pins the distinction. [`reclaim_test.go`](https://github.com/SuperJackfruitLabs/agentpod/blob/9e660539c6d6b924e0de897ca80c2629c6012e56/apps/node-agent/internal/benchlaunch/reclaim_test.go) covers:

- same generation reclaimed → the unresolved old lease is gone;
- another generation appears → stay parked until the late grant can be released;
- a grant on another generation → refuse and release it;
- a pre-upgrade record with no generation → stay parked and do not adopt one on retry;
- after a refused release, the same generation still held is not proof, while a later generation is proof because SuperBench creates it only after reclaiming the earlier released generation.

Release status: PR #908 merged to `main` on 18 November as [`9e660539…`](https://github.com/SuperJackfruitLabs/agentpod/commit/9e660539c6d6b924e0de897ca80c2629c6012e56), with 20 checks passing. Its two commits are included in AgentPod v0.1.131.

### 4. Apply the generation rule to the failure users actually hit

[PR #909](https://github.com/SuperJackfruitLabs/agentpod/pull/909) starts from a concrete stuck state:

> A card whose earlier attempt left its bench stuck before `ready` (`materializing` or `initializing` under the `initialization` owner) stayed blocked: the bridge chose a lease, SuperBench refused it, forever.

The recovery could not safely say “stop whatever owns this key.” It had to prove ownership of the exact generation:

1. The next registered-launch attempt sees the pre-ready phase and chooses a create with its own idempotency key.
2. Before creating, it records the stuck generation’s `bench_id`.
3. If that generation is still owned, it searches the journal or operation receipt for the earlier initialization grant on the same generation.
4. Only that matching token may stop the owner. With no token—or a token from another generation—the attempt parks as `bench_stuck`. It never escalates to `stop_admin`.
5. Stop and create are journaled steps. A lost stop reply is settled by reading status, not by sending a second stop. A lost create reply is recovered from its receipt.
6. A successful replacement must return a new `bench_id`; returning the stuck generation is refused.

The tests make the safety boundary concrete. [`stuck_test.go`](https://github.com/SuperJackfruitLabs/agentpod/blob/a583d63fd5c523ea34f5b99a42331a264432add4/apps/node-agent/internal/benchlaunch/stuck_test.go) covers a stuck generation owned by the earlier attempt, an owner not held by this node, a grant from another generation, refused and lost stop replies, a lost create reply, a `409` recreate refusal, and a recreate that incorrectly returns the old generation. The documentation remains careful: [registered bench launch is proposed and off by default](https://github.com/SuperJackfruitLabs/agentpod/blob/a583d63fd5c523ea34f5b99a42331a264432add4/docs/BENCH_REGISTERED_LAUNCH.md).

Release status: PR #909 merged to `main` on 18 November as [`a583d63f…`](https://github.com/SuperJackfruitLabs/agentpod/commit/a583d63fd5c523ea34f5b99a42331a264432add4), with 20 checks passing. Its recovery commits are included in AgentPod v0.1.131.

### 5. Extract a reusable recovery protocol

Offer outside developers this compact model:

```text
logical_name = where clients find the resource

generation = immutable identity of one incarnation

journaled_effect = {
  logical_name,
  generation,
  request_id,
  effect,
  receipt
}

recovery may settle journaled_effect only when:
  observed.generation == journaled_effect.generation
  OR a documented lifecycle invariant proves the old generation ended
```

Then give six rules:

1. **Generation-stamp before the side effect leaves.** A generation learned only after an ambiguous request cannot safely be assumed to be the request’s target.
2. **Treat names as locators, not identities.** A reused name can lead to fresh state about a different object.
3. **Bind credentials and receipts to the same generation.** A valid token for generation A is not authority over generation B.
4. **Make ambiguity a visible state.** Parking is safer than guessing that a lease disappeared or an owner is yours.
5. **Use idempotency for retries and receipts for lost replies.** “Send again” is not a recovery protocol for stop, create or lease operations.
6. **Test reincarnation and delayed messages.** The important cases are not only create → lease → release, but reclaim → recreate, old request → late grant, and effect happened → reply was lost.

## Suggested article structure

1. **The key came back** — introduce reclaim and stable names.
2. **A status read that was current and still wrong** — same key, different generation.
3. **The first fix** — parse reclaim phases, recreate once, clean up lost replies.
4. **The review gap** — why reclaim evidence must name the lease’s generation.
5. **Bind the journal before sending** — walk through #908’s rules and tests.
6. **Recover without becoming an administrator** — #909’s same-generation token check and no-`stop_admin` rule.
7. **Lost replies are normal inputs** — receipts, exactly-once choices and status-based settlement.
8. **The general rule** — names locate; generations identify.

## Release-status ledger

| Piece | Public evidence | Status | Confidence |
|---|---|---|---|
| SuperBench adds reclaim, idle reclaim and create-after-reclaim lifecycle behavior. | [SuperBench v0.0.1](https://github.com/SuperJackfruitLabs/superbench/releases/tag/v0.0.1) | Numbered release, published 22 Nov 2026; explicitly experimental | High |
| Treaty publishes the reclaim operation, reclaim phases and lifecycle contract material. | [Treaty v0.0.15](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.15) | Numbered release, published 22 Nov 2026 | High |
| AgentPod parses reclaim phases, recreates a reclaimed key and cleans up old attempt state. | [PR #907](https://github.com/SuperJackfruitLabs/agentpod/pull/907), [merge commit](https://github.com/SuperJackfruitLabs/agentpod/commit/87729afe6751ca6edca273da0e364153a7693dcc) | Merged to `main`; included in v0.1.131 | High |
| Lease records are bound to `bench_id`; mismatched or unknown generations fail safe. | [PR #908](https://github.com/SuperJackfruitLabs/agentpod/pull/908), [tests](https://github.com/SuperJackfruitLabs/agentpod/blob/9e660539c6d6b924e0de897ca80c2629c6012e56/apps/node-agent/internal/benchlaunch/reclaim_test.go) | Merged to `main`; included in v0.1.131 | High |
| A later attempt can recover its own stuck pre-ready generation exactly once, without an admin stop. | [PR #909](https://github.com/SuperJackfruitLabs/agentpod/pull/909), [tests](https://github.com/SuperJackfruitLabs/agentpod/blob/a583d63fd5c523ea34f5b99a42331a264432add4/apps/node-agent/internal/benchlaunch/stuck_test.go) | Merged to `main`; included in v0.1.131 | High |
| The complete AgentPod thread is distributed in a numbered release. | [AgentPod v0.1.131](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.131) | Numbered release, published 22 Nov 2026 | High |

## Organization-wide scan and novelty check

Research window: **16 November 2026 04:30:12 UTC through 23 November 2026 04:30:12 UTC**.

The scan started at the organization level. All **15 public SuperJackfruitLabs repositories** were enumerated. GitHub’s merged-pull-request index returned **49 merged pull requests** in the exact window: 38 in AgentPod, five in SuperWitness, four in Salaam and two in SuperLibrary. Public release feeds were checked for all 15 repositories and yielded **13 numbered releases** across AgentPod, SuperBench, SuperExchange, SuperPipeline, SuperToolkit and Treaty. Release notes, relevant changelogs, PR descriptions, tests and the public blog were then checked before grouping changes by purpose.

No published article covers resource generations, reclaim, stale lease evidence, stuck pre-ready benches or the SuperBench–AgentPod recovery thread. The 20 November article, “The tool call finished. The work had not,” separates RPC completion from semantic completion; this proposal is about distinguishing two incarnations behind one stable resource name. The 13 November article, “The event is the fast path; the sweep is the guarantee,” is about event-plus-reconciliation delivery. Reconciliation appears here too, but the failure and lesson are different: a fresh observation must be correlated to the generation of the old side effect.

The other open unpublished brief is “A release is a set, not a glob,” about commit-bound release-asset completeness. This proposal uses different products, failures and invariants.

## Related shipped work intentionally left out

- **AgentPod checkpoint attempt settlement ([#917](https://github.com/SuperJackfruitLabs/agentpod/pull/917) through [#926](https://github.com/SuperJackfruitLabs/agentpod/pull/926))** also appears in v0.1.131 and handles refusals, impossible settlement, ended runs and held leases. It is adjacent operationally but concerns the state of checkpoint attempts after execution, not the identity of a reclaimed workspace generation. Folding it in would obscure the generation lesson.
- **The registered-launch introduction and capacity handling ([#899](https://github.com/SuperJackfruitLabs/agentpod/pull/899), [#901](https://github.com/SuperJackfruitLabs/agentpod/pull/901), [#902](https://github.com/SuperJackfruitLabs/agentpod/pull/902), [#903](https://github.com/SuperJackfruitLabs/agentpod/pull/903), [#906](https://github.com/SuperJackfruitLabs/agentpod/pull/906))** supply earlier machinery and are useful background, but they do not contain the reclaim/reincarnation failure. Briefly define registered launch; do not retell its whole design.
- **The wider cross-product contract rollout**—AgentPod [#927](https://github.com/SuperJackfruitLabs/agentpod/pull/927) and [#933](https://github.com/SuperJackfruitLabs/agentpod/pull/933), SuperLibrary [#61](https://github.com/SuperJackfruitLabs/superlibrary/pull/61) and [#62](https://github.com/SuperJackfruitLabs/superlibrary/pull/62), and SuperWitness [#94](https://github.com/SuperJackfruitLabs/superwitness/pull/94)—serves authentication and crossing-contract coverage. Treaty v0.0.15 is included only where its reclaim vocabulary is directly causal; phase-two push and token work belongs in another article.
- **SuperToolkit’s 24-hour certificate renewal fix** in [v0.0.10](https://github.com/SuperJackfruitLabs/supertoolkit/releases/tag/v0.0.10) is a strong standalone reliability story, but it shares no causal chain with workspace generations.
- **Vibekit dependency bumps** across AgentPod, Salaam and SuperWitness are shipped presentation dependencies, not part of reclaim or lease recovery.

Within the selected thread, do not omit #907, #908 or #909: #907 establishes the initial reclaim behavior and failure being corrected; #908 supplies the generation invariant; #909 applies that invariant to the real stuck-before-ready recovery. SuperBench v0.0.1 and Treaty v0.0.15 explain the producer and public contract that AgentPod consumes.

## Accuracy guardrails for the writer

- Use **key** or **logical name** for the reusable locator and **`bench_id`** for the immutable generation. Do not call the key globally unique.
- Do not say reclaim alone always proves a lease gone. It is evidence only when correlated to the recorded generation, or when a documented lifecycle invariant proves an earlier generation ended.
- Do not say a different generation is always inconclusive. #908 deliberately distinguishes two contexts: for an unresolved lease reply it keeps the record parked until the late receipt is handled; after a refused release, a later generation proves the earlier grant gone because SuperBench creates the next generation only after reclaiming the released previous one.
- Do not present `stop_admin` as part of automatic recovery. #909 explicitly refuses that escalation; recovery stops only an initialization owner for which it has the matching generation’s journaled grant.
- Do not claim exactly-once execution in the abstract. The implementation journals named stop/create steps, reuses request IDs and consults receipts/status so retries do not intentionally resend those effects.
- State that the registered-launch design is **proposed and off by default**, even though the code shipped in AgentPod v0.1.131.
- State that SuperBench v0.0.1 is an **experimental single-host prototype**, not a production-proven platform.
- Keep product release status exact: AgentPod #907–#909 merged to `main` and are listed in v0.1.131; SuperBench reclaim is in v0.0.1; Treaty’s reclaim contract is in v0.0.15.
- Avoid private operational details or identities. Everything needed for the article is in the public releases, PRs, commits, tests and documentation linked above.
