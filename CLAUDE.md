# Tiny King

A browser game about people: JavaScript, React, Three.js and an HTN planner. Read `docs/design.md` for the design and build order.

## Working rules

- **Codex builds and plays; the coordinator orchestrates.** The coordinator writes briefs, reviews code, reports, changed tests and screenshots, and owns integration. It does not implement game code or play the game.
- **Use the faster verification policy approved by Chris on 30 October 2026.** Follow `docs/verification.md`. Builders run affected checks and one production build, with an early visual preview; they do not run the whole suite or duplicate the independent browser acceptance pass.
- **Independently play the frozen candidate before merge.** A separate Codex worker performs the mechanical checks, standard `npm run storyboard -- <url> <outdir>` and focused feature observation in one acceptance pass. Judge informative, immersive, intuitive and fun; fix the worst demonstrated findings before the next feature. Do not repeat this review after merging the same candidate.
- **Coordinator final gate:** run the whole `npx jest` suite once on the reviewed, rebased gameplay candidate. Reuse valid evidence when runtime is unchanged. Documentation and test-script-only fixes use relevant checks, not another whole-suite run. Repeat checks only when an actual relevant change, failure or unresolved concern invalidates their evidence; retain failed results honestly.
- **Preserve meaningful tests and real outcomes.** Never weaken assertions, fabricate game state/results, raise timeouts to hide defects or keep retrying optional observations for a green report. Freeze source during acceptance browsers. No optional audits, seed hunts or new test frameworks on the delivery path.
- **Keep Chris able to steer.** Show an early concrete preview for substantial visual changes before slow final gates. Continue authorised work without repeated permission questions.
- **Use private worktrees and dependency installs.** Never run `npm ci` in the main checkout while port 8080 is running. Stop only verified owned server PIDs; never use `pkill -f`. Never copy private Sol Trader source into this repository. Ask before paid or outside-project actions.
- **Deployment:** fast-forward `main`, push, then `npm run build && npx wrangler deploy` from the main checkout; verify the live commit at https://tinyking.chrismdp.com. Preserve complete evidence before removing a worktree.
