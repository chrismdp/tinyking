# Nearby visits

Hourly visits now build candidate sets from nearby residents, households, known relationships and eligible single adults. Child play and commons observation use the same bounded sources. Campfire guests come from a spatial query bounded by their remaining travel time. The six-hour choice fixture stays unchanged, and seed-13 history stays byte-identical. 

The affected gate passes all 1,343 tests in 137 suites. The production build passes. The controlled live sample preserves all 26 starts. Sampled `socialHour` CPU changes from 37.344 to 32.675 ms. Frame and tick times increase in this sample, so no frame-rate gain is established.

This work starts at `562d50424fe9587942033dfe4c18c723b608c701` on `perf/nearby-visits`. Runtime source is frozen at `c5f4ed82a718e85d01966673db31abc480bdbdf2`. Dependencies were already installed, so setup cost was zero. All files and receipts remain inside `/home/cp/code/tk-nearby`. No travel, save-worker or seasonal-step source changed. No delegation, other-branch comparison, stash, push, vault write or ledger write occurred.

## Candidate sources

| Loop | Previous source | Current source and retained rules |
| --- | --- | --- |
| Hourly idle roster | Every `personable` record | The population index's ordered resident roster. Current needs, work and planner state still decide availability once per hour. |
| Adult seekers | Every idle adult against every other idle adult | One shared pool of idle adults in the partner-seeking age window without a living spouse. Only this pool receives `partnerInterest` checks. Kinship, commitment, orientation and attraction rules remain in the existing tests. |
| Adult visit candidates | Every other idle adult, followed by filtering and sorting | Union of residents within 85 units, indexed housemates, the actor's known non-Public relationships, and the eligible-single pool when the actor can seek. Existing eligibility, avoidance, daily visit, route and time tests remain. The previous seeker order, `compareSocial`, distance and identity ordering remain. |
| Child play partners | The entire child list for each child | Union of indexed housemates and known non-Public relationships, intersected with available children in population order. Same-village, avoidance, green, crop-care and route-time tests remain. A distant familiar child remains eligible. |
| Campfire guest candidates | Every planner | Nearby resident cells inside a conservative travel envelope. A reverse search over navigation links finds the envelope for the remaining evening. It includes tile speeds, both route endpoints and one-way links. The final route test, friend priority and seeded guest score remain. |
| Commons witnesses | Every person in the village before distance filtering | Residents within the existing 300-unit observation radius, in index order. Village, membership, interior, actor distance and tree distance tests remain. |

The adult pool is local-map wide because eligible strangers across the hex remain valid choices. It is not restricted to 85 units or to the actor's village. The pool is built once per hourly pass, rather than rebuilding seasonal courtship state or checking every adult pair. Adding eligible singles can still add real choices and real work. The regression adds unrelated older adults or children, who cannot enter that partner pool.

The campfire envelope ignores walls during the reverse search, so it includes every possible guest without changing the final navigation decision. It visits terrain links once to construct reverse links and explores only tiles inside the travel budget. This removes population-wide guest testing without imposing a new distance rule. `pathfinding.js` only exports its existing minimum heap for this search. The algorithm for choosing paths is unchanged.

Visit expiry still checks existing planners once per hour. The campfire attention-conflict guard still checks for an existing chat/customs caller. These are state checks, separate from per-person candidate searches. No persistent idle-status cache was added. The baseline idle filter accounts for one profile sample, 1.134 ms across the whole live observation. The existing resident index removes directory-wide enumeration while current availability remains accurate.

## Behaviour and work counts

The fixture uses real navigation, household and relationship data. It contains a married household, two eligible singles, a distant friend, a nearby stranger, housemate children and distant child friends. It records choices at 09:00, 10:00, 11:00, 12:00, 18:00 and 20:00. It exercises daily visit exclusion between hourly opportunities. The original snapshot records five adult visits and six play pairs. The snapshot was captured before runtime edits and was never updated afterward.

The work regression spies on imported `partnerInterest` and `eligiblePartner` calls. Proxies count reads of known relationship entries, including child candidate checks. These counts exclude the necessary single roster pass.

| Probe | Original, small fixture | Original, with 200 far strangers | Current, small fixture | Current, with 200 far strangers |
| --- | ---: | ---: | ---: | ---: |
| Older adult additions: partner-interest calls | 42 | 42,442 | 3 | 3 |
| Older adult additions: imported eligibility calls | 14 | 1,014 | 2 | 2 |
| Older adult additions: known-entry reads | 31 | 1,031 | 21 | 21 |
| Child additions: partner-interest calls | 42 | 42 | 3 | 3 |
| Child additions: imported eligibility calls | 14 | 14 | 2 | 2 |
| Child additions: known-entry reads | 31 | 39,831 | 21 | 21 |

Both additions preserve the same two adult visits and two child-play pairs in the work fixture. The campfire regression retains a distant friend on a fast, one-way approach and checks zero of 200 far strangers. The commons regression retains the same two witnesses and checks zero ages among 200 distant village members. Existing campfire, household and social-mobility tests also pass unchanged.

The history driver calls `generateWorldHistory(state, 13)` with an empty initial state, then serialises the complete resulting state without projection, sorting, rounding or omitted fields. The before and after JSON strings compare directly equal. Each contains 199,928,327 bytes, with SHA-256 `5c22e0dcd4489c73646701b29ed3823e7d5e35097a95e6a4e30bf63621d7f5e2`. This also matches the earlier step-8 report. Captures and receipts are under `.cache/nearby-visits/`.

## Desktop live sample

The controlled samples produce the same ordered 26 starts: 23 adult visits and 3 child-play starts. Their full start lists have SHA-256 `481dd6632f35ba1b3a4b1c73cab4c007ff5dc7ecef82f002c075d906d180979f`. Both end on game day 0.5041666666666869, after exactly 1,860 planner steps. Both have zero page errors. The comparison checks the complete ordered records of hour, actor, partner and kind. It does not compare only counts or unordered pairs.

| Controlled measurement | Before | After |
| --- | ---: | ---: |
| Sampled socialHour CPU, whole observation (ms) | 37.344 | 32.675 |
| Frame count | 411 | 331 |
| Frame interval median (ms) | 66.7 | 83.4 |
| Frame interval p95 (ms) | 100.1 | 116.8 |
| Frame interval maximum (ms) | 566.6 | 533.3 |
| Simulation tick median (ms) | 2 | 2.6 |
| Simulation tick p95 (ms) | 5.4 | 6.9 |
| Simulation tick maximum (ms) | 114.5 | 119.6 |
| Observed wall duration (ms) | 31631.1 | 31588.4 |

The controlled CPU estimate changes from 37.344 to 32.675 ms (12.5% reduction). It contains 41 samples before and 37 afterward. This small sample does not establish a reliable frame-rate gain. Load averages at launch were 2.01 / 2.79 / 3.18 before and 3.74 / 3.1 / 3.25 afterward.

The initial ordinary samples use the original frame-dependent ticker input. Their ordered start lists differ, despite both containing 18 starts. They end on different game days: 0.49617250000000157 and 0.4919383333333347. The ticker caps long frame intervals at 100 ms, so different renderer schedules change the planner steps and availability at each hour. These failed comparison receipts and both raw samples remain available.

| Original ticker measurement | Before | After |
| --- | ---: | ---: |
| Sampled socialHour CPU, whole observation (ms) | 25.017 | 26.321 |
| Frame count | 385 | 353 |
| Frame interval median (ms) | 66.7 | 83.3 |
| Frame interval p95 (ms) | 150 | 133.4 |
| Frame interval maximum (ms) | 433.4 | 450.1 |
| Simulation tick median (ms) | 1.1 | 1.2 |
| Simulation tick p95 (ms) | 5 | 6.3 |
| Simulation tick maximum (ms) | 37.6 | 36 |
| Observed wall duration (ms) | 31644.4 | 31575.6 |

The mismatch led to an identical-state diagnostic. It uses the original hourly function from base `562d504`, the new function, and the persistent live index. All three agree at 10:00, 11:00 and 12:00. The measure driver's opt-in `--fixed-live` mode then holds the initial state until recording and runs the real planner at fixed 60 Hz steps. It catches up after slow render frames. Both versions receive the same 1,860 inputs during the 31-second observation, with real navigation, work, needs and social outcomes. This controls the demonstrated input difference. It does not fabricate people, dates, relationships or chosen pairs.

Controlled tick measurements cover each presentation frame's batch of fixed planner steps. Original tick measurements cover one ordinary ticker callback. Compare each before/after pair within its own table. The command is `flock -w 7200 /tmp/27agents-gate.lock node scripts/step8-measure.cjs LABEL desktop http://127.0.0.1:8195 --live-only --fixed-live`, with labels `fvb` and `fva`. The same server serves the saved baseline bundle first and the candidate bundle afterward. Both bundles remain under `.cache/nearby-visits/`.

The samples use `scripts/step8-measure.cjs`, seed 13, production bundles and the same Chromium executable. The viewport is 1440 by 900. Chromium reports version 156.0.8078.4. The host reports an AMD EPYC 9354P with four available CPUs. The driver retains its 31,000 ms observation wait. The added `--live-only` option ends after this observation, before saves and hops. It observes visit objects after the simulation tick and records each start once. The same observer runs before and after. It records real planner outcomes.

CPU totals sum CDP sample intervals for `socialHour` and all descendants, using each bundle's source map. The after total includes its population-index wrapper. These are sampled CPU estimates, not per-call stopwatch timings. Frame intervals measure presentation cadence. Tick durations exclude synchronous autosave posting, as in the existing measure driver. They include the identical visit observer. SwiftShader and shared-host scheduling limit conclusions about hardware frame rates. One controlled sample per version establishes neither statistical significance nor an ordinary-device performance guarantee.

## Checks and receipts

All named paths below are under `.cache/nearby-visits/`, except the raw browser reports under `.cache/step8/`. Test and build commands use the two prescribed shared locks. No whole-suite run or test-configuration exception was used.

| Check | Exact result | Exit code | Receipt |
| --- | --- | ---: | --- |
| Initial production build | App and save worker compile. Three bundle-size warnings | 0 | `before-build.log`, `before-build.exit` |
| Initial work regression | 1 suite fails: 2 work tests fail, 1 choice test passes. One initial snapshot written | 1 | `test-first.log`, `test-first.exit` |
| Baseline choice fixture alone | 1 suite, 1 test, 1 snapshot pass. Two work tests excluded by the explicit name filter | 0 | `baseline-choices.log`, `baseline-choices.exit` |
| Baseline lint | Zero errors or warnings | 0 | `baseline-lint.log`, `baseline-lint.exit` |
| Baseline history capture | 199,928,327 bytes, hash above | 0 | `before-history-receipt.json`, `before-history.exit` |
| Baseline desktop sample | 18 starts, zero page errors | 0 | `.cache/step8/nearby-before-desktop/report.json`, `before-live.exit` |
| Initial focused implementation checks | 5 suites, 67 tests and 1 snapshot pass | 0 | `focused.json`, `focused.exit` |
| Initial added bounds checks | 3 suites: 2 fail, 1 passes. 39 tests pass, 2 fail, 1 snapshot passes | 1 | `focused-bounds.log`, `focused-bounds.exit` |
| Initial combined source/test lint | Six missing-`require`-global errors in the existing customs test file | 1 | `source-lint.log`, `source-lint.exit` |
| Corrected bounds checks | 3 suites, 41 tests and 1 snapshot pass | 0 | `focused-bounds-fixed.log`, `focused-bounds-fixed.exit` |
| Corrected combined lint | Zero errors or warnings | 0 | `source-lint-fixed.log`, `source-lint-fixed.exit` |
| Final counted bounds checks | 3 suites, 41 tests and 1 unchanged snapshot pass | 0 | `bounds-final.log`, `bounds-final.exit` |
| Final affected gate | 137/137 suites, 1,343/1,343 tests and 1/1 snapshots pass. Zero failures, skipped tests, todo tests or snapshot updates | 0 | `affected-tests.json`, `affected-receipt.json`, `affected.exit` |
| Final source and test lint | Zero errors or warnings | 0 | `final-lint.log`, `final-lint.exit` |
| Final history comparison | Complete JSON strings byte-identical | 0 | `after-history-receipt.json`, `after-history.exit` |
| Final production build | App and save worker compile. Three bundle-size warnings | 0 | `after-build.log`, `after-build.exit` |
| Initial after desktop sample | 18 starts, zero page errors | 0 | `.cache/step8/nearby-after-desktop/report.json`, `after-live.exit` |
| Initial live-start comparison | Both samples have 18 starts, but the identities differ | 1 | `natural-comparison.json`, `natural-comparison.log`, `natural-comparison.exit` |
| Initial identical-state diagnostic | Driver restored data without reattaching directory prototypes | 1 | `same-input-initial.log`, `same-input-initial.exit` |
| Corrected identical-state diagnostic | Old function, new function and live index agree at 10:00, 11:00 and 12:00 | 0 | `same-input.json`, `same-input.log`, `same-input.exit` |
| Initial controlled browser launch | Chromium rejects its Unix socket path as too long. No sample starts | 1 | `fixed-before-live.log`, `fixed-before-live.exit` |
| Controlled baseline desktop sample | 26 starts, 1,860 steps, zero page errors | 0 | `.cache/step8/fvb-desktop/report.json`, `fixed-before-live-short.exit` |
| Controlled candidate desktop sample | 26 starts, 1,860 steps, zero page errors | 0 | `.cache/step8/fva-desktop/report.json`, `fixed-after-live.exit` |
| Controlled live-start comparison | 26 complete ordered start records identical | 0 | `live-comparison.json`, `live-comparison.exit` |
| Controlled driver lint | Zero errors or warnings | 0 | `fixed-driver-lint.log`, `fixed-driver-lint.exit` |

The affected runner copies `scripts/history-cpu-gate.cjs` into the receipt directory, changes its base to `562d504`, and redirects its outputs under `.cache/`. The import-graph selector is unchanged. It runs the explicit 137-file list with `flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS npx jest --runTestsByPath ... --maxWorkers=2 --workerIdleMemoryLimit=1GB --json`. Jest reports 89.622 seconds. The process receipt reports 159.375 seconds including lock wait, source `c5f4ed82a718e85d01966673db31abc480bdbdf2`, and exit 0.

The repository has no TypeScript configuration or typecheck script. ESLint and the production compiler cover the changed JavaScript. The build commands use the second lock. History and browser probes use the first lock.

The two initial bounds failures were fixture mistakes. The direct campfire test needed the social state that `socialHour` normally initialises. The commons fixture has two nearby witnesses, rather than the assumed one. The corrected test asserts that original pair before adding distant villagers and compares it afterward. The lint failure came from the existing test's undeclared `require` calls. Declaring that test global resolves it. No runtime assertion was weakened. All failed receipts remain available.

One final browser command was queued before the production build finished. Its owned `flock` was cancelled while still waiting, before a browser started. The cancelled process returned 143. Its receipt is `queued-live-cancelled.exit`, with the reason in `cancelled-queued-live.txt`. The completed after sample starts only after the build passes. The original live samples remain available. Their unequal simulation inputs led to the controlled comparison described above. An exploratory CPU-summary command also used `require` on a `.cpuprofile` JSON file and returned 1. The corrected summary uses JSON parsing.

The identical-state diagnostic first restored a save without calling the normal `replaceGame` attachment step. That omitted remote directory prototypes and failed inside the unchanged courtship retry. The corrected diagnostic uses the real restore/replace path. It compares both algorithms and the persistent live index on the same three hourly states. The first controlled browser label also made Chromium's Unix socket path exceed its limit. Shorter output labels keep every temporary file inside the worktree and resolve that launch failure.

## Commits and limits

- `20265f0`: Green baseline choice fixture and live-start observation in the measure driver.
- `c5f4ed8`: Green bounded candidate implementation and work regressions.
- `70cc9be`: Green controlled-input live measurement.
- The report commit completes delivery without changing the frozen runtime.

The deterministic choice fixture, exact history comparison and live-start comparison provide the requested behaviour evidence. The live sample covers daytime hours. Evening campfire selection and commons witnesses are covered by focused tests, rather than an invented live outcome. Independent acceptance, mobile sampling, hardware frame-rate acceptance and deployment are outside this builder pass. Raw profiles, complete histories, source maps and all logs remain untracked under `.cache/`.
