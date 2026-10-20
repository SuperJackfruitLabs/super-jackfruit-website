---
title: "AgentPod: a console for the machines your agents live on"
description: AgentPod attaches to the agent runtimes you already run and gives one operator their files, logs, terminals, health and updates in one place.
date: 2026-10-20
draft: false
tags: [agents, infrastructure, agentpod]
sources:
  - claim: AgentPod is an attach-first fleet and facilities console; per-station surfaces cover filesystem, logs, terminal, config, health, lifecycle, cleanup, changesets, activity, skills, plugins and provisioning.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/8b3231375fd7989a8c72e9fcaa01036b615c4973/README.md
  - claim: The node-agent dials out to the hub over WSS with no inbound ports; node binaries for Linux and macOS ship in v0.1.91.
    url: https://github.com/SuperJackfruitLabs/agentpod/releases/tag/v0.1.91
  - claim: Descriptors are registered for Hermes, OpenClaw, Claude Code, Codex, OpenCode and Pi.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/8b3231375fd7989a8c72e9fcaa01036b615c4973/apps/node-agent/cmd/agentpod-node/registry.go
  - claim: The console ranks unoccupied stations, offline nodes, runtime errors and version drift, worst first.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/8b3231375fd7989a8c72e9fcaa01036b615c4973/apps/console/src/lib/fleet/attention.ts
  - claim: Declared settings are written only after a person reviews the exact plan; nothing reconciles on a timer.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/8b3231375fd7989a8c72e9fcaa01036b615c4973/docs-site/src/content/docs/use/config.md
  - claim: Skill inventory keeps present, eligible, loaded and exercised as separate observations.
    url: https://github.com/SuperJackfruitLabs/agentpod/blob/8b3231375fd7989a8c72e9fcaa01036b615c4973/docs-site/src/content/docs/use/skills.md
---

An agent is easy to start and hard to look after. It runs on a machine somewhere, in a workspace full of files it changed, with logs, a configuration, a version of its harness and a habit of stopping when you aren't looking. Once there are a few of them, on a few machines, the question stops being "can the agent do the task?" and becomes "where is everything, and is it all right?"

[AgentPod](/products/agentpod) is the lab's answer to that second question. It is a console for the machines and workspaces your agents live on, step four in [the suite](/suite): your fleet runs it.

## Attach first

AgentPod doesn't ask you to move your agents into it. A small node-agent runs beside the runtimes you already have and **dials out** to the hub over a secure WebSocket, so it needs no inbound ports and works from behind NAT. Node binaries for Linux and macOS ship with each release.

The node knows how to recognise six harnesses: Hermes, OpenClaw, Claude Code, Codex, OpenCode and Pi. What it can show you for each depends on the harness and the host. A descriptor tells AgentPod how to look; it doesn't make every harness behave the same.

## One place per station

For each station, the console gathers what you would otherwise SSH in to find: the filesystem, logs, a terminal, configuration, health and lifecycle, cleanup, workspace changes, activity, skills and plugins. Each surface appears only where the station says it supports it.

Across the fleet, an **attention lane** ranks what needs you, worst first: stations with no agent, nodes that have gone offline, runtime errors, and nodes running an older version. Updates are deliberate. A node applies one only when asked, and publishing a release never upgrades anything by itself.

## Changes a person can review

Two parts of AgentPod are built around the idea that a change to an agent's setup should be seen before it lands:

- **Declared settings.** You record what a setting should be for the fleet, a node or a station. AgentPod shows the exact plan, and writes it only after a person approves that plan. Nothing reconciles on a timer. For now this covers seven settings, six for Hermes and one for OpenClaw.
- **Managed skills.** The inventory keeps four separate facts: a skill is *present*, *eligible*, *loaded* and *exercised*. A file on disk doesn't prove a harness loaded it, so AgentPod doesn't pretend it does.

## What it is not

AgentPod is a single-operator console today, not a team product or a hosted service. The hub and console run from source; the released binaries are the node and the `fleet` command-line tool. Some features, such as provisioning new runtimes or the Matrix bridge, are off until you configure them.

It also works on its own. You don't need a SuperPipeline board or a SuperMessage room to use it, though it can connect to both.

Read more on [agentpod.dev](https://agentpod.dev), or start with the [docs](https://docs.agentpod.dev).
