# Brief: A release is a set, not a glob

## Recommendation

Write the article.

Anchor it on a concrete SuperMessage release failure: `v0.1.2` was published without the four Android debug APKs, while the two earlier releases had those APKs only because they were uploaded by hand. The immediate repair attached the four files to the existing release. The durable repair did something more useful for outside developers: it made release assets a commit-bound, explicitly checked set. A tag now selects the artifacts built and tested by the default branch for that exact commit, and the release gate refuses to proceed if any expected desktop or Android artifact is missing, expired or belongs to another commit.

**Working title:** **A release is a set, not a glob**

**Alternative titles:**

- **The release succeeded. Four artifacts were missing.**
- **A wildcard can select artifacts. It cannot prove completeness.**
- **Build once, release exactly once — and count the outputs**

**One-sentence thesis:** Treat release artifacts as a required, commit-bound set rather than whatever files happen to match a wildcard; selection answers “what can I download?”, while an explicit manifest answers “is this release complete?”.

**Why an outside developer should care:** Multi-platform releases often fail partially. A matrix job may be skipped, an artifact may expire, a path may be wrong on only one runner, or a glob may still match *something*. If the release workflow accepts a non-empty subset, it can publish a plausible-looking but incomplete release. The SuperMessage repair demonstrates a reusable pattern: build on the default branch, key artifacts by commit, enumerate the required set at the tag gate, and test the contract among producer, selector and gate.

**Confidence in the angle: high.** The failure, merge sequence, tests, post-merge CI run and repaired release assets are public. The brief deliberately does **not** claim that the new automated path has shipped in a later numbered SuperMessage release, because no later numbered release exists in the scan window.

## The story to tell

### 1. Open on the release that looked finished

[SuperMessage `v0.1.2`](https://github.com/SuperJackfruitLabs/supermessage/releases/tag/v0.1.2) was published on 9 November 2026. Its four Android APKs were not there initially. They were added on 14 November, five days after publication; the public release page timestamps each of the arm64-v8a, armeabi-v7a, x86 and x86_64 APK assets at `2026-11-14T20:01:45Z`.

[PR #180](https://github.com/SuperJackfruitLabs/supermessage/pull/180) records the broader history: `v0.1.0` and `v0.1.1` carried APKs only through manual uploads, and `v0.1.2` shipped without them until files from its own CI run were renamed and attached. This was not a compiler failure or an absent build. The outputs existed in CI; the release process did not define them as required release members.

That distinction supplies the article’s central question:

> When a release workflow finds some matching artifacts, what proves it found *all* the artifacts the release promises?

A glob cannot answer that by itself.

### 2. Show the first architectural move: build on `main`, release the same bytes

[PR #174](https://github.com/SuperJackfruitLabs/supermessage/pull/174) replaced a tag-time desktop rebuild with a shared workflow that consumes artifacts made by the default branch for the tagged commit. It merged to `main` as [`4d443119efd4a8ab9b10e246a52b9cd7f5127e33`](https://github.com/SuperJackfruitLabs/supermessage/commit/4d443119efd4a8ab9b10e246a52b9cd7f5127e33) on 13 November.

The intended invariant was strong:

1. every push to `main` builds the three desktop targets;
2. each upload is named `desktop-<target>-<commit sha>`;
3. a `v*` tag must point at a commit whose `main` CI run passed;
4. the release downloads those already-tested artifacts rather than rebuilding at the tag;
5. release files receive checksums and provenance attestations.

This separates **building** from **publishing** without separating the release from the tested commit. It avoids the common “tested one build, released another” problem.

But the first default-branch runs exposed a second real failure. All three desktop jobs built successfully and then failed while collecting installers from `src-tauri/target/...`. Because `src-tauri` belongs to the repository’s root Cargo workspace, Tauri had written the bundles under the root `target/`. [PR #180 records three failed `main` runs and the exact `find: 'src-tauri/target/release/bundle': No such file or directory` error](https://github.com/SuperJackfruitLabs/supermessage/pull/180). With no green default-branch run, the tag gate correctly made every affected commit unreleasable.

That is worth emphasizing: fail-closed gating turned a packaging-path error into an obvious blocked release, rather than allowing a partial desktop release.

### 3. Follow the repair from “find files” to “prove the set”

[PR #180](https://github.com/SuperJackfruitLabs/supermessage/pull/180) merged to `main` as [`80af379badb4a7bf4868f58a344b6d62393354ac`](https://github.com/SuperJackfruitLabs/supermessage/commit/80af379badb4a7bf4868f58a344b6d62393354ac) on 14 November. It repaired both failure classes.

#### Fix the producer

The desktop matrix now collects from the root workspace’s bundle directories, and a test pins all three paths to `target/...`: [`test_release_assets.mjs`, lines 47–56](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/scripts/tests/test_release_assets.mjs#L47-L56).

Android release production became unconditional on pushes to the default branch:

- `android-libs` builds the four ABIs on every non-PR run, because a tag can point at any `main` commit, not just one that changed Android: [`ci.yml`, lines 689–695](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/workflows/ci.yml#L689-L695).
- `android-apks` runs on every non-PR event and consumes those libraries: [`ci.yml`, lines 886–892](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/workflows/ci.yml#L886-L892).
- The job reuses its assembled APKs, renames four ABI-specific files using the app’s `versionName`, and uploads one `android-apks-<sha>` artifact with a 30-day retention: [`ci.yml`, lines 977–1001](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/workflows/ci.yml#L977-L1001).

This deliberately spends more default-branch CI time so every commit that could receive a tag already has a complete release candidate. Pull-request jobs do not pay that cost.

#### Fix the selector

The release configuration widened its artifact selector from desktop-only to every commit-keyed release artifact:

[`"artifact": "*-{sha}"`](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/release-config.json#L1-L5)

That lets one release path fetch the three desktop artifacts and the Android bundle. It still does **not** establish completeness. A missing Android upload would leave three desktop matches; the download step could succeed.

#### Add a completeness gate

The product-specific check hook names the four required artifact prefixes:

- `desktop-universal-apple-darwin`
- `desktop-x86_64-unknown-linux-gnu`
- `desktop-x86_64-pc-windows-msvc`
- `android-apks`

For each one, it requires an unexpired artifact suffixed with the exact release commit SHA. Any absence blocks the tag and names the missing artifact: [`check.sh`, lines 13–24](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/release/check.sh#L13-L24).

This is the key lesson. The glob is a transport selector. The four-name loop is the release manifest.

### 4. Make the contract executable

The new test does not test the shell hook in isolation. It ties together all three sides of the release contract:

1. **Producer:** the workflow must upload exactly three desktop artifacts and one Android release artifact.
2. **Selector:** the configured glob must match exactly those commit-keyed release artifacts and none of the workflow’s convenience artifacts.
3. **Gate:** a fixture-backed `gh` stub exercises the real shell hook.

The public tests verify that:

- the three desktop targets remain present;
- each bundle path follows the root Cargo workspace layout;
- the configured pattern selects exactly the intended release artifacts;
- the Android artifact contains the four expected ABI names and is retained for 30 days;
- the hook accepts the complete set;
- removing or expiring *each* required artifact fails and names it;
- artifacts for a different commit SHA do not count.

Source: [`test_release_assets.mjs`, lines 45–119](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/scripts/tests/test_release_assets.mjs#L45-L119).

The PR reports 125 Node tests and 104 Python tests passing, plus clean `actionlint` and `shellcheck`. More importantly, the first public default-branch run after merge, [CI run `43641634363`](https://github.com/SuperJackfruitLabs/supermessage/actions/runs/43641634363), completed successfully. Its public job record shows all three desktop “Collect the installers” steps succeeding, the Android job collecting and uploading the release APK bundle, and the aggregate check succeeding. The run exposed all four commit-keyed release artifacts, including `android-apks-80af379…`.

Do not inflate that evidence: it proves the post-merge `main` build and artifact production path. A later `vX.Y.Z` tag would be the end-to-end proof of the automated publication path, and no such later SuperMessage release appears in this window.

### 5. End with a reusable release invariant

Offer outside developers this compact model:

```text
RELEASE_CANDIDATE(commit) = {
  desktop-macos(commit),
  desktop-linux(commit),
  desktop-windows(commit),
  android-apks(commit)
}

publish(tag -> commit) only if:
  default_branch_ci(commit) == success
  AND every member of RELEASE_CANDIDATE(commit) exists
  AND no member is expired
  AND every member is keyed to commit
```

Then extract six rules:

1. **Build once, before the tag.** Publish the bytes the default branch actually built and tested.
2. **Key artifacts to immutable source identity.** A human-readable version is useful for filenames; the commit SHA is the correlation key.
3. **Separate selection from completeness.** A wildcard can download candidates, but only an explicit required set can prove nothing is missing.
4. **Fail closed on expiry and absence.** A partial match is not a degraded release; it is no release.
5. **Test producer, selector and gate together.** Otherwise each component can be locally correct while their composition silently drops a platform.
6. **Exercise the default-branch-only path after merge.** Pull-request checks cannot prove jobs that intentionally run only on `main`.

## Suggested article structure

1. **Thirteen assets, four added five days late** — open on the public `v0.1.2` timestamps.
2. **Why “the build exists” was not enough** — CI outputs versus promised release members.
3. **Build once, release the tested commit** — the architecture introduced in #174.
4. **The root-workspace path that blocked every desktop target** — real post-merge failure and fail-closed behavior.
5. **A wildcard is not a manifest** — why `*-{sha}` still permits an incomplete release.
6. **The four-artifact gate** — exact names, SHA binding and expiry handling.
7. **Test the contract, not just the script** — producer/selector/gate integration fixtures.
8. **What is proven, and what is not yet released** — successful post-merge CI versus no later numbered tag.

## Release-status ledger

| Piece | Public evidence | Status | Confidence |
|---|---|---|---|
| Desktop release workflow moves builds to default-branch CI and releases the artifacts for the tagged commit. | [PR #174](https://github.com/SuperJackfruitLabs/supermessage/pull/174), [merge commit `4d44311…`](https://github.com/SuperJackfruitLabs/supermessage/commit/4d443119efd4a8ab9b10e246a52b9cd7f5127e33) | Merged to `main` on 13 Nov; not a numbered release | High |
| `v0.1.2` lacked Android APKs at publication; four APK assets were added on 14 Nov. | [`v0.1.2` release](https://github.com/SuperJackfruitLabs/supermessage/releases/tag/v0.1.2), [PR #180](https://github.com/SuperJackfruitLabs/supermessage/pull/180) | Existing numbered release repaired manually; APK asset timestamps are public | High |
| The first workflow’s desktop collection path was wrong for the root Cargo workspace and blocked three default-branch desktop jobs. | [PR #180](https://github.com/SuperJackfruitLabs/supermessage/pull/180), [path-pinning test](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/scripts/tests/test_release_assets.mjs#L52-L56) | Fix merged to `main` | High |
| Every default-branch run now produces commit-keyed desktop and Android release artifacts. | [`ci.yml` desktop upload](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/workflows/ci.yml#L488-L517), [`ci.yml` Android upload](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/workflows/ci.yml#L977-L1001) | Merged to `main` in [PR #180](https://github.com/SuperJackfruitLabs/supermessage/pull/180); post-merge run passed | High |
| The tag gate refuses missing, expired or wrong-commit release artifacts. | [`check.sh`](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/.github/release/check.sh#L13-L24), [tests](https://github.com/SuperJackfruitLabs/supermessage/blob/80af379badb4a7bf4868f58a344b6d62393354ac/scripts/tests/test_release_assets.mjs#L79-L119) | Merged to `main`; not yet exercised by a later numbered tag | High for code and tests; medium for end-to-end publication until the next tag |
| The repaired default-branch workflow produced all four commit-keyed artifact groups. | [CI run `43641634363`](https://github.com/SuperJackfruitLabs/supermessage/actions/runs/43641634363) | Successful post-merge `push` run | High |

## Organization-wide scan and novelty check

Research window: **13 November 2026 04:30 UTC through 20 November 2026 04:30 UTC**.

The scan started at the organization level, not with SuperMessage. All **15 public SuperJackfruitLabs repositories** were enumerated. GitHub’s merged-pull-request index returned **88 merged pull requests** in the exact window, across `.github`, AgentPod, Salaam, SuperLibrary, SuperMessage and SuperWitness. Public release feeds were checked for every repository and yielded **14 numbered releases** in the window across AgentPod, SuperPipeline, SuperToolkit, Treaty, SuperDispatch and SuperExchange. Recently merged changelogs, release pages and the public blog were then checked before grouping work by purpose.

The current blog contains no article about artifact-set completeness, build-once release pipelines, SuperMessage packaging or the missing `v0.1.2` APKs. “The CLI that could not update itself” discusses getting an already-published binary onto a machine; this proposal concerns proving that a multi-platform release contains every promised binary. The topics are adjacent but not duplicative.

A concurrent unpublished article thread covers AgentPod’s asynchronous wake-turn lifecycle ([#877](https://github.com/SuperJackfruitLabs/agentpod/pull/877), [#881](https://github.com/SuperJackfruitLabs/agentpod/pull/881), [#882](https://github.com/SuperJackfruitLabs/agentpod/pull/882)). This brief deliberately chooses a different product, failure and engineering lesson.

## Related shipped work intentionally left out

- **SuperMessage docs-only CI ([#177](https://github.com/SuperJackfruitLabs/supermessage/pull/177))** is in the same repository and changed CI planning, but it serves a different purpose: reducing pull-request work while preserving documentation checks. It does not produce or validate release assets.
- **SuperMessage’s docs theme, voice and npm-vibekit changes ([#179](https://github.com/SuperJackfruitLabs/supermessage/pull/179), [#181](https://github.com/SuperJackfruitLabs/supermessage/pull/181), [#182](https://github.com/SuperJackfruitLabs/supermessage/pull/182))** are unrelated presentation and dependency work.
- **The suite-wide docs-only CI thread** — AgentPod [#875](https://github.com/SuperJackfruitLabs/agentpod/pull/875), Salaam [#129](https://github.com/SuperJackfruitLabs/salaam/pull/129), SuperLibrary [#55](https://github.com/SuperJackfruitLabs/superlibrary/pull/55), SuperMessage [#177](https://github.com/SuperJackfruitLabs/supermessage/pull/177), SuperWitness [#82](https://github.com/SuperJackfruitLabs/superwitness/pull/82) — is a strong separate article about safe path classification, but it is not causal to the missing release files.
- **Documentation completeness and docs-touched guards** in AgentPod [#874](https://github.com/SuperJackfruitLabs/agentpod/pull/874) and SuperWitness [#81](https://github.com/SuperJackfruitLabs/superwitness/pull/81) solve documentation drift, not distribution completeness.
- **AgentPod’s checkpoint and benchmark-worker sequence ([#883](https://github.com/SuperJackfruitLabs/agentpod/pull/883) through [#922](https://github.com/SuperJackfruitLabs/agentpod/pull/922))** is a large orchestration thread with its own failures and state model. Folding it in would turn a crisp release-contract article into a weekly changelog.
- **AgentPod wake-turn fixes ([#877](https://github.com/SuperJackfruitLabs/agentpod/pull/877), [#881](https://github.com/SuperJackfruitLabs/agentpod/pull/881), [#882](https://github.com/SuperJackfruitLabs/agentpod/pull/882))** are omitted both for topical separation and because another unpublished article already covers them.
- **Other products’ shared-release-workflow releases** were reviewed, but their adoption is background rather than another piece of this failure. The SuperMessage-specific producer, artifact selector, completeness hook and tests form a complete causal thread in [#174](https://github.com/SuperJackfruitLabs/supermessage/pull/174) and [#180](https://github.com/SuperJackfruitLabs/supermessage/pull/180).

No SuperMessage release-asset repair in this thread is omitted: #174 introduces the build-on-default-branch path; #180 records the failures, repairs the desktop bundle path, adds Android release production, adds the completeness gate and tests it.

## Accuracy guardrails for the writer

- Say **“merged to `main`”** for PRs #174 and #180. Do not say their automation shipped in `v0.1.2`; that tag predates both changes.
- Say the four `v0.1.2` APKs were **added after publication from the release’s CI outputs**. Do not imply the new automated release hook added them.
- Distinguish **post-merge CI proof** from **tag-publication proof**. Run `43641634363` proves the producers and commit-keyed artifacts. A later numbered tag is still needed to demonstrate the full automated publication path.
- Do not call the Android files production-signed apps. They are explicitly **debug-signed APKs**; release signing is a separate decision.
- Do not claim `*-{sha}` alone prevents partial releases. The explicit four-name check is what supplies completeness.
- Do not describe the 30-day retention as archival durability. It creates a finite tagging window; after expiry, the gate intentionally refuses the release.
- Do not generalize “always build every platform on every commit” without the cost trade-off. Here the project chose roughly 13 minutes of Android cross-compilation on each default-branch push so any such commit could be tagged; pull requests remained unaffected.
- Avoid internal operational identities or infrastructure. Everything needed for the article is in the public PRs, release page, source, tests and Actions run linked above.
