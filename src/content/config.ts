import { defineCollection, z } from 'astro:content';

/**
 * The blog's frontmatter contract.
 *
 * This is written to be filled in by an agent as much as by a person — the Press board's `draft`
 * stage produces one of these files — so every field is either required and obvious, or optional
 * with a default. A schema an author has to guess at is a schema that gets guessed wrong.
 *
 * `sources` is the unusual one, and it is deliberate. `sjl-marketing`'s claims ledger says the
 * public README, changelog, release and code outrank a marketing summary. Keeping the citations in
 * frontmatter rather than in prose makes that rule checkable rather than aspirational: a reviewer —
 * human or agent — can walk the list and confirm each claim against the URL beside it, and the
 * post renders its own working at the bottom. A post that asserts something it cannot cite is
 * visibly a post with an empty `sources`.
 */
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    /** One sentence. Used as the meta description and on the index, so it is not optional. */
    description: z.string().min(1),
    /** Coerced, so `date: 2026-09-27` in YAML does not have to be quoted to parse. */
    date: z.coerce.date(),
    /** Absent from the build entirely — see `getPublished`. */
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    sources: z
      .array(
        z.object({
          claim: z.string().min(1),
          url: z.string().url(),
        }),
      )
      .default([]),
  }),
});

export const collections = { blog };
