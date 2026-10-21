import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Required by the RSS feed, which cannot build absolute item links without it. Also what makes
  // canonical URLs and sitemaps correct if either is added later.
  site: "https://superjackfruit.com",
  // The 404 page is a real page (Pages serves it with a 404 status) and must not be listed.
  integrations: [tailwind(), sitemap({ filter: (page) => !page.endsWith("/404/") })],
  redirects: { "/suite": "/" },
});
