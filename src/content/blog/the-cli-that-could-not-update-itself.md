---
title: The CLI that could not update itself
description: Publishing two binaries in one release did not keep both installations current when only one of them had a safe route from artifact to machine.
date: 2026-09-28
draft: false
tags: [engineering, tooling]
sources:
  - claim: A maintainer found agentpod-fleet at v0.1.52 while agentpod-node was at v0.1.66, and PR #567 added fleet self-update support.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/567
  - claim: The v0.1.52 release included both node and fleet artifacts.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.52
  - claim: The v0.1.66 release included both node and fleet artifacts, fourteen patch releases after v0.1.52.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.66
  - claim: At v0.1.66, one release workflow built node and fleet binaries for Linux and macOS on amd64 and arm64.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/.github/workflows/release-node-agent.yml#L16-L80
  - claim: At v0.1.66, the node CLI exposed an update path that checked, verified, replaced and restarted.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-node/main.go#L138-L178
  - claim: The v0.1.66 README said node upgrades were triggered deliberately rather than by a timer.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/README.md#L29-L30
  - claim: The v0.1.66 fleet dispatcher had no update verb.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/fleet.go#L42-L72
  - claim: The v0.1.66 fleet help output documented no update command.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/help.go#L8-L25
  - claim: TestCarriesNoNodeVerbs explicitly forbade update in the v0.1.66 fleet CLI.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L75
  - claim: The v0.1.66 updater hardcoded the asset name to agentpod-node for the current operating system and architecture.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L72-L75
  - claim: The v0.1.66 updater downloaded that asset and swapped it over the running executable.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L267-L302
  - claim: The v0.1.67 updater introduced an explicit binary option while preserving agentpod-node as the default.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L29-L45
  - claim: At v0.1.67, the requested binary determined the release asset name.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L75-L89
  - claim: The new fleet update handler selected agentpod-fleet and reused the shared check and replacement path.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/fleet_update.go#L12-L52
  - claim: The v0.1.67 shared Update function still restarted the node service after a successful fleet-binary swap.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L395-L423
  - claim: The v0.1.67 fleet boundary test continued to forbid enroll, run and service but no longer forbade update.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L86
  - claim: PR #567 first shipped in release v0.1.67.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.67
  - claim: Release v0.1.70 describes PR #571 rather than the first shipment of PR #567.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.70
---

*`agentpod-node` and `agentpod-fleet` came out of the same release job. But when a maintainer checked one machine, the node was current at v0.1.66 while the fleet CLI was still on v0.1.52. Publishing both binaries was not the same as delivering both of them.*

A release existed. The checksum existed. The binaries for every supported platform existed. And yet one of the tools had quietly missed every update since it was installed.

That was the state a maintainer found on a developer machine: `agentpod-node` was on v0.1.66, while its sibling, `agentpod-fleet`, was still on v0.1.52. The observation comes from the incident report in [PR #567](https://github.com/SuperJackfruitLabs/agentpod/pull/567), not device telemetry. But the public release history confirms the shape of the gap: both the [v0.1.52 release](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.52) and the [v0.1.66 release](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.66) shipped node and fleet artifacts.

After v0.1.52 came 14 newer patch releases, v0.1.53 through v0.1.66. The fleet binary could have been upgraded. It simply had no supported way to ask.

This is an easy failure mode to miss when you ship internal CLIs. CI turns green. A tag appears. A release page fills with artifacts. From the repository’s point of view, the release is complete.

From the user’s machine, nothing has happened.

## Built together, updated apart

The two binaries did not come from separate release systems. At v0.1.66, a single [GitHub Actions workflow](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/.github/workflows/release-node-agent.yml#L16-L80) built Linux and macOS artifacts for amd64 and arm64. Within each matrix job, the workflow built both `agentpod-node` and `agentpod-fleet`, then attached both sets of artifacts to the same GitHub release.

That symmetry was reassuring—and misleading.

The workflow could prove that a current fleet binary existed on GitHub. It could not prove that the copy in someone’s `~/.local/bin` had ever been replaced. Build pipelines control artifacts; they do not automatically control installations.

The node binary at least had an operating path for upgrades. In v0.1.66, the `apn update` command could check for a release, download it, verify its SHA-256 checksum, replace the executable and restart the service after a successful swap ([source](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-node/main.go#L138-L178)). This was [not an automatic timer](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/README.md#L29-L30): an operator or fleet action still had to trigger it. But the mechanism existed.

The fleet CLI had no equivalent. Its [dispatcher](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/fleet.go#L42-L72) and [help output](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/help.go#L8-L25) contained no `update` verb. The person running it had to notice the version drift, find the installer or release asset, and manually initiate a reinstall or replace the binary.

That difference matters. A service lives inside an operating loop. It is monitored, restarted, inspected and managed. A CLI may be invoked for a few seconds and then disappear from view. Unless the product exposes version drift and a safe upgrade path, the old copy can keep doing useful-looking work long after everyone assumes it has moved on.

## The missing command was protecting us

At first glance, the fix seems obvious: add `fleet update` and point it at the shared updater.

That would have installed the wrong program.

The absence of the command was not merely an overlooked feature. A regression test named [`TestCarriesNoNodeVerbs`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L75) explicitly forbade the fleet binary from dispatching `enroll`, `run`, `service` or `update`. The boundary in the test was deliberate: “A worker holds this and cannot become a node.”

The updater gave that prohibition a concrete safety purpose. Its asset-name function was hardcoded to return [`agentpod-node-<os>-<arch>`](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L72-L75). Later in the same code path, the updater used that name to download an asset and swap it over the running executable ([source](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.66/apps/node-agent/internal/selfupdate/selfupdate.go#L267-L302)).

If the existing updater had simply been exposed as `fleet update`, it would have fetched `agentpod-node` and overwritten `agentpod-fleet`. No one reported that actually happening; the forbidden verb prevented it from shipping. The test was right. The abstraction beneath it was too narrow.

That distinction is useful beyond this incident. Sometimes a missing piece of UX is not waiting for one more command handler. It is waiting for the implementation to express a product boundary safely.

## Bind the update to the binary

[PR #567](https://github.com/SuperJackfruitLabs/agentpod/pull/567) repaired the abstraction before exposing the command.

The shared updater gained an [explicit binary option](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L29-L45). Existing callers continued to default to `agentpod-node`, while the [asset name was derived from that option](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L75-L89). The new fleet command passed `Binary: "agentpod-fleet"`, then reused the established check, checksum and replacement path ([source](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/fleet_update.go#L12-L52)).

One caveat survived the release. The fleet handler's comment says there is no service to restart, but the handler called `selfupdate.Update`; in v0.1.67, that function [always invoked the node-service restart after a successful swap](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/internal/selfupdate/selfupdate.go#L395-L423). The restart-free primitive was `Apply`. PR #567 fixed the wrong-artifact hazard, but the released fleet updater could still restart the node service unnecessarily—or report a restart error after the fleet binary had already been replaced.

The boundary test changed with the design. `enroll`, `run` and `service` remained node-only; `update` was no longer forbidden once an update could preserve the identity of the fleet binary ([test](https://github.com/SuperJackfruitLabs/agentpod/blob/v0.1.67/apps/node-agent/cmd/agentpod-fleet/main_test.go#L63-L86)).

The fix first shipped in [v0.1.67](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.67), whose release notes explicitly include PR #567. It did **not** first ship in v0.1.70; that later release’s [notes](https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.70) describe PR #571. The distinction matters because release archaeology is part of making an incident useful: if we cannot say when a fix became available, we cannot tell users which version actually contains it.

## A release needs a route to the machine

The tempting lesson is “every CLI needs self-update.” That is too narrow. Self-update is one route, and it comes with security, permissions and rollback decisions of its own. A package manager, managed installer or centrally enforced deployment may be a better route.

The real requirement is an operating contract. For every binary you publish, answer these questions:

1. **Can users see the installed version?** Provide a reliable `version` command and include versions in diagnostics.
2. **How is drift discovered?** Consider `update --check`, startup notices, package-manager metadata or centrally collected inventory.
3. **What is the supported upgrade path?** Name the self-update command, package-manager operation, managed rollout or replacement procedure.
4. **Is artifact identity explicit?** An updater must bind the requested artifact to the product and executable being replaced—not inherit a sibling binary’s hardcoded default.
5. **How is the artifact trusted and replaced?** Verify checksums or signatures, make replacement atomic and retain a recovery path.
6. **Who closes the loop?** Decide who checks, how often they check and how they learn that action is required.
7. **Do tests protect the real boundary?** Keep authority-sensitive operations separated, but test newly permitted behavior directly instead of treating an old command list as the invariant.

None of these guarantees that every machine is current. Together, they make staleness observable and recovery routine instead of accidental.

A person-run CLI is especially prone to falling outside that loop. It may not have a long-running process, a dashboard tile, an uptime alert or an owner watching its rollout. If nothing surfaces its age and nothing makes upgrading safe, the release process ends at the download page.

That is the difference this incident exposed. `agentpod-node` and `agentpod-fleet` were compiled together and published together. Only one had a viable route from “new artifact” to “new executable.” The other stayed frozen while release after release accumulated beside it.

“Latest release” is a property of a repository. “Current software” is a property of a machine. Shipping is the work required to make the second catch up with the first.
