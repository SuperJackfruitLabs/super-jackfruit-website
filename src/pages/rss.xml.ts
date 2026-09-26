import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

import { publishedPosts } from '../lib/posts.mjs';

/**
 * The feed.
 *
 * Same `publishedPosts` rule as the index and the post pages, so a draft cannot reach a reader's
 * inbox while being absent from the site — which is the failure that matters here, because a feed
 * item cannot be recalled once it has been fetched.
 */
export async function GET(context: APIContext) {
  const posts = publishedPosts(await getCollection('blog'));

  return rss({
    title: 'Super Jackfruit Labs — Writing',
    description:
      'Notes from inside the lab: what we built, what broke, and what the evidence actually said.',
    // Requires `site` in astro.config.mjs; the build fails loudly without it rather than emitting
    // a feed full of relative links.
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.slug}/`,
    })),
  });
}
