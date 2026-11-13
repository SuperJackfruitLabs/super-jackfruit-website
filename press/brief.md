# Brief: The model does not get to grade its own dispatches

## Recommendation

Write the article. Anchor it on learned routing in [SuperDispatch v0.0.1](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.1), the project's first public release, published on 13 November 2026.

**Proposed headline:** The model does not get to grade its own dispatches

**Alternative:** Before an AI scheduler takes control, make it win in shadow

**One-sentence angle:** A learned scheduler should not move real work merely because its offline metrics look good: SuperDispatch first records what the model *would* have chosen, scores that counterfactual conservatively, and keeps the deterministic policy in charge until the model has enough data and clears an explicit live-performance gate.

**Confidence:** High. The release, tag-pinned documentation, implementation and tests are public and agree on the behaviour.

## Why this change is worth an article

Putting a model behind a routing decision is easy. Establishing that it improves the live system is harder because the counterfactual is usually missing: if the existing formula offered work to candidate A, nobody knows whether candidate B—the model's choice—would have accepted it.

SuperDispatch v0.0.1 makes that uncertainty part of the promotion rule rather than hiding it in a dashboard. In shadow mode, the model records a choice but the deterministic formula still controls the hold. When model and formula disagree, the model receives credit only if its candidate later claims the card anyway; otherwise the result is unknown and counts as a miss. Decisions made by the model itself are excluded from the evidence used to promote it. The result is deliberately a lower bound on model performance.

The shipped defaults add three more brakes: learned routing is off unless enabled; a model needs at least 500 training rows and 100 informative shadow decisions; and its conservative shadow claim rate must beat the formula's by at least five percentage points. If any check fails—or the model's feature set no longer matches—the formula keeps placing work and the service records why.

That is broadly useful to developers shipping recommendations, queues, assignment systems, fraud rules or any model that may later control a production decision. The reusable lesson is not the particular model. It is to define the evidence needed for authority *before* switching authority on.

## Reader and payoff

**Reader:** Developers and operators introducing learned decisions into a system that already has a deterministic policy.

**Payoff:** A practical promotion pattern:

1. **Keep a baseline in control.** Shadow predictions must not change the decisions they evaluate.
2. **Record the counterfactual.** Store both the baseline choice and the model's proposed choice with the eventual outcome.
3. **Treat missing evidence as missing.** Do not convert an unoffered alternative into a synthetic success.
4. **Prevent self-evaluation.** Outcomes from decisions the model controlled cannot be evidence that the model deserved control.
5. **Gate authority explicitly.** Require a minimum dataset, a minimum live shadow sample, a margin over baseline and feature compatibility.
6. **Fail back to the boring path.** A failed gate should leave the known policy in charge and expose the refusal reason.

## The shipped change

Primary public change:

- [SuperDispatch v0.0.1](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.1), published 13 November 2026. Its release notes ship the labelled dataset, deterministic logistic model, shadow mode and promotion gate together.

Tag-pinned implementation:

- [Learned-routing documentation at the release commit](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/README.md#L248-L309)
- [Dataset labels and training-target rules](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/dataset.ts#L1-L27)
- [Shadow evaluation and promotion gate](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L1-L19)
- [Gate refusal paths](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L122-L143)
- [Runtime fallback to the deterministic formula](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/loop/learned.ts#L129-L150)

The article should stay on this one engineering change: how learned routing earns authority. Do not turn it into a broad product launch or enumerate every feature in the first release.

## Suggested narrative

### 1. Start with the counterfactual the log cannot prove

Suppose the current policy chooses candidate A and the model prefers B. A accepts the work. Did the model lose? Maybe. But if B never received the offer, the system has no direct evidence that B would have accepted.

Conversely, if B later claims the same work after A's hold lapses, the system has positive evidence for the model's choice. The asymmetry matters.

### 2. Separate prediction from authority

SuperDispatch has three modes:

- `off`: the model is not read;
- `shadow`: the model's proposed choice and scores are recorded, while the formula still controls the hold;
- `on`: the model may control the hold, but only after passing the gate.

This is more than a feature flag. Shadow mode creates the evidence needed to evaluate a policy without allowing that policy to alter the sample.

### 3. Explain the conservative score

When model and formula agree, both inherit the observed outcome. When they disagree, only the formula's candidate definitely received the opportunity. The model is credited only when its candidate claims anyway. All other disagreements are unknown and count against the model's lower-bound rate.

The article should be precise here: this does **not** reveal the true counterfactual success rate. It intentionally under-credits the model so uncertainty cannot be mistaken for proof.

### 4. Show why the model cannot grade itself

Once the model starts acting, those acted decisions are excluded from its shadow evidence. Otherwise a policy could alter who receives opportunities, then cite outcomes created by those choices as proof that it should retain control.

This is the most reusable idea in the change: promotion evidence must remain independent of the policy being promoted.

### 5. End with the authority gate

At the shipped defaults, the model needs:

- at least 500 training rows;
- at least 100 informative, settled shadow decisions;
- at least a five-percentage-point lift over the deterministic formula; and
- the exact feature set the current build expects.

If a condition fails, the formula places the card and the log names the first reason: no model, changed features, too few rows, too little shadow evidence or no lift.

Close with a general design test: *Can the system explain, using evidence the new policy did not manufacture, why that policy is now allowed to act?*

## Claim ledger

| Claim | Public evidence | Confidence / wording |
| --- | --- | --- |
| SuperDispatch v0.0.1 is the first public release and was published on 13 November 2026. | [Release v0.0.1](https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.1) | High. Say “public release”; do not generalize deployment beyond what the release states. |
| Learned routing ships off by default, with separate `shadow` and `on` modes. | [README at the release commit](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/README.md#L288-L299) and [runtime router](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/loop/learned.ts#L1-L14) | High. |
| In shadow mode the formula's choice controls the hold while the model's choice and scores are recorded. | [README](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/README.md#L288-L299) and [router return paths](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/loop/learned.ts#L129-L150) | High. |
| When the choices disagree, the model is credited only when its candidate claims anyway; unknown disagreements count as misses, making its reported rate a lower bound. | [Shadow-mode semantics](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L1-L19) and [calculation](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L59-L110) | High. Call it a conservative lower bound, not a causal estimate. |
| Decisions on which the model acted are excluded from the evidence used by the gate. | [Shadow report and gate](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L17-L19) and [acted-row exclusion](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L71-L79) | High. “Cannot grade itself” is the article's interpretation of this mechanism. |
| The default promotion gate is 500 training rows, 100 informative shadow decisions and five percentage points of lift. | [Configuration defaults](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/config.ts#L145-L158) and [README](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/README.md#L294-L299) | High. These are configurable defaults, not universal thresholds. |
| The gate also refuses a missing model, a changed feature set, too little data, too little shadow evidence or insufficient lift. | [Gate refusal paths](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L122-L143) | High. |
| The fallback is the deterministic formula, and the service logs why the model did not place. | [Runtime routing](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/loop/learned.ts#L96-L150) | High. Avoid promising availability properties not shown by this code. |
| Training uses only eligible candidates with a meaningful target; an unchosen candidate that was never offered work is not treated as a negative example. | [Dataset target rules](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/dataset.ts#L10-L27) and [README label table](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/README.md#L263-L286) | High. |
| Tests hold the shadow accounting and each threshold boundary. | [Learned-routing tests](https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/test/learned.test.ts#L251-L324) | High. State that the tests cover these cases, not that they prove real-world lift. |
| No published lab note currently covers learned-routing promotion or SuperDispatch. | [Live blog index](https://www.superjackfruit.com/blog/) | High as checked on 13 November 2026. |

## Boundaries and caveats

- Do not say the model has demonstrated real-world superiority. The release ships the evaluation and promotion mechanism; the public sources do not show a particular model clearing it.
- Do not call the shadow comparison a randomized experiment or causal estimate. The code explicitly treats the model's result as a lower bound because only the formula's choice was offered the work.
- The five-point margin and sample sizes are configurable defaults in this system, not recommended universal values.
- The trained target is whether a candidate claims the card, not whether the eventual work succeeds. The source explicitly leaves later run success to a different record.
- Offline holdout metrics are available, but they do not grant authority. The live shadow gate does.
- Avoid internal process, infrastructure and unpublished operating data. The public release, documentation, implementation and tests are sufficient.

## Originality and collision check

The [live blog index](https://www.superjackfruit.com/blog/) was read before selecting the topic. Its nine published notes cover the lab, the suite, SuperPipeline, AgentPod, SuperWitness, a CLI self-update failure, AI pull-request review, Salaam session durability and retry-state design. None covers SuperDispatch, shadow routing, conservative counterfactual scoring or promotion gates for learned policies.

The other open scheduled article on this board is about variant-bound human approvals—an approval must identify the exact version shown. This brief instead covers model promotion for routing decisions, so the angles do not collide.

## Source list for the eventual post

Use only public URLs:

1. https://github.com/SuperJackfruitLabs/superdispatch/releases/tag/v0.0.1
2. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/README.md#L248-L309
3. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/dataset.ts#L1-L27
4. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/learned.ts#L1-L11
5. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L1-L19
6. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/placement/shadow.ts#L59-L143
7. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/src/loop/learned.ts#L96-L150
8. https://github.com/SuperJackfruitLabs/superdispatch/blob/d8a29516f5ef0af156e5319b225cf3779b6bdf21/apps/dispatch/test/learned.test.ts#L251-L324
9. https://www.superjackfruit.com/blog/
