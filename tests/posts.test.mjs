import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedPosts } from '../src/lib/posts.mjs';

/**
 * Which posts are public, and in what order.
 *
 * Pure so it can be tested here rather than by building the site and reading HTML — the same
 * reason `src/scripts/village/visits.mjs` is a module of its own. Both the index and the feed call
 * it, so a draft cannot be hidden on one surface and published on the other.
 */

const entry = (slug, date, draft = false) => ({
  slug,
  data: { title: slug, description: 'x', date: new Date(date), draft, tags: [], sources: [] },
});

test('a draft is not published', () => {
  const posts = publishedPosts([
    entry('shipped', '2026-09-01'),
    entry('still-writing', '2026-09-02', true),
  ]);
  assert.deepEqual(posts.map((p) => p.slug), ['shipped']);
});

test('newest first, so the top of the page is the newest thing', () => {
  const posts = publishedPosts([
    entry('older', '2026-01-01'),
    entry('newest', '2026-09-27'),
    entry('middle', '2026-05-05'),
  ]);
  assert.deepEqual(posts.map((p) => p.slug), ['newest', 'middle', 'older']);
});

test('the input is not mutated, because callers share the collection', () => {
  const given = [entry('a', '2026-01-01'), entry('b', '2026-09-01')];
  const order = given.map((p) => p.slug);
  publishedPosts(given);
  assert.deepEqual(given.map((p) => p.slug), order, 'sorted in place would reorder the caller’s array');
});

test('no posts is a real state, not an error', () => {
  assert.deepEqual(publishedPosts([]), []);
});
