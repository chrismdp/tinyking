# Tiny King

A browser kingdom game about people: JS, React UI, Three.js rendering, an HTN planner for villagers. `docs/design.md` is the design and the build order; read it first.

## Working rules

- **Play every feature before the next one.** After every merged feature, play a standard session with `npm run storyboard -- <url> <outdir>`, judge it for being informative, immersive, intuitive and fun, and fix the worst findings before starting the next feature.
- **Gates:** `npx jest` (the whole suite) and `npm run build` must pass, and `npm run playtest -- <url>` must pass against a running dev server before anything merges to `main`.
- **`main` deploys** to https://tinyking.chrismdp.com through `.github/workflows/deploy.yml`.
