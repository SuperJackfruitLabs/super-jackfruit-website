# Super Jackfruit website

The Astro/Three.js website for Super Jackfruit Labs, including the existing
interactive driving village at `/village`. Uses TypeScript and Tailwind.

- [Current website and village integration plan](docs/VILLAGE_WEBSITE_PLAN.md)
- [City/game design and native-client evaluation](https://github.com/SuperJackfruitLabs/super-jackfruit-world/blob/main/docs/README.md)
- [Marketing strategy and product evidence](https://github.com/SuperJackfruitLabs/sjl-marketing/blob/main/README.md)

## Development

Use the repository lockfile and existing npm scripts:

```sh
npm ci
npm run dev
npm run build
npm run preview
```

`build` runs Astro checks and creates `dist/`. `assets` extracts and compresses
the existing model kit. `deploy` builds and publishes through the pinned local
Wrangler CLI installed by `npm ci`; no global Wrangler installation is required.
Authenticate with `npx wrangler login` before the first deployment, and run
`npm run deploy` only when publishing is intended. See `package.json` for the
exact commands.

`src/pages/` owns routes; `src/data/` owns the catalogue/model manifest;
`src/scripts/village/` contains village mechanics; `public/` contains served
assets. Internal plans stay in `docs/`, outside published asset directories.

The historical `docs/superpowers/` plans describe earlier design stages. The
current implementation plan owns VIL-01–04 and website integration. The larger
simulation, native game, multiplayer and residency remain proposed work in the
city repository. This documentation update does not implement those features.
