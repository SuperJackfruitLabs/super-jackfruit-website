# Claim verification: “The CLI that could not update itself”

## Verdict

**Publishable as it stands. No factual publication blockers remain.**

The card specification says PR #567 was released in v0.1.70. The public repository shows that this is incorrect: PR #567 is the commit tagged **v0.1.67**, and the v0.1.67 release notes name PR #567. Release v0.1.70 instead names PR #571. The article already uses the public record’s v0.1.67 date and explicitly corrects the supplied v0.1.70 claim.

## Sources checked

The checks used immutable tagged source where possible, plus GitHub’s live public PR and release records:

- PR #567: <https://github.com/SuperJackfruitLabs/agentpod/pull/567>
- Releases [v0.1.52](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.52), [v0.1.66](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.66), [v0.1.67](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.67), and [v0.1.70](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.70)
- The release workflow and CLI/updater source at tags v0.1.66 and v0.1.67
- README at v0.1.66 and current `main`
- Current `CHANGELOG.md`

The current changelog only reaches v0.1.22, so it does not adjudicate this later change. For v0.1.52–v0.1.70, the public release records, PR, tags and tagged code are the controlling sources.

## Claim-by-claim findings

| Claim | Public evidence | Finding |
| --- | --- | --- |
| A developer machine had `agentpod-fleet` v0.1.52 while `agentpod-node` was current at v0.1.66. | [PR #567 body](https://github.com/SuperJackfruitLabs/agentpod/pull/567) and the explanatory comment added to [`TestCarriesNoNodeVerbs`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L86). | **Verified as a maintainer-reported observation, not fleet telemetry.** The article states that limitation. |
| Fourteen releases separated v0.1.52 and v0.1.66. | Public tags enumerate v0.1.53 through v0.1.66 inclusive; the [v0.1.66 release](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.66) links the release history. | **Verified.** There are 14 later patch tags in that inclusive range. |
| Both releases carried node and fleet artifacts. | Asset lists on [v0.1.52](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.52) and [v0.1.66](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.66) include both binaries for Linux and macOS, amd64 and arm64, plus `SHA256SUMS`. | **Verified.** |
| Node and fleet were built and uploaded by the same release job. | The v0.1.66 [release workflow](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/.github/workflows/release-node-agent.yml#L16-L80) uses one OS/architecture matrix, builds both commands in one loop, and uploads both in the same matrix job. | **Verified.** |
| `agentpod-node` had `apn update`; updates were deliberate, not timer-driven. | The v0.1.66 [node dispatcher](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-node/main.go#L138-L178) dispatches `update`. The tagged [README](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/README.md#L29-L30) says node agents do not upgrade on a timer. | **Verified.** |
| The node path downloaded, checksum-verified, replaced and restarted. | [`downloadAndVerify`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L137-L220), [`swapBinary`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L223-L236), and [`Update`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L369-L398). | **Verified.** Replacement is atomic and preserves a `.bak` rollback copy. |
| `agentpod-fleet` had no update verb at v0.1.66. | The tagged [dispatcher](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/fleet.go#L42-L72) and [help](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/help.go#L8-L25) contain no `update`. | **Verified.** |
| `TestCarriesNoNodeVerbs` explicitly forbade `update`. | The v0.1.66 [test](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L75) lists `enroll`, `run`, `service`, and `update` as forbidden. | **Verified.** |
| Reusing the updater unchanged would have installed node over fleet. | At v0.1.66, [`assetName`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L72-L75) always returns `agentpod-node-<os>-<arch>`; [`applyTag`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L267-L302) downloads that asset and swaps it over the resolved running executable. | **Verified as a code-path consequence.** The article correctly says no one reported this actually happening because the verb was absent. |
| PR #567 bound the asset identity to the requested binary and added fleet update. | The v0.1.67 updater adds [`Options.Binary`, `DefaultBinary`, and `assetNameFor`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L29-L45) ([asset construction](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L75-L89)); the [fleet handler](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/fleet_update.go#L12-L52) passes `Binary: "agentpod-fleet"`. | **Verified.** The implementation binds identity through an explicit caller-supplied option, while preserving node as the zero-value default. |
| The test boundary changed rather than disappearing. | The v0.1.67 [test](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L86) still forbids `enroll`, `run`, and `service`, but no longer forbids `update`. | **Verified.** |
| PR #567 first shipped in v0.1.67, not v0.1.70. | PR #567 merged as commit `09eaed19c74039f62b5704ab4db1238782f5c860`; tag v0.1.67 points to that commit and its [release notes](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.67) name PR #567. The [v0.1.70 notes](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.70) name PR #571. | **Verified; card specification corrected.** |
| The v0.1.67 fleet updater could still restart the node service unnecessarily. | The [fleet handler](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/fleet_update.go#L12-L52) says there is no service to restart but calls `selfupdate.Update`; [`Update`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L395-L423) restarts after a swap, whereas [`Apply`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L344-L393) does not. | **Verified.** The article presents this as a released caveat, not as part of the original card specification. |

## Article changes made during verification

- Added direct tagged-code citations for download, SHA-256 verification, atomic replacement, rollback backup and service restart instead of asking the CLI dispatcher citation to support all of those implementation details.
- Added a tagged installer citation for the default `~/.local/bin` installation path.
- Added a direct citation for `Apply` as the restart-free primitive in the v0.1.67 caveat.
- Retained and verified the article’s correction from the supplied v0.1.70 claim to the public record’s v0.1.67.

## Validation

- `npm test`: **8/8 tests passed**.
- `npm run build`: **passed**; Astro generated `/blog/the-cli-that-could-not-update-itself/` with zero errors. The build reported seven pre-existing TypeScript hints and the existing large-chunk warning.
- `npm ci` reported 28 dependency vulnerabilities from the committed dependency graph (4 low, 5 moderate, 18 high, 1 critical). This verification did not alter dependencies; the audit result is outside the article’s publication claims.
- `git diff --check`: **passed**.

## Handoff notes

- Expected `press/brief.md` was not present on `master`, any fetched remote branch, or repository history. The card’s specification was available from the Superpipeline run and was used as the brief. This is a workflow/provenance gap, not a factual publication blocker for this article.
- No unresolved factual claim was found.
