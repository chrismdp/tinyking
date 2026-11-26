# World of the week

Runtime commit: `0ca7bd84d8ee38d10269253c0ac8323c0e08e0b8`. The initial feature commit is `bc49ab9ceaa9ce698018558dc55222a99b10dfa2`.
Branch: `world-of-the-week`, based on `b4b796378eb13e13075224e60cd9ae31549c0f8e`.
The final playtest harness commit is `e36562e50308d9e68ffbff48ab50cc0b0f03d711`. The final report is committed separately. Nothing was pushed.

The implementation builds the shared world in Node and loads it for normal new games. The world file contains history, home terrain, nearby terrain and the existing construction recipes. The browser creates the stranger, their known tiles, chosen character, family, arrival camp and first journal. Continue still reads the player's browser save through its existing path.

- Added `scripts/build-world.js` and `npm run build-world`. The script uses the existing version-1 save format and gzip. It accepts `--seed <n>` and `--out <path>`.
- Added a UTC ISO week seed, encoded as the week year times 100 plus its week number. The current week is `202648`. Boundary tests include ISO years that differ from calendar years.
- Split `generateWorldTemplate` from `startWorldPlayer`. Browser generation and downloaded worlds use the same player start. The shared file contains no player or personal backstory.
- Added a streaming download loader with download and unpack progress through the existing loading UI. HTTP, network, gzip and save-version failures reach a visible menu error. `?seed=<n>` still generates in the browser.
- Preserved `world.json.gz` when webpack cleans `dist`. The dev server serves it on 8190. The frozen server serves the production directory on 8191.
- Added Monday 04:00 UTC deployment with `0 4 * * 1`. Deployment runs `npm run build-world` after `npm run build`, and retains the push trigger.
- Changed the playtest to use the downloaded seed 13 world. It keeps all existing assertions, adds proof of the world download, and records click-to-standing time. Its browser enables the existing observer before boot so the same checks run against production.

Seed 13 produced 4,552,476 bytes, or 4.341579 MiB compressed. This is below the 20 MiB stop threshold and Cloudflare's 25 MiB file limit. The file's SHA-256 is `43fc68e5e53f128804a556be8788f1d66f9a7593dedb5aa650e104311b718338`. The dev and production builds preserved those bytes.

The measured world build took 1,145.997 seconds (19 minutes 6 seconds) on this shared host. The original log below incorrectly labels elapsed milliseconds as `seconds`. I corrected the display to divide by 1000 after this run. Generation and the gzip output were unchanged. I did not repeat the expensive generation for that display fix or the arrival-clock fix. Shared world generation and its data stayed unchanged. The supplied timing sketch calls `generateMap`; the implemented script follows the complete new-game path, which also builds whole-world history and nearby lands.

The frozen production playtest passed 25/25 checks, with 0 failures. The time from the actual Start new game click to standing was 10.946 seconds. This includes the automated character-screen visit, screenshot and five-second arrival. It excludes the initial page download. The test used localhost and software-rendered Chromium, rather than a public-network connection.

The initial affected Jest gates passed 123 tests in 15 files: 13 new tests and 110 existing tests. After the timing fix, the narrow arrival and simulation gate passed another 20 tests in three files. Some files ran in both gates. Every Jest invocation used `/tmp/27agents-gate.lock` and explicit file paths. No whole suite ran. The world comparison uses real history and terrain on a seven-hex seed 13 world, then compares all saved game data after both players start. It also checks canonical person references. No loading-screen appearance tests were added, and no existing assertion or timeout was weakened.

Dependency setup ran first: `npm ci`. It installed 1056 packages, audited 1057 packages and reported four minutes of installation time. Dependencies are private to this worktree. The repository has no TypeScript configuration or typecheck script. ESLint and the production webpack build checked JavaScript; Python's AST parser checked the frozen server.

The first dev smoke attempt navigated while webpack was still compiling and hit the existing 30-second navigation timeout. The log is retained below. Once webpack reported successful compilation, the identical smoke command passed. Its character screen was ready in 44.093 seconds. It proved exact world-file serving, deferred backstory creation, the personal family/journal/camp after Start game, and browser generation without a world download for `?seed=13`. No timeout was raised.

The first production candidate, `bc49ab9`, failed the original arrival timing check at 3.1957 seconds for a 5.2-second animation. Its other arrival conditions passed. I stopped that failed run during the construction checks, with two checks passed and one failed, and retained the partial receipts. Its exit code was 130.

The first browser frame counted time spent on character setup before arrival began. Three new tests failed first, then passed after the fix. An in-memory WeakMap now records when each arrival starts, and the first frame excludes time before that start. Resumed saves use the new page clock. Completed arrivals leave ordinary frame timing unchanged. The fix adds no saved timestamp and changes no timeout or playtest assertion.

Production ran once for each runtime candidate. The second build was required by the demonstrated timing failure. The final `dist/COMMITHASH` identifies `0ca7bd84d8ee38d10269253c0ac8323c0e08e0b8`. A later full run on `0ca7bd8` recorded 16 passing checks and one failure. It timed out in the six-hour observation while waiting up to 45 seconds for the next half-hour of game time. Its saved state was at day `0.7958333333333318`, normal speed, an idle player and 58.74 energy. It reported no console errors. Later simulation, construction and display checks did not run in that attempt. The complete failed receipt is retained below.

A bounded diagnostic used the actual seed 13 template, a normal personal start and 700 real simulation ticks. It crossed the failed clock time and reached day `0.8611111111111094`. Total Node profile duration, including loading and source imports, was 19.249 seconds. Its slowest tick was 0.774 seconds. Short browser profiles used a fresh world at the initial and original test zoom levels. They also advanced normally. These diagnostic fixtures included no private work orders, so they did not reproduce the full failed scenario.

The final replay adds state logging through the existing observation calls and optional CPU profiling around that same six-hour observation. It preserves the 1280 by 800 viewport, software-rendering flags, seed 13, default observation duration, every assertion, and every timeout. The production app and world bytes were unchanged. Profiling begins after the gift checks, so it does not affect the quoted startup measurement. The earlier timeout remains an unresolved performance finding rather than a silently discarded result.

Source and production assets stayed fixed during each frozen playtest. Screenshots and JSON receipts remain in `shots/world-of-the-week/frozen/`; the dev screenshot is `shots/world-of-the-week/dev-ready.png`.

To reproduce locally, run `npm ci`, `npm run build`, then `npm run build-world -- --seed 13`. For development, run `npm start -- --port 8190`. For frozen acceptance, run `python3 scripts/serve-frozen.py dist --port 8191` and the playtest command below. Set `CHROME` to an installed executable.

Public deployment was not run because this brief prohibits pushing. A prior-week save was not manually replayed in the browser. The Continue path is unchanged, and the affected save, restore and autosave tests passed. All processes started for this task were stopped before delivery. Ports 8080, 8081 and 8082 were never used.

## Command receipts

Outputs below retain the command text. Terminal colour codes are removed from the dev navigation trace; its text is unchanged. Empty lint output is identified explicitly. Exit codes come from the completed tool runs.

### Test-first failure

```sh
flock -w 7200 /tmp/27agents-gate.lock node_modules/.bin/jest --runInBand --runTestsByPath test/world_seed.test.js test/world_template.test.js test/world_loader.test.js
```

Exit code: 1.

```text
FAIL test/world_loader.test.js
  ● Test suite failed to run

    Configuration error:

    Could not locate module game/world_loader mapped as:
    /home/cp/code/tk-world/src/game/$1.

    Please check your configuration for these entries:
    {
      "moduleNameMapper": {
        "/game\/(.*)/": "/home/cp/code/tk-world/src/game/$1"
      },
      "resolver": undefined
    }

    > 1 | import { loadWorldTemplate } from "game/world_loader";
        | ^
      2 | import { compressGame } from "game/save_game";
      3 |
      4 | const fixture = { ecs: { nextId: 3, playable: {} }, map: { seed: 13 }, ui: { show: {} }, days: .375 };

      at createNoMappedModuleFoundError (node_modules/jest-resolve/build/index.js:1322:17)
      at Object.<anonymous> (test/world_loader.test.js:1:1)

FAIL test/world_template.test.js (43.491 s)
  ● ships only the world and starts the same personal game from gzip or browser generation

    TypeError: (0 , _world_history.generateWorldTemplate) is not a function

      12 |   try {
      13 |     const template = empty();
    > 14 |     await generateWorldTemplate(template, 13);
         |                                ^
      15 |     expect(Object.keys(template.ecs.playable || {})).toEqual([]);
      16 |     expect(Object.values(template.travel.people).some(p => p.playable)).toBe(false);
      17 |     expect(template.ui.playerId).toBeUndefined();

      at Object.<anonymous> (test/world_template.test.js:14:32)

FAIL test/world_seed.test.js
  ● Test suite failed to run

    Configuration error:

    Could not locate module game/world_seed mapped as:
    /home/cp/code/tk-world/src/game/$1.

    Please check your configuration for these entries:
    {
      "moduleNameMapper": {
        "/game\/(.*)/": "/home/cp/code/tk-world/src/game/$1"
      },
      "resolver": undefined
    }

    > 1 | import { weekSeed } from "game/world_seed";
        | ^
      2 |
      3 | it.each([
      4 |   ["2026-11-23T00:00:00Z", 202648],

      at createNoMappedModuleFoundError (node_modules/jest-resolve/build/index.js:1322:17)
      at Object.<anonymous> (test/world_seed.test.js:1:1)

Test Suites: 3 failed, 3 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        50.203 s
Ran all test suites within paths "test/world_seed.test.js", "test/world_template.test.js", "test/world_loader.test.js".

```

### New logic tests

```sh
flock -w 7200 /tmp/27agents-gate.lock node_modules/.bin/jest --runInBand --runTestsByPath test/world_seed.test.js test/world_template.test.js test/world_loader.test.js
```

Exit code: 0.

```text

Test Suites: 3 passed, 3 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        617.698 s
Ran all test suites within paths "test/world_seed.test.js", "test/world_template.test.js", "test/world_loader.test.js".

```

### Affected existing tests

```sh
flock -w 7200 /tmp/27agents-gate.lock node_modules/.bin/jest --runInBand --runTestsByPath test/map.test.js test/history_pads.test.js test/history_beds.test.js test/person_storage.test.js test/one_world.test.js test/nearby_courtship.test.js test/person_names.test.js test/hex_detail.test.js test/first_run.test.js test/intro.test.js test/save_game.test.js test/autosave.test.js
```

Exit code: 0.

```text

Test Suites: 12 passed, 12 total
Tests:       110 passed, 110 total
Snapshots:   0 total
Time:        315.51 s
Ran all test suites within paths "test/map.test.js", "test/history_pads.test.js", "test/history_beds.test.js", "test/person_storage.test.js", "test/one_world.test.js", "test/nearby_courtship.test.js", "test/person_names.test.js", "test/hex_detail.test.js", "test/first_run.test.js", "test/intro.test.js", "test/save_game.test.js", "test/autosave.test.js".

```

### World build

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build-world -- --seed 13
```

Exit code: 0.

```text

> tinyking@1.0.0 build-world
> node scripts/build-world.js --seed 13

Building world for seed 13
{"seed":13,"out":"/home/cp/code/tk-world/dist/world.json.gz","seconds":1145997.214,"compressedBytes":4552476,"MiB":4.342}

```

### Size threshold

```sh
node -e 'const fs=require("node:fs"); const n=fs.statSync("dist/world.json.gz").size; console.log(n+" bytes; "+(n/1048576).toFixed(6)+" MiB; below 20 MiB: "+(n<=20*1048576)); if(n>20*1048576) process.exit(20);'
```

Exit code: 0.

```text
4552476 bytes; 4.341579 MiB; below 20 MiB: true

```

### JavaScript lint

```sh
npx eslint src/game/world_seed.js src/game/world_loader.js src/game/world_history.js src/game/map.js src/components/world.js scripts/build-world.js scripts/playtest.js webpack.common.js webpack.dev.js
```

Exit code: 0.

```text
(no output)
```

### Test lint

```sh
npx eslint test/world_seed.test.js test/world_template.test.js test/world_loader.test.js
```

Exit code: 0.

```text
(no output)
```

### Builder lint after the timing display correction

```sh
npx eslint scripts/build-world.js
```

Exit code: 0.

```text
(no output)
```

### Initial production build

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

Exit code: 0.

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.61 MiB
    asset app.15753752ffe35c80b21d.js 2.67 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.61 MiB (7.62 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.15753752ffe35c80b21d.js 2.67 MiB 3 auxiliary assets
  orphan modules 477 KiB [orphan] 136 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.28 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.46 MiB
      modules by path ./src/game/*.js 958 KiB 99 modules
      modules by path ./src/components/*.js 84.7 KiB 7 modules
      ./src/index.js + 63 modules 321 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 127 KiB [built] [code generated]
  json modules 1.83 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.81 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets: 
    app.15753752ffe35c80b21d.js (2.67 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.81 MiB), ./src/index.js + 63 modules (321 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (127 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.61 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.15753752ffe35c80b21d.js

  WARNING in webpack performance recommendations: 
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 192820 ms

save-worker:
  asset save-worker.js 11.9 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 58 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60.6 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 7718 ms

```

### Arrival timing regression before the fix

```sh
flock -w 7200 /tmp/27agents-gate.lock node_modules/.bin/jest --runInBand --runTestsByPath test/intro.test.js
```

Exit code: 1.

```text
FAIL test/intro.test.js (5.886 s)
  ● excludes character setup before arrival from the first animation frame

    TypeError: (0 , _intro.introFrameSeconds) is not a function

      37 |   startIntro(state);
      38 |   const after = performance.now();
    > 39 |   const seconds = introFrameSeconds(state, before - 5000, after);
         |                                    ^
      40 |   expect(seconds).toBeGreaterThanOrEqual(0);
      41 |   expect(seconds).toBeLessThanOrEqual((after - before) / 1000);
      42 |   updateIntro(state, seconds);

      at Object.<anonymous> (test/intro.test.js:39:36)

  ● resumes a saved arrival with the new page's clock and no saved wall time

    TypeError: (0 , _intro.introFrameSeconds) is not a function

      51 |   const loaded = restoreGame(serialiseGame(state));
      52 |   expect(loaded.intro).toEqual(state.intro);
    > 53 |   expect(introFrameSeconds(loaded, 1000, 1100)).toBeCloseTo(.1, 10);
         |                           ^
      54 | });
      55 |
      56 | it("leaves the real frame interval unchanged after arrival finishes", () => {

      at Object.<anonymous> (test/intro.test.js:53:27)

  ● leaves the real frame interval unchanged after arrival finishes

    TypeError: (0 , _intro.introFrameSeconds) is not a function

      59 |   skipIntro(state);
      60 |   const now = performance.now();
    > 61 |   expect(introFrameSeconds(state, now - 5000, now)).toBe(5);
         |                           ^
      62 | });
      63 |
      64 | it("chooses another two-hex approach when the preferred approach is unwalkable", () => {

      at Object.<anonymous> (test/intro.test.js:61:27)

Test Suites: 1 failed, 1 total
Tests:       3 failed, 4 passed, 7 total
Snapshots:   0 total
Time:        7.012 s
Ran all test suites within paths "test/intro.test.js".

```

### Affected arrival and simulation checks after the fix

```sh
flock -w 7200 /tmp/27agents-gate.lock node_modules/.bin/jest --runInBand --runTestsByPath test/intro.test.js test/first_run.test.js test/simulation.test.js
```

Exit code: 0.

```text

Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        17.589 s
Ran all test suites within paths "test/intro.test.js", "test/first_run.test.js", "test/simulation.test.js".

```

### Arrival fix lint

```sh
npx eslint src/game/intro.js src/components/world.js test/intro.test.js
```

Exit code: 0.

```text
(no output)
```

### Final production build

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

Exit code: 0.

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.61 MiB
    asset app.aa4754042dc25bc338fb.js 2.67 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.61 MiB (7.62 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.aa4754042dc25bc338fb.js 2.67 MiB 3 auxiliary assets
  orphan modules 477 KiB [orphan] 136 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.28 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.46 MiB
      modules by path ./src/game/*.js 959 KiB 99 modules
      modules by path ./src/components/*.js 84.7 KiB 7 modules
      ./src/index.js + 63 modules 321 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 127 KiB [built] [code generated]
  json modules 1.83 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.81 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets: 
    app.aa4754042dc25bc338fb.js (2.67 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.81 MiB), ./src/index.js + 63 modules (321 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (127 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.61 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.aa4754042dc25bc338fb.js

  WARNING in webpack performance recommendations: 
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 184310 ms

save-worker:
  asset save-worker.js 11.9 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 58 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60.6 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 9008 ms

```

### Dev smoke before compilation finished

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome node shots/world-of-the-week/dev-smoke.js
```

Exit code: 1.

```text
page.goto: Timeout 30000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:8190/?intro=skip", waiting until "load"

    at /home/cp/code/tk-world/shots/world-of-the-week/dev-smoke.js:14:16 {
  log: [
    '  - navigating to "http://127.0.0.1:8190/?intro=skip", waiting until "load"'
  ],
  name: 'TimeoutError'
}

```

### Dev smoke after compilation finished

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome node shots/world-of-the-week/dev-smoke.js
```

Exit code: 0.

```text
PASS dev downloaded seed 13, created one browser player, and deferred the personal backstory; character ready in 44.093 seconds
PASS dev start created the personal family, first journal and camp; no page errors
PASS dev serves the exact 4552476-byte built world
PASS ?seed=13 enters browser generation without downloading the world

```

### Initial frozen playtest, stopped after a confirmed failure

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/home/cp/code/tk-world/shots/world-of-the-week/frozen npm run playtest -- http://127.0.0.1:8191/
```

Exit code: 130.

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://127.0.0.1:8191/

STARTUP menu ready after 2.19 seconds
STARTUP character/world ready after 26.617 seconds
STARTUP click Start new game to standing: 46.884 seconds (includes character screen and arrival)
PASS new games use the pre-built seed 13 world
FAIL the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":3.195699999809271,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
page.waitForFunction: Target page, context or browser has been closed
    at finishOrder (/home/cp/code/tk-world/scripts/playtest.js:151:16)
    at async play (/home/cp/code/tk-world/scripts/playtest.js:387:5)
    at async /home/cp/code/tk-world/scripts/playtest.js:62:5

```

### Second full frozen playtest, simulation observation timeout

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/home/cp/code/tk-world/shots/world-of-the-week/frozen npm run playtest -- http://127.0.0.1:8191/
```

Exit code: 1.

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://127.0.0.1:8191/

STARTUP menu ready after 1.405 seconds
STARTUP character/world ready after 24.21 seconds
STARTUP click Start new game to standing: 46.795 seconds (includes character screen and arrival)
PASS new games use the pre-built seed 13 world
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.798199999809263,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 21.013 seconds
STARTUP character/world ready after 28.997 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-828"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-74"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-784","stockpileTile":"terrain5_3-695","tree":"terrain5_3-2407"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":139,"to":4}
PASS the completed task leaves the panel
CHAT approach w5_3-social-74
CHAT panel open w5_3-social-74
CHAT line player.direct_answer.fallback_answer_wellbeing.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-74","lines":[{"id":"player.direct_answer.fallback_answer_wellbeing.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-74"}],"contact":{"day":0.4937499999999996,"position":{"x":2110.6358761346396,"y":667.4357592764001},"otherPosition":{"x":2160,"y":623.5382907247957}}}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4271","type":"wood","owner":"w5_3-social-96","personId":"w5_3-social-96","distance":5.415459315359215,"receiptDay":0.6479166666666657,"observedDay":0.6486111111111101}
page.waitForFunction: Timeout 45000ms exceeded.
    at play (/home/cp/code/tk-world/scripts/playtest.js:556:18)
    at async /home/cp/code/tk-world/scripts/playtest.js:62:5
FAIL the playtest ran to the end - "page.waitForFunction: Timeout 45000ms exceeded."
PASS no console errors - []

```

### Diagnostic harness lint

```sh
npx eslint scripts/playtest.js
```

Exit code: 0.

```text
(no output)
```

### Fresh-world Node simulation diagnostic

```sh
flock -w 7200 /tmp/27agents-gate-2.lock node --cpu-prof --cpu-prof-dir=shots/world-of-the-week/profiles shots/world-of-the-week/profile-simulation.js
```

Exit code: 0.

```text
Diagnostic fixture: actual seed 13 template, a default personal start, and real simulation ticks; no player orders or injected outcomes.
{"tick":0,"day":0.37569444444444444,"ms":773.793}
tick 0 day 0.37569444444444444 slowest_ms 773.793
tick 60 day 0.41736111111111096 slowest_ms 773.793
tick 120 day 0.4590277777777775 slowest_ms 773.793
tick 180 day 0.500694444444444 slowest_ms 773.793
tick 240 day 0.5423611111111105 slowest_ms 773.793
tick 300 day 0.584027777777777 slowest_ms 773.793
tick 360 day 0.6256944444444436 slowest_ms 773.793
tick 420 day 0.6673611111111101 slowest_ms 773.793
tick 480 day 0.7090277777777766 slowest_ms 773.793
tick 540 day 0.7506944444444431 slowest_ms 773.793
tick 600 day 0.7923611111111096 slowest_ms 773.793
tick 660 day 0.8340277777777761 slowest_ms 773.793
Completed real simulation through 0.8611111111111094 slowest_tick_ms 773.793

```

### Fresh-world close-view browser diagnostic

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome node shots/world-of-the-week/profile-browser.js
```

Exit code: 0.

```text
Diagnostic fixture: real seed 13 UI start. The evening fixture uses 600 real model ticks, with no private work orders or fabricated outcomes.
morning { frames: 45, seconds: 13.301200000286101, day: 0.3951388888888888 }
{ day: 0.8124999999999984 }
evening { frames: 38, seconds: 13.579099999904633, day: 0.8277777777777762 }

```

### Fresh-world browser diagnostic at the test zoom level

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome node shots/world-of-the-week/profile-browser.js
```

Exit code: 0.

```text
Diagnostic fixture at the original playtest zoom level: real seed 13 UI start. The evening fixture uses 600 real model ticks, with no private work orders or fabricated outcomes.
morning { frames: 88, seconds: 13.308099999904632, day: 0.41527777777777763 }
{ day: 0.8319444444444428 }
evening { frames: 68, seconds: 12.859900000095367, day: 0.8604166666666649 }

```

### Final frozen production playtest with CPU profiling

```sh
flock -w 7200 /tmp/27agents-gate.lock env TMPDIR=/home/cp/code/tk-world/shots/world-of-the-week/tmp CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/home/cp/code/tk-world/shots/world-of-the-week/frozen PLAYTEST_PROFILE=1 npm run playtest -- http://127.0.0.1:8191/
```

Exit code: 0.

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://127.0.0.1:8191/

STARTUP menu ready after 0.189 seconds
STARTUP character/world ready after 3.622 seconds
STARTUP click Start new game to standing: 10.946 seconds (includes character screen and arrival)
PASS new games use the pre-built seed 13 world
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.315,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 4.869 seconds
STARTUP character/world ready after 3.612 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-828"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-74"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-784","stockpileTile":"terrain5_3-695","tree":"terrain5_3-2407"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":139,"to":4}
PASS the completed task leaves the panel
CHAT approach w5_3-social-74
CHAT panel open w5_3-social-74
CHAT line player.direct_answer.fallback_answer_wellbeing.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-74","lines":[{"id":"player.direct_answer.fallback_answer_wellbeing.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-74"}],"contact":{"day":0.4937499999999996,"position":{"x":2110.6358761346396,"y":667.4357592764001},"otherPosition":{"x":2160,"y":623.5382907247957}}}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4271","type":"wood","owner":"w5_3-social-96","personId":"w5_3-social-96","distance":5.415459315359215,"receiptDay":0.6479166666666657,"observedDay":0.6486111111111101}
SIMULATION observation 1/12 {"day":0.6722222222222212,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.00555555555555541,"requestsStarted":true,"winter":false,"frames":1.7099999999965512}}
SIMULATION observation 2/12 {"day":0.6930555555555544,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.02638888888888875,"requestsStarted":true,"winter":false,"frames":1.6679999999958444}}
SIMULATION observation 3/12 {"day":0.7138888888888877,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555389,"requestsStarted":true,"winter":false,"frames":0.6479999999940915}}
SIMULATION observation 4/12 {"day":0.7347222222222209,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.02638888888888873,"requestsStarted":true,"winter":false,"frames":0.6299999999947747}}
SIMULATION observation 5/12 {"day":0.7555555555555542,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555368,"requestsStarted":true,"winter":false,"frames":0.6239999999944246}}
SIMULATION observation 6/12 {"day":0.7763888888888875,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.02638888888888871,"requestsStarted":true,"winter":false,"frames":2.5979999999923304}}
SIMULATION observation 7/12 {"day":0.7972222222222207,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555348,"requestsStarted":true,"winter":false,"frames":1.583999999990933}}
SIMULATION observation 8/12 {"day":0.818055555555554,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.026388888888888688,"requestsStarted":true,"winter":false,"frames":5.519999999991281}}
SIMULATION observation 9/12 {"day":0.8388888888888872,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555327,"requestsStarted":true,"winter":false,"frames":3.4979999999923272}}
SIMULATION observation 10/12 {"day":0.8597222222222205,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.026388888888888667,"requestsStarted":true,"winter":false,"frames":0.4859999999881328}}
SIMULATION observation 11/12 {"day":0.8805555555555538,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555306,"requestsStarted":true,"winter":false,"frames":3.479999999986033}}
SIMULATION observation 12/12 {"day":0.901388888888887,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.026388888888888646,"requestsStarted":true,"winter":false,"frames":0.4379999999870634}}
PASS villagers move about - {"moved":40,"of":83,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 111 115 116 117 119 120 123 124 126 128 129 130 132 133 134 136 139 142 145 146 147 148 149 153 154 155 156 159 160 161 162 163 164 165 166 167 168 169 170 171 172 173 174 175 176 177 178 179 180 181 182 183 184 185 186 187 188 189 190 191 192 193 194 195 196 197 198 199 200 201 202 203 204 207 208 211 212 213 214 215 216 217 218 219 220 221 223 227 229 230
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":53.597,"gameHours":5}
PASS the view follows a window resize - {"width":960,"height":640}
PASS the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

```

### Other checks

`git diff --check` passed with no output. The final code worktree was clean before the report commit. `sha256sum -c shots/world-of-the-week/world-sha256.txt` printed `dist/world.json.gz: OK` after both server builds. The frozen server returned HTTP 200, `Content-type: application/gzip`, and `Content-Length: 4552476`.

`python3 -c 'import ast, pathlib; ast.parse(pathlib.Path("scripts/serve-frozen.py").read_text()); print("Frozen server Python syntax: PASS")'` printed:

```text
Frozen server Python syntax: PASS
```

The deploy workflow check used `node -e` to parse `.github/workflows/deploy.yml` with `js-yaml`, assert the schedule equals `0 4 * * 1`, and assert a deploy step runs `npm run build-world`. It exited 0 and printed:

```text
Deploy YAML and weekly world-build step: PASS
```

The final process and port check printed:

```text
Owned Chromium profiles: none active
Ports 8190 and 8191: closed
Source commit: e36562e50308d9e68ffbff48ab50cc0b0f03d711
World SHA-256: 43fc68e5e53f128804a556be8788f1d66f9a7593dedb5aa650e104311b718338

```

## Anything found that should not exist

- One full run timed out during the unchanged 45-second simulation observation. The diagnostic fixtures did not reproduce the private-work scenario. The final replay and its results are retained alongside this failure.
- `npm ci` reported 18 moderate vulnerabilities. No dependency changes were made for this task.
- The playtest's default Chromium 1248 path does not exist on this host. The runs used the installed Chromium 1255 executable through `CHROME`.
- `src/components/world.js` contains two existing ASCII `0x1f` control characters around closing route elements. They are outside this change.
- The production build reports three size warnings. Its app entrypoint is 3.61 MiB, including a 1.81 MiB conversation data module. The complete warnings are retained above.
