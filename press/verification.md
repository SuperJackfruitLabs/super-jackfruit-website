# Verification: A name is not a generation

## Verdict

**Publishable: true.** The article's material factual claims are supported by the cited public sources after the citation improvements recorded below. No publication blocker remains.

## What I checked

- **SuperBench lifecycle and release boundary.** SuperBench v0.0.1 says it is an experimental single-host prototype, adds automatic reclaim for released Fresh benches after `fresh_reclaim_idle_hours` (24 hours by default while `fresh_payload` is enabled), and creates a reclaimed key's next generation with a new `bench_id`.
- **Treaty contract vocabulary.** Treaty v0.0.15 contains the reclaim operation, the `reclaiming` and `reclaimed` phases, lifecycle obligations for interrupted replies, and the warning that the phase enum widened.
- **Initial AgentPod repair.** PR #907 says reclaimed status chooses one create for the same key, `reclaiming` parks the prepare, and the registered journal handles lost release replies and unresolved leases. GitHub records merge commit `87729afe6751ca6edca273da0e364153a7693dcc` on 18 November 2026 with 20 checks passing.
- **Generation-bound recovery.** PR #908 records the generation gap found in review of #907. Its description and `reclaim_test.go` support the article's distinctions among same-generation reclaim evidence, a different generation that must remain parked for an unresolved lease, a late or mismatched grant that is released, a pre-upgrade record with no generation, and the narrower later-generation proof after a refused release. GitHub records merge commit `9e660539c6d6b924e0de897ca80c2629c6012e56` with 20 checks passing.
- **Stuck pre-ready recovery.** PR #909 and `stuck_test.go` support the `materializing`/`initializing` failure, same-generation initialization-token check, no-`stop_admin` boundary, journaled stop/create handling, lost-reply recovery, `409` refusal, and rejection of a replacement that returns the old `bench_id`. GitHub records merge commit `a583d63fd5c523ea34f5b99a42331a264432add4` with 20 checks passing.
- **Release inclusion and guardrails.** AgentPod v0.1.131 lists all seven commits from PRs #907–#909. The pinned registered-launch document says **“Status: proposed, off by default.”**
- **Cross-domain example.** Kubernetes' object-identity documentation says a deleted object name may be reused and every object created over a cluster's lifetime has a distinct UID.

## What I changed

1. Added the pinned AgentPod registered-launch document to the article's source metadata and linked the off-by-default qualification directly to it.
2. Added Kubernetes' official object-name/UID documentation to the source metadata and linked the Kubernetes example directly to that source.

These are citation-strengthening changes, not reversals of the article's technical account.

## Validation

- `npm test`: 41/41 tests passed after installing the lockfile dependencies with `npm ci`.
- `npm run build`: Astro check completed with 0 errors (5 existing hints), and the static build generated the article route successfully.

## Publication blockers

None.