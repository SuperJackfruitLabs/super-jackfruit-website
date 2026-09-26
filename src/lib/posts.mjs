/**
 * Which blog entries are public, newest first.
 *
 * One function, called by both the index and the feed, so a draft cannot be hidden on one surface
 * and published on the other — the kind of divergence nobody notices until a half-written post is
 * in somebody's reader.
 *
 * Plain `.mjs` rather than `.ts` so `node --test` can import it directly, as
 * `src/scripts/village/visits.mjs` already does.
 *
 * Generic on the entry, not typed to the two fields it reads: a concrete `@param` here becomes the
 * signature TypeScript believes, so `astro check` then lost `title` and `description` from every
 * entry this returned and failed on the pages that render them.
 *
 * @template {{ slug: string, data: { date: Date, draft?: boolean } }} T
 * @param {T[]} entries Astro content-collection entries, as `getCollection('blog')` returns them.
 * @returns {T[]}
 */
export function publishedPosts(entries) {
  return (
    entries
      .filter((entry) => !entry.data.draft)
      // Safe only because `filter` already returned a new array: `getCollection` hands back one the
      // caller may use again, and `sort` on the original would reorder it under them.
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  );
}

/**
 * `27 September 2026` — long form, no ordinal suffix, unambiguous to a reader anywhere.
 *
 * `en-GB` and UTC are both pinned: the default locale of whatever machine builds the site is not a
 * design decision, and a local timezone would render a midnight-dated post as the previous day for
 * half the world.
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatPostDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
