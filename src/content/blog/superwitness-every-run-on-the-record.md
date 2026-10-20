---
title: "Superwitness: every run, on the record"
description: Superwitness puts what an agent did, how the system behaved and whether the work was good into one record, and keeps the judgements append-only.
date: 2026-10-20
draft: false
tags: [agents, observability, superwitness]
sources:
  - claim: A run document joins the Superpipeline run, AgentPod attempts, traces and logs at read time; a source that is down shows as unavailable, and its numbers as unknown, never 0.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/4448b2e1be557512e9b1938de0277aa8152a5267/README.md
  - claim: Verdicts and rubrics are append-only, enforced by database triggers; an agent cannot judge a run it executed.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/4448b2e1be557512e9b1938de0277aa8152a5267/internal/verdicts/migrations/00001_init.sql
  - claim: The MCP server registers six tools, including get_run, list_runs and record_verdict.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/4448b2e1be557512e9b1938de0277aa8152a5267/internal/mcp/server.go
  - claim: Superwitness queries VictoriaTraces and VictoriaLogs through their published APIs rather than ingesting telemetry itself.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/4448b2e1be557512e9b1938de0277aa8152a5267/internal/telemetry/telemetry.go
  - claim: Releases ship one Go binary for Linux amd64 and arm64, with its own Postgres, under the MIT licence.
    url: https://github.com/SuperJackfruitLabs/superwitness/releases/tag/v0.0.6
  - claim: Running it against any agent stack, offline evals and calibration are design goals, not shipped features.
    url: https://github.com/SuperJackfruitLabs/superwitness/blob/4448b2e1be557512e9b1938de0277aa8152a5267/docs-site/src/content/docs/what-it-is.md
---

When an agent finishes a piece of work, three different things are true at once. The agent did a series of things. The system it ran on behaved a certain way while it did them. And the result was either good or it wasn't. Usually those three live in three places: a transcript, a tracing tool and somebody's opinion in a chat thread.

[Superwitness](/products/superwitness) puts them in one record. It is the last step in [the suite](/suite): you see proof.

## One document per run

Ask Superwitness for a run and it builds a single document at the moment you ask. It brings together the [Superpipeline](/products/superpipeline) run, each [AgentPod](/products/agentpod) attempt (with a fingerprint of the configuration it ran with), the trace spans and the logs and errors.

It is careful about what it doesn't know. If one of those sources is down, the document says so, and the numbers that depended on it read **unknown**, never zero. A missing measurement and a measurement of nothing are different facts.

## Judgements you can't quietly edit

A **verdict** is a judgement of a run against a versioned rubric. Verdicts are append-only, and the database itself refuses to update or delete them. Changing your mind means recording a new verdict that supersedes the old one, so the history stays.

Two rules make the record worth trusting. The kind of judge, a person or an agent, comes from who is signed in, not from what they claim. And **an agent cannot judge a run it executed**.

People record verdicts in the web app, which groups runs by day with views for *needs verdict*, *failed* and *waiting*, a span waterfall and the verdict history. Agents can do the same through an MCP server with six tools, from reading a run to recording a verdict.

## It reads, it doesn't collect

Superwitness doesn't take in telemetry of its own. Products send their traces and logs to the OpenTelemetry Collector as usual, and Superwitness **queries** VictoriaTraces and VictoriaLogs when it needs them. Nothing waits on Superwitness to do its work.

## Where it is today

Superwitness is early, and honest about it:

- A run document currently means a **Superpipeline run**, and a real setup needs Superpipeline, an AgentPod hub and the trace and log stores.
- It ships as one self-hosted Go binary for **Linux** (amd64 and arm64) with its own Postgres, under the MIT licence. There is no hosted service.
- The web app is for an allow-listed operator, not a multi-user service.
- Working with any agent stack, offline evaluations, calibration and comparing configurations are **where it's going, not what it does yet**. It stores scores; it doesn't run graders.

There is a fake mode that lets you try a development run on your own machine without the other products, though it still needs Postgres.

Read more on [superwitness.dev](https://superwitness.dev) or in the [docs](https://docs.superwitness.dev).
