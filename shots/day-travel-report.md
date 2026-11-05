# Day travel

Day travel is built. A hop takes three parts of the day, with a road result for each part. Seed 13 completes the solo return trip in six parts, reaching home at 6am on spring day 3. Its saved roads, fields, buildings and stores remain unchanged while the player is away.

All 13 new regression cases pass. The affected gate passes 1,413 tests and fails one maternal-recognition assertion. The same assertion fails against the supplied base commit, `c1e311d`. It has not been changed. The production build passes with three bundle-size warnings.

Seed 13 offered no companion during the first two seasons. The bounded search completed, so no companion was invented or sought in other seeds. Outgoing and returning companions, shared arrivals and three real conversations are proved by the simulation tests; they were not observed in this headless seed.

## Rules and implementation

- Travel choices list adjacent land passes from the existing map rules. Morning and afternoon allow departure. Evening lists the exact reason: "You cannot set out at nightfall".
- Travel approaches run the existing ordered walk and edge-crossing tasks. A long approach fits within the departure part: its calendar stops one minute before the part ends while the physical tasks finish. This abstraction applies only to the day caller.
- Road parts return a route, part number, actual seeded weather, dusk-camp flag and narrative lines. The third part enters the destination through `ensureMap`, `enterMap` and the existing arrival camp. It arrives at the start of the departure part tomorrow.
- Companion choices use actual same-way NPC journey intentions or pending departures. They create no travellers and change no destination. Both people cross the edge through their existing tasks. The real companion bundle shares the road and arrives with the player.
- Companion conversations use the existing chat system and the `chooseLine` hook in every road part. The shared required-encounter rule keeps replies available. Knowledge, regard, chat records and carried goods remain attached to the real people.
- Calendar boundaries call `advanceWorldClock` for every community. A hop without a crossed season adds no seasonal ageing. The source valley retains its detailed state. A save can resume the remaining road parts.

The walk-around travel calendar remains seasonal. Two shared defects found during play were fixed: fresh detail now retains generated resident positions, and road-wear updates do not require a renderer queue on away snapshots.

Runtime commits are `40474a3` and `f5239cb`. Driver and documentation commits are `26ec23a` and `ca0e69e`. The production bundle records `f5239cb280a9566655fca9f1b1b109a5970cb3960`; later changes affect the driver and documentation only.

## Tests and checks

`npm ci` ran first inside this worktree. It exited 0, installing 1,056 packages in 19 seconds. npm reported existing peer/engine warnings and 19 vulnerabilities. Dependency files did not change.

The repo uses Jest and plain JavaScript. It has no configured typecheck command or TypeScript area. ESLint and the production compiler checked the changed JavaScript. No whole-suite command ran: the affected selection was `--changedSince=c1e311d`. That import graph selected 145 files because travel is widely shared.

| Check | Exit | Result |
| --- | --- | --- |
| Affected Jest gate | 1 | 144 files passed; one base failure; 1,413 tests passed |
| Final away-departure, day-travel, road-wear and detail checks | 0 | 22 tests passed in three files |
| Base maternal-recognition reproduction | 1 | The same Personal-versus-Social assertion failed |
| Changed JavaScript lint | 0 | One existing unused-variable warning in the driver |
| Production build | 0 | App and save worker built; three bundle-size warnings |

The affected gate began before the final two-line road-wear fix. Its passing results were retained. The final fix and its new regression passed the focused three-file gate below. The build includes that fix. No existing test was edited.

The 13 new cases cover land/pass choices and nightfall; morning and afternoon arrivals; six-part return travel; a long approach; valid cold-map positions; away departures without a renderer; every community's seasonal update; outgoing and returning companions; real chat lines through the hook; a saved road journey; and distinct road event IDs in both legacy and canonical worlds.

Every new rule was tested before its implementation. The first seven cases all failed in [the initial red run](day-travel-red.log). Later red runs cover [long approaches](day-travel-long-walk-red.log), [canonical road event IDs](day-travel-events-red.log), [cold-map placement](day-travel-cold-map-red.log) and [away departures](day-travel-away-departure-red.log). The save test passed on its first run. Early import and fixture failures are retained in the development logs.

## Seed 13 proof

The world was copied from the location supplied in the brief. No world was generated or altered to produce an outcome. The driver ran on `127.0.0.1:8795`. The final proof server held `/tmp/27agents-gate.lock`; tests and builds used the shared locks. Only saved, verified owned process IDs were stopped. The proof server is stopped; its identity and stop receipt are in [day-travel-process-receipt.txt](day-travel-process-receipt.txt).

The driver now supports `/travel?to=6,3`, `/travel?to=6,3&p=<name>`, `/continue`, `/status` and `/result`. `/say?n=` still selects a displayed line; `/say?auto=1` uses the day layer's visible-choice policy. The proof uses HTTP actions. `/eval` was used only to read choices and inspect state, never to change it.

### Solo return trip

| Part | Calendar at start | Calendar at end | Road result |
| --- | --- | --- | --- |
| 1, outward morning | Spring 1, 9am | Spring 1, noon | Rain; real walk and edge crossing; 5,3 to 6,3 |
| 2, outward afternoon | Spring 1, noon | Spring 1, 6pm | Rain; continuing on the road |
| 3, outward evening | Spring 1, 6pm | Spring 2, 6am | Cloudy; dusk camp; arrived at the destination pass |
| 4, homeward morning | Spring 2, 6am | Spring 2, noon | Clear; real walk and edge crossing; 6,3 to 5,3 |
| 5, homeward afternoon | Spring 2, noon | Spring 2, 6pm | Rain; continuing on the road |
| 6, homeward evening | Spring 2, 6pm | Spring 3, 6am | Rain; dusk camp; arrived home |

The first result starts at 9am because that is the supplied arrival morning. Later mornings start at 6am. Both hops move the calendar by one date. There are no conversations on this solo trip. Raw results are retained as `day-travel-alone-1.json` through `day-travel-alone-6.json`.

### Home while away

Home had 82 other residents. Their IDs, ages and death flags match exactly before return; the returned roster adds the player. The original home/camp is still `terrain5_3-4151`.

The hash of saved walkable roads, fields, buildings and container amounts after departure equals the hash on return:

```text
bc63f51ef9fabb87dff203d64a988c3121baa9537cb5d3bef273bc198ff4ef9a
```

The hash differs from the initial pre-departure state because the real approach wears roads and lets local activity run before departure. No season falls during the two-day solo trip, so home receives no away seasonal step. Its detailed hourly work pauses while away. The seasonal regression separately proves one shared seasonal update per community and one for the player when the road crosses the boundary.

In `day-travel-home-away.json`, the remote player's `home` field reflects the currently occupied destination camp through the canonical identity record. It is not the remembered home property. The returned home ID and the detailed hash establish that the original property remains.

### Companion search

After the solo return, the player spent every part at the village green, from spring day 3 morning through summer day 7 evening. The driver checked travel choices at all 36 boundaries. None offered an available companion. The final state is 6am on autumn day 1, year 1 (`days=14.25`), at home in 5,3. Both seasonal turns completed. No extra seeds or extended calendar were used.

The complete slot-by-slot timeline, including the 36 waiting parts and dates as simulation days, is in [day-travel-timeline.csv](day-travel-timeline.csv). Full results are in [day-travel-timeline.json](day-travel-timeline.json), narration in [day-travel-proof-journal.txt](day-travel-proof-journal.txt), and every companion check in [day-travel-companion-search.json](day-travel-companion-search.json). The final HTTP proof exited 0; its literal output is in [day-travel-proof.log](day-travel-proof.log).

The companion tests use existing journey intentions for a real resident and a real visitor returning home. They verify a player-spoken authored line in every road part, invoke the `chooseLine` hook, preserve identity and age, and check joint arrival. The generated-world companion observation remains unproved because none was offered within the agreed window.

## Demonstrated failures and fixes

1. A valid seed 13 walk exceeded the time left in the departure morning. The day caller now bounds that approach's calendar. The failed planner state is in [day-travel-walk-failure.json](day-travel-walk-failure.json).
2. A newly opened neighbour put an NPC outside its detailed ground. `applyPreparedDetail` now keeps constructed resident positions. The original error is in [day-travel-return-failure.txt](day-travel-return-failure.txt).
3. An away departure tried to push into a missing renderer queue during the first season turn. The road-wear code now works without a renderer. The original error is in [day-travel-season-failure.txt](day-travel-season-failure.txt).
4. The text driver crashed when narrating regard for a new arrival without a previous value. It now prints "new arrival". The failed run is retained in [day-travel-proof-before-driver-fix.log](day-travel-proof-before-driver-fix.log).

The proof was restarted only after these demonstrated errors were fixed. One attempt also started before the HTTP server was ready; [its startup error](day-travel-proof-startup-failure.log) is a driver-ordering failure, not a game result.

## Remaining limits

The broad affected gate remains red because of the reproduced base maternal-recognition failure. The test expects Personal regard and receives Social regard with the same base score of 36.

The road account is brief. Weather is sampled from the departure region's existing weather model. Dusk camp is returned as narrative and a flag; it does not create a separate playable road map. Long local approaches finish their real tasks inside the chosen part while its calendar is bounded. A production day screen and independent browser acceptance are outside this layer task.

Companion travel was not observed headlessly because seed 13 offered none in the first two seasons. The simulation tests cover the rule. Road death and succession were not played in this proof.

## Literal gate output

### Affected gate

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=c1e311d --runInBand
```

Exit: 1. Full output follows and is also in [day-travel-affected.log](day-travel-affected.log).

```text
FAIL test/mother_family.test.js
  ● offers named searches in chat and recognises the player with a real first-meeting favour, reciprocal knowledge and Personal kin warmth only once

    expect(received).toMatchObject(expected)

    - Expected  - 1
    + Received  + 1

      Object {
        "base": 36,
    -   "ring": "personal",
    +   "ring": "social",
      }

      126 |   expect(s.chat.active.transcript.some(l=>l.family=="maternal_recognition")).toBe(true);
      127 |   expect(s.chat.active.transcript.some(l=>l.family=="favour_ask")).toBe(true);
    > 128 |   expect(s.ecs.relationships[person].known[player]).toMatchObject({ring:"personal",base:36});
          |                                                     ^
      129 |   expect(s.knowledge[player].people[person].nameOnly).toBeUndefined();
      130 |   expect(s.knowledge[person].people[player].maternalKin).toBeDefined();
      131 |   expect(familyGoal(s).met).toContain(person);

      at Object.<anonymous> (test/mother_family.test.js:128:53)

{"childExtras":false,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
{"childExtras":true,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}

Summary of all failing tests
FAIL test/mother_family.test.js
  ● offers named searches in chat and recognises the player with a real first-meeting favour, reciprocal knowledge and Personal kin warmth only once

    expect(received).toMatchObject(expected)

    - Expected  - 1
    + Received  + 1

      Object {
        "base": 36,
    -   "ring": "personal",
    +   "ring": "social",
      }

      126 |   expect(s.chat.active.transcript.some(l=>l.family=="maternal_recognition")).toBe(true);
      127 |   expect(s.chat.active.transcript.some(l=>l.family=="favour_ask")).toBe(true);
    > 128 |   expect(s.ecs.relationships[person].known[player]).toMatchObject({ring:"personal",base:36});
          |                                                     ^
      129 |   expect(s.knowledge[player].people[person].nameOnly).toBeUndefined();
      130 |   expect(s.knowledge[person].people[player].maternalKin).toBeDefined();
      131 |   expect(familyGoal(s).met).toContain(person);

      at Object.<anonymous> (test/mother_family.test.js:128:53)


Test Suites: 1 failed, 144 passed, 145 total
Tests:       1 failed, 1413 passed, 1414 total
Snapshots:   1 passed, 1 total
Time:        243.493 s
Ran all test suites related to changed files.
```

### Final focused gate

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/day_travel.test.js test/road_wear.test.js test/hex_detail.test.js
```

Exit: 0. Full output follows and is also in [day-travel-season-fix-green.log](day-travel-season-fix-green.log).

```text
Test Suites: 3 passed, 3 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        7.17 s
Ran all test suites matching test/day_travel.test.js|test/road_wear.test.js|test/hex_detail.test.js.
```

### Base reproduction

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/mother_family.test.js -t 'offers named searches' --moduleNameMapper='{"^game/(simulation|travel|hex_detail|day|road_wear)$":"<rootDir>/.cache/day-travel-base/$1.js","^game/(.*)$":"<rootDir>/src/game/$1","^data/(.*)$":"<rootDir>/src/data/$1"}'
```

Exit: 1. Full output follows and is also in [day-travel-baseline-recognition.log](day-travel-baseline-recognition.log).

```text
FAIL test/mother_family.test.js (12.496 s)
  ● offers named searches in chat and recognises the player with a real first-meeting favour, reciprocal knowledge and Personal kin warmth only once

    expect(received).toMatchObject(expected)

    - Expected  - 1
    + Received  + 1

      Object {
        "base": 36,
    -   "ring": "personal",
    +   "ring": "social",
      }

      126 |   expect(s.chat.active.transcript.some(l=>l.family=="maternal_recognition")).toBe(true);
      127 |   expect(s.chat.active.transcript.some(l=>l.family=="favour_ask")).toBe(true);
    > 128 |   expect(s.ecs.relationships[person].known[player]).toMatchObject({ring:"personal",base:36});
          |                                                     ^
      129 |   expect(s.knowledge[player].people[person].nameOnly).toBeUndefined();
      130 |   expect(s.knowledge[person].people[player].maternalKin).toBeDefined();
      131 |   expect(familyGoal(s).met).toContain(person);

      at Object.<anonymous> (test/mother_family.test.js:128:53)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 15 skipped, 16 total
Snapshots:   0 total
Time:        13.459 s
Ran all test suites matching test/mother_family.test.js with tests matching "offers named searches".
```

### Final lint

```sh
npx eslint src/game/day.js src/game/travel.js src/game/simulation.js src/game/hex_detail.js src/game/road_wear.js scripts/day-play.cjs test/day_travel.test.js
```

Exit: 0. Full output follows and is also in [day-travel-lint-final.log](day-travel-lint-final.log).

```text
/home/cp/code/tk-daytravel/scripts/day-play.cjs
  33:49  warning  'eldest' is assigned a value but never used  no-unused-vars

✖ 1 problem (0 errors, 1 warning)
```

### Production build

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

Exit: 0. Full output follows and is also in [day-travel-build.log](day-travel-build.log).

```text
> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.52 MiB
    asset app.3ca1e965a08446dbf37a.js 2.58 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.52 MiB (7.54 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.3ca1e965a08446dbf37a.js 2.58 MiB 3 auxiliary assets
  orphan modules 467 KiB [orphan] 134 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.23 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.4 MiB
      modules by path ./src/game/*.js 898 KiB 92 modules
      modules by path ./src/components/*.js 79.5 KiB 6 modules
      modules by path ./src/data/ 1.16 KiB 2 modules
      ./src/index.js + 65 modules 330 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 128 KiB [built] [code generated]
  json modules 1.77 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.75 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets: 
    app.3ca1e965a08446dbf37a.js (2.58 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.75 MiB), ./src/index.js + 65 modules (330 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.52 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.3ca1e965a08446dbf37a.js

  WARNING in webpack performance recommendations: 
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 38121 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.5 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 1667 ms
```

