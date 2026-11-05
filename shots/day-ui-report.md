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

The next pass adds real field and gathering landmarks, clearer food feedback from the player's actual stock, and cropped portrait frames. A numerical season regression and a two-ask quotation regression failed before their fixes. Both now pass. A further test proved that gathering needs a stock-based result line; it failed before that line was added and now passes. The presentation module now has 13 passing tests.

The first conversation probe made no substantive replies. Its driver saw the row before the opening animation began, then mistook hidden reply buttons for an empty choice list. That is a driver timing error, not evidence that conversations lack choices. A stable-frame wait replaces that race. The second probe also met a stopped static server. Browser runs now start and stop their own server in the same process tree, with saved PIDs.

## Candidate before browser play

The final affected Jest gate passed: `flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=8f35028 --runInBand`, exit 0. It selected one suite and all 14 presentation tests passed in 0.936 seconds. The earlier 46-test day/travel/ask regression also remains valid: the simulation source is unchanged. No existing test assertion changed. This is a JavaScript repository with no typecheck command; the affected source and scripts passed ESLint (exit 0), and webpack checks module resolution and syntax.

The stock regression also exposed a road concern: the travelling player leaves the local ECS (the simulation's collection of entities). The first fixture attempt lacked its container table (exit 1). After fixing the fixture, the red run reproduced the real missing-controller exception (exit 1). The presentation now reads an empty local stock while the player is in transit. That does not change carried items or travel rules.

The standard storyboard and playtest commands now dispatch to the day controls when the URL contains `mode=day`. Their original 3D scenarios remain intact. The day driver uses visible buttons, required answers and icon matches. It reads state only for receipts. It does not set the clock, relationships, food or outcomes.

## Production build

`flock -w 7200 /tmp/27agents-gate-2.lock npm run build` passed, exit 0, on runtime candidate `c5462a8`. The app compiled in 25.354 seconds and the save worker in 0.833 seconds. Webpack reported three size warnings. The entry bundle totals 3.64 MiB; the pre-generated world files are additional downloads. The full literal build output is `day-ui/production-build.log`. No deployment ran.

The production browser story began from seed 13 in 10.599 seconds on this shared headless machine. Its first real conversation recognised the player as Dionisia's child and offered a three-portion food ask. The player accepted through an offered line. Browser source is frozen during this pass.

## Findings from the two-day desktop play

The desktop run reached day 3 morning through six real UI choices. The player introduced himself, promised Geoffrey three food portions, gathered food three times, delivered once, then spoke to Simon when Geoffrey was no longer in the selected place. The food ask remained accepted. This does not prove a completed promise. No peace or introduction outcome was attempted.

The reference screenshots exposed a confusing family label: the tree called the player's named mother “a woman in her fifties”. Ambient descriptions correctly hide a stranger's identity, but the family and person sheets need to distinguish a known name from a face not yet recognised. I will fix that reference label after the frozen browser pass, test it, and recheck those panels. The two-day simulation evidence remains valid because this correction changes reference labels only.

The ask journal also needs to state the partial food already delivered, rather than saying only that the player promised to help. That will use the real request's recorded progress, without a checklist.

Both desktop and phone runs reached day 3 morning (`days = 2.250000000000193`). Both viewport-fit assertions passed. The phone then travelled three real road parts (`2.5`, `2.75`, `3.25`) and arrived from region `5,3` in `6,3`. Those coordinates are receipts only; the screen uses place and direction words. All browser assertions passed and `story.json` records no errors. The tool session returned 143 before its shell wrote an exit receipt. The browser child's exit code is unknown. This run is retained as evidence, not reported as a clean command exit.

After that frozen pass, two failing tests reproduced the reference findings (exit 1). The final affected gate now passes 16 tests (exit 0, 0.808 seconds). The tree uses learned names and hides unlearned relatives as Unknown. The person sheet explains that a name alone is not acquaintance. The ask journal reports a recorded partial delivery in prose. Ambient stranger descriptions and simulation rules are unchanged.

A second production build is required for these demonstrated reference corrections. This is the final candidate build, not a repeat of a passing unchanged-runtime check.
