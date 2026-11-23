---
title: A name is not a generation
description: A current status read can still describe the wrong resource. Safe recovery binds leases, credentials and cleanup evidence to an immutable generation.
date: 2026-11-23
draft: false
tags: [agents, engineering, reliability]
sources:
  - claim: SuperBench v0.0.1 added automatic reclaim for released idle benches and allows a reclaimed key to be created again; the release describes SuperBench as an experimental single-host prototype.
    url: https://github.com/SuperJackfruitLabs/superbench/releases/tag/v0.0.1
  - claim: Treaty v0.0.15 published the reclaim operation and the reclaiming and reclaimed lifecycle phases.
    url: https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.15
  - claim: AgentPod PR #907 added reclaim-aware registered-launch behavior, including recreate-after-reclaim and recovery for lost replies and unresolved leases.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/907
  - claim: AgentPod PR #908 bound lease recovery to SuperBench bench_id generations and records the generation gap found while reviewing PR #907.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/908
  - claim: The reclaim regression tests distinguish same-generation evidence, replacement generations, late grants and pre-upgrade records with no recorded generation.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/9e660539c6d6b924e0de897ca80c2629c6012e56/apps/node-agent/internal/benchlaunch/reclaim_test.go
  - claim: AgentPod PR #909 added recovery for a bench stuck before ready while requiring a journaled initialization grant for the same generation and refusing admin-stop escalation.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/909
  - claim: The stuck-bench tests cover mismatched owners and generations, refused or lost stop replies, lost create replies and recreation that returns the old generation.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/a583d63fd5c523ea34f5b99a42331a264432add4/apps/node-agent/internal/benchlaunch/stuck_test.go
  - claim: AgentPod v0.1.131 includes the commits from PRs #907, #908 and #909.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.131
---

A workspace is reclaimed. Later, a workspace with the same key appears. A fresh status read says the key is active again.

It is tempting to treat that as one resource leaving and returning. It is not. The name came back; the resource did not.

That distinction shaped a three-pull-request recovery thread in AgentPod's new integration with SuperBench. The first repair taught AgentPod to handle reclaimed workspaces and settle attempts whose replies had gone missing. Review then exposed a harder problem: SuperBench gives each creation a fresh `bench_id`. The same stable key can therefore lead to a different generation, with a different owner and different credentials.

A status read can be perfectly current and still be evidence about the wrong object.

The resulting rule reaches beyond agent infrastructure: **use a durable name to locate a resource, but use an immutable generation to decide whether old evidence still applies.**

## The key came back

SuperBench keeps a task's worktree warm behind a stable key. In [v0.0.1](https://github.com/SuperJackfruitLabs/superbench/releases/tag/v0.0.1), it added automatic reclaim for released Fresh benches that remain idle beyond a grace period—24 hours by default. Once reclaimed, the same key can be created again.

That is useful lifecycle behavior. The key remains the place where a later attempt asks for the task's workspace, while reclaim allows idle storage to disappear. But recreating the key does not revive the old bench. SuperBench assigns the new creation a new `bench_id`.

[Treaty v0.0.15](https://github.com/SuperJackfruitLabs/treaty/releases/tag/v0.0.15) published the corresponding contract vocabulary: a reclaim operation and the `reclaiming` and `reclaimed` phases. AgentPod had to understand those phases when preparing a registered workspace.

The first integration had several practical problems. A status response for a reclaimed key could not be parsed. A reclaimed key looked like an existing workspace rather than a request to create a replacement. An older attempt could also remain parked when a release reply was lost or a lease request never resolved.

[AgentPod PR #907](https://github.com/SuperJackfruitLabs/agentpod/pull/907) repaired that behavior. A reclaimed key now selects one create operation, while a reclaim still in progress remains pending. Recovery also used reclaim as cleanup evidence: SuperBench reclaims only a released, idle bench, so seeing `reclaiming` or `reclaimed` appeared to show that an older attempt no longer held a lease.

The inference looked reasonable:

```text
status(key) == reclaimed
therefore my unresolved lease on key is gone
```

It was missing one field.

## Fresh state, wrong object

While reviewing that first change, the team found the gap recorded in [PR #908](https://github.com/SuperJackfruitLabs/agentpod/pull/908): reclaim proves a lease is gone only for the generation that received that lease.

Consider two incarnations behind one logical name:

```text
key: card-42

bench_id: A  -> leased -> released -> reclaimed
bench_id: B  -> created under the same key -> leased by someone else
```

A lookup by `card-42` tells a controller where to ask. It does not tell the controller whether the answer describes generation A or generation B.

That creates two symmetrical hazards. Old state about A can be mistaken for authority over B. New state about B can be mistaken for proof that an unresolved operation on A has settled. In either case, the status response is current. The correlation is wrong.

This pattern is common outside workspaces. A Kubernetes object can be deleted and recreated under the same namespace and name but receive a different UID. A cloud instance label can outlive an instance. A queue consumer name can be reused by another process. A database job can be restarted under the same human-readable identifier. Stable names are valuable for discovery; they are unsafe as the sole identity of an incarnation.

## Bind the journal before sending

The repair was to carry `bench_id` through the durable recovery record, not merely observe it when convenient.

Before a lease request leaves AgentPod, the journal records the generation obtained from the create reply or a status read. When a grant arrives, the grant is checked and bound to the generation it names. Later, `reclaiming` or `reclaimed` can settle an unresolved lease only when the status response names that recorded generation.

If the key now points to another generation, recovery does not guess. The old record remains parked. If the late grant eventually appears in the operation receipt, AgentPod can release it using that grant's own token. A grant for a generation other than the one targeted by the lease request is refused and released rather than adopted.

One detail is especially important: an older journal record with no generation is not upgraded by reading whatever generation happens to exist during retry. The request has already left. A later read cannot prove which incarnation the request targeted, so recovery preserves the ambiguity instead of manufacturing certainty.

The public [`reclaim_test.go`](https://github.com/SuperJackfruitLabs/agentpod/blob/9e660539c6d6b924e0de897ca80c2629c6012e56/apps/node-agent/internal/benchlaunch/reclaim_test.go) pins those distinctions. Its cases include:

- the same generation reaches `reclaimed`, which settles the unresolved old lease;
- another generation appears, which leaves the record parked until a late grant can be handled;
- a grant arrives for another generation, which is refused and released;
- a pre-upgrade record has no generation, which remains ambiguous on retry.

The tests also preserve a narrower lifecycle proof. After a release has been refused, observing a later generation can prove the earlier grant ended because SuperBench creates the replacement only after reclaiming the released predecessor. That is not a generic rule that “different means done.” It is a documented transition in this particular lifecycle.

The broader recovery condition is more precise:

```text
journaled_effect = {
  logical_name,
  generation,
  request_id,
  effect,
  receipt
}

settle the effect only when:
  observed.generation == journaled_effect.generation
  or a documented lifecycle invariant proves
     that journaled_effect.generation ended
```

Names locate. Generations identify. Lifecycle invariants can bridge between generations, but only when the system explicitly guarantees the transition.

## Recover the owner you can prove

The same rule then addressed a failure users could encounter before a bench ever became ready.

A previous attempt could leave a registered bench stuck in `materializing` or `initializing` under the initialization owner. The next attempt would choose a lease, SuperBench would refuse it, and the launch could remain blocked indefinitely.

The unsafe recovery would be “stop whatever owns this key.” That turns a local retry into administrative authority over a resource that may belong to someone else.

[PR #909](https://github.com/SuperJackfruitLabs/agentpod/pull/909) instead makes recovery prove ownership of the exact generation:

1. The later attempt records the stuck bench's `bench_id` before trying to replace it.
2. It searches its journal or operation receipt for the earlier initialization grant on that same generation.
3. Only the matching token may stop that owner.
4. With no token—or a token for another generation—the attempt parks as `bench_stuck`.
5. It does not escalate to an administrative stop.

Stop and create are journaled as separate named steps. If a stop reply is lost, recovery reads status to settle that step rather than intentionally sending another stop. If a create reply is lost, it consults the operation receipt. A successful replacement must return a new `bench_id`; returning the stuck generation is treated as a refusal, not success.

The [`stuck_test.go`](https://github.com/SuperJackfruitLabs/agentpod/blob/a583d63fd5c523ea34f5b99a42331a264432add4/apps/node-agent/internal/benchlaunch/stuck_test.go) cases make the authority boundary concrete: an owner held by another node, a grant from another generation, refused and lost stop replies, a lost create reply, a recreate refusal and a recreate that incorrectly returns the old generation.

This is conservative recovery by design. Progress is allowed only when the journal proves both the operation and its target. Otherwise the ambiguity stays visible for an operator instead of being converted into a destructive guess.

## Lost replies are normal inputs

All three changes treat lost replies as part of the protocol rather than an exceptional afterthought.

A create may succeed while its reply disappears. A release may happen before the caller receives confirmation. A lease grant may arrive late, after a retry has observed a replacement generation. A stop may take effect while the network loses the response.

Blindly repeating those operations can affect a new incarnation or duplicate an effect. AgentPod instead journals the chosen operation, reuses its request identity, reads receipts where available and consults generation-aware status to settle uncertainty.

That is more specific than claiming abstract “exactly once” execution. The implementation gives retries the identity needed to refer to the same intended stop, create or lease, and it defines what evidence may settle each journaled step. When the available evidence cannot establish that identity, it parks.

For systems that recover external side effects, that suggests six rules:

1. **Record the generation before the side effect leaves.** A generation learned only after an ambiguous request cannot safely be assumed to be its target.
2. **Treat names as locators, not identities.** A reused name can return fresh state about a different object.
3. **Bind credentials and receipts to the generation.** A valid token for generation A is not authority over generation B.
4. **Make ambiguity visible.** A parked state is safer than guessing that a lease disappeared or that an owner is yours.
5. **Give retries stable operation identity.** Reuse request IDs and receipts instead of inventing a new effect after a lost reply.
6. **Test reincarnation and delay.** Include reclaim then recreate, old request then late grant, and effect succeeded then reply was lost—not only the ordinary happy path.

## A generation is part of the evidence

The reclaim lifecycle shipped in [SuperBench v0.0.1](https://github.com/SuperJackfruitLabs/superbench/releases/tag/v0.0.1), which describes itself as an experimental single-host prototype. The AgentPod changes from PRs #907, #908 and #909 are listed in [AgentPod v0.1.131](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.131). AgentPod's registered-launch design remains proposed and off by default.

Those limits matter. This is not a claim that the integration is production-proven. It is a compact account of a failure mode that applies anywhere resources can be deleted and recreated behind durable names.

Recovery systems often ask whether their latest read is fresh. They should ask one more question: fresh state about which incarnation?

Without that correlation, a controller can read the truth and still act on a lie. The name tells it where the resource lives. The generation tells it whether the evidence, credential and unfinished operation belong together.