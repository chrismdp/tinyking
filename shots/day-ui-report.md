# TinyKing day screen

The screen is being built on the real day simulation. This report records the work and evidence as it happens.

The candidate starts at `8f35028`, on branch `day-ui`. No simulation rules will change. The supplied seed 13 and seed 7 worlds will be converted into the game's save format for a quick browser start.

## Checks so far

- `npm ci`: exit 0. Installed 1,056 packages in 11 seconds. npm reported existing Babel peer warnings, an engine warning and 19 audit findings.
- Read `CLAUDE.md`, `docs/verification.md`, `docs/conversations.md`, every bullet of “The day is spent with people”, the text driver and the coordinator's play verdict.

## Questions for the finished game

Meaningful choices: awaiting play.

Making a difference: awaiting play.

Immersion: awaiting play.

Caring about characters: awaiting play.

## Evidence still needed

Early screen, two days through the real UI at 1280 px and 390 px, each supporting panel, road travel, affected tests and lint, and one finished production build. This is a builder pass; the legacy 3D acceptance scripts target a different interface.

## Work in progress

The nine new presentation tests pass. They cover valley reveal, real place names, anonymous descriptions, unknown family members, deterministic portraits, result prose, road/night/season prose, the asks journal and relationship words. The initial red run failed because the presentation module did not yet exist (exit 1). An intermediate run exposed the Jest CSV loader requirement (exit 1); the test now mocks the two name tables, as existing name tests do. No old test was changed.

The browser view uses the approved slate, gold and reed palette and the three approved font families. The match row reuses the existing chat presentation playback. It reads the real icon matches and listener reactions. The supplied generation snapshots compress to 4,554,903 bytes (seed 13) and approximately 2.7 MB (seed 7).

The first development compilation is waiting for the shared heavy-run gate. No production build has run yet.

## Early preview

The first browser screen is committed as `early-desktop.png`, `early-phone.png` and `early-phone-map.png` under `shots/day-ui/`. The first attempt could not connect because its background static server exited with the shell. That driver attempt was stopped by its saved PID. The server now runs in its own persistent tool session. The retry passed (exit 0), with no page errors. Its 10,988 ms receipt includes page loading and all three screenshots; final start timing remains to be measured separately.

The first regression run passed: `flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand --runTestsByPath test/day_view.test.js test/day.test.js test/day_travel.test.js test/asks.test.js`, exit 0. Literal output is in `day-ui/affected-initial.log`: four suites, 46 tests, 17.228 seconds. The development compilation passed (exit 0). The first build wait was stopped before compilation because the second gate was occupied; compilation used the first gate instead. Initial lint passed with three unused-import/argument warnings, which remain to be tidied.
