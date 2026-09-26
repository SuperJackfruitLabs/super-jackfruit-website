import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  // Required by the RSS feed, which cannot build absolute item links without it. Also what makes
  // canonical URLs and sitemaps correct if either is added later.
  site: "https://superjackfruit.com",
  integrations: [tailwind()],
});
