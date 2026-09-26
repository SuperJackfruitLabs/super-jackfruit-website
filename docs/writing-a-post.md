# Writing a post

One Markdown file in `src/content/blog/`, named for its URL slug:
`src/content/blog/the-cli-that-could-not-update-itself.md` becomes
`/blog/the-cli-that-could-not-update-itself`.

This is the contract an author works to — a person, or the Press board's `draft` stage. The schema
is enforced at build time by `src/content/config.ts`, so a post that does not satisfy it fails the
build rather than shipping wrong.

## Frontmatter

```yaml
---
title: The CLI that could not update itself
description: One sentence. It is the meta description and the line on the index, so write it for a stranger.
date: 2026-09-27
draft: false          # optional, defaults to false
tags: [tooling]       # optional
sources:              # optional, but see below
  - claim: The fleet CLI sat fourteen releases behind because it had no self-updater.
    url: https://github.com/SuperJackfruitLabs/agentpod/pull/567
---
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Plain text. |
| `description` | yes | One sentence. Shown on the index and to search engines and feed readers. |
| `date` | yes | `YYYY-MM-DD`. Sorts the index and the feed, newest first. |
| `draft` | no | `true` means no page, no index entry, no feed item. Nothing is reachable by URL. |
| `tags` | no | Lowercase, few. |
| `sources` | no | A list of `{ claim, url }`. Rendered as **what this rests on**. |

## `sources` is the point

`sjl-marketing`'s claims ledger says the public README, changelog, release and code **outrank** a
marketing summary. Keeping citations in frontmatter rather than buried in prose makes that rule
checkable instead of aspirational: a reviewer walks the list and confirms each claim against the
URL beside it, and the post shows its working to the reader.

So: **every factual claim a post makes about our software should appear in `sources` with a public
URL that proves it.** A version number, a date, a "this was broken and now is not" — all of it. A
post whose `sources` is empty is making no checkable claims, which is fine for an essay and wrong
for anything reporting what we shipped.

Prefer a permalink that will still say the same thing next year: a merged PR, a tagged release, a
commit. Prefer the repository over a summary of the repository.

## Draft first

Set `draft: true` while writing. It is excluded from the build entirely — the same
`publishedPosts` rule serves the index, the post pages and the feed, so a draft cannot leak into a
feed reader while being absent from the site.

Remove the flag to publish.

## Checking your work

```sh
npm run dev          # http://localhost:4321/blog
npm test             # the publishing rules
npm run build        # what CI runs: astro check + build
```

A merge to `master` deploys: Cloudflare Pages builds it through the Git integration on the
`extinct-eclipse` project. There is no separate publish step, and no deploy workflow in this
repository — `.github/workflows/ci.yml` runs the tests and the build, and nothing else.
