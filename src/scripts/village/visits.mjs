/**
 * @param {string | null} saved
 * @param {readonly string[]} currentSlugs
 * @returns {Set<string>}
 */
export function restoreVisits(saved, currentSlugs) {
  const visited = new Set();
  const current = new Set(currentSlugs);
  try {
    const entries = JSON.parse(saved ?? '[]');
    if (!Array.isArray(entries)) return visited;
    for (const entry of entries) {
      const slug = entry === 'kaambaan' ? 'superpipeline' : entry;
      if (typeof slug === 'string' && current.has(slug)) visited.add(slug);
    }
  } catch {}
  return visited;
}
