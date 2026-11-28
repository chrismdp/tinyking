TinyKing week-playtest-8 report

All five required final runs passed, with exit 0 and 26/26 checks each. Frozen seed 13 passed three consecutive runs. Frozen seed 21 and dev seed 13 also passed.

The final affected Jest gate passed 21 tests. The production build exited 0. The driver waits for free neighbours, walks through clickable discovered ground and responds to real Chat refusals. Game source under `src/` did not change.

| Run | Source | Exit | Checks | Result |
| --- | --- | --- | --- | --- |
| `frozen13-1` | `6b389e4` | 1 | 1/2 | Server process had exited. Connection refused. |
| `frozen13-2` | `6b389e4` | 1 | 14/15 | Neighbour started walking during Chat approach. |
| `dev13-1` | `6b389e4` | 1 | 14/15 | Neighbour started walking during Chat approach. |
| `frozen13-3` | `85820ba` | 1 | 25/26 | Chat succeeded with a replacement. Order summary checked the original neighbour. |
| `dev13-2` | `85820ba` | 1 | 25/26 | Chat succeeded with a replacement. Order summary checked the original neighbour. |
| `frozen13-4` | `255ea8f` | 0 | 26/26 | Passed final driver. |
| `dev13-3` | `a15672e` | 0 | 26/26 | Passed final driver. |
| `frozen13-5` | `a15672e` | 0 | 26/26 | Passed final driver. |
| `frozen13-6` | `a15672e` | 0 | 26/26 | Passed final driver. |
| `frozen21-1` | `a15672e` | 0 | 26/26 | Passed final driver. |

Frozen seed-13 runs used `http://localhost:8184/`. Dev runs used `http://localhost:8176/?seed=13`. Frozen seed 21 used `http://localhost:8176/` after the successful dev run released that port. Its server served `dist` and the seed-21 template, with no URL seed.

Each run has its own `/tmp/tk-playtest8-<run>/` directory, including `playtest-report.json` and screenshots. Console logs and exit receipts remain in ignored `shots/week-playtest-8-evidence/`. No log files are committed.

The first two driver fixes are `6b389e4` and `85820ba`. The contact-target correction is `255ea8f`. The final test-fixture repair is `a15672e`. It does not change the driver. All final browser runs use the driver from `255ea8f`. The failing pure-choice tests were committed first as `098abd3`.

Chat candidates now use `chatUnavailable` and `canChatSoon` from the game. They must be free now and within the half-hour walk estimate. Approach candidates also exclude busy neighbours and keep every Move here target within the discovered route prefix. Useful movement through known ground can bring the player within the half-hour Chat range without revealing new land.

When no approach is available, discovery advances half an hour through the native speed control and looks again. It uses Rest when the player needs it. Discovery has a one-game-day budget and a 48-choice cap. Camera movement uses mouse drags and wheel zoom before trying the ground again. Each click still passes the renderer hit check.

A neighbour can become busy during a short approach. The driver reads the game's availability refusal and chooses again. The real conversation must still open, pause the world, establish contact and close through End chat. The later order summary checks the neighbour who actually opened that conversation. Gift preparation uses the same discovery path.

The final seed-13 runs logged a half-hour wait and five discovered approaches before the first Chat order. When that neighbour started walking during the later approach, the driver chose again and established contact. Seed 21 also exercised Rest and a half-hour wait during gift preparation.

Nine new pure-selection cases cover walking, working, eating, sleeping, hunger, tiredness, another conversation, spent patience and a long approach. They also cover choosing a free neighbour over a nearer busy one, recovery and unchanged snapshots. The existing fixtures now supply valid planner feelings. The existing friendly-neighbour test puts the player one tile closer so that the subject remains within the half-hour limit. A separate case rejects an overlong walk. The original assertions remain.

The first browser attempt failed because its background server did not survive the launching shell. A persistent foreground server fixed that setup error. The next frozen and dev attempts exposed the refusal during approach. The following attempts exposed the stale contact target. Each failure remains separate from the final results.

Dependency setup: `npm ci` exited 0, installed 1,056 packages in 13 seconds and used 336 MiB for `node_modules`. npm reported peer, engine and deprecation warnings, plus 18 moderate vulnerabilities. An initial parallel setup command could not open the build log before its directory existed. Webpack did not start in that attempt. The production build then ran once successfully.

The frozen build records source `377bf4a7deb5addc4ce52047b0c97f5b086b4ac6`. All later changes affect the driver, its tests and this report. A checksum comparison confirmed that dev startup and shutdown preserved every frozen artifact.

Server commands:

```sh
python3 scripts/serve-frozen.py dist --port 8184
npx webpack serve --config webpack.dev.js --port 8176 --host 127.0.0.1 --output-path /home/cp/code/tk-playtest8/shots/week-playtest-8-dev-dist
python3 scripts/serve-frozen.py dist --port 8176 --worlds worlds/seed21
```

All final playtests used the default 60-second observation setting, `CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`, and the shared heavy-slot locks. Frozen runs 4 and 5 and seed 21 used `/tmp/27agents-gate.lock`. The dev run and frozen run 6 used `/tmp/27agents-gate-2.lock`. Game time advanced through actual UI orders and the native speed control. No existing timeout or outcome assertion was relaxed.

The affected gate selects `test/playtest_selection.test.js`. The required complete browser runs exercise the driver itself. This JavaScript repository has no TypeScript gate. Node syntax checks and ESLint passed. No whole-game Jest suite ran.

<details>
<summary>Literal gate and build outputs, including failures</summary>

Pure-choice regression before implementation. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
FAIL test/playtest_selection.test.js
  ● waits for a busy neighbour instead of approaching them: {"task":["walk_to","field"]}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● waits for a busy neighbour instead of approaching them: {"task":["chop","tree"]}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● waits for a busy neighbour instead of approaching them: {"task":["eat"]}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● waits for a busy neighbour instead of approaching them: {"task":["sleep"]}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● waits for a busy neighbour instead of approaching them: {"world":{"feeling":{"hungry":true}}}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● waits for a busy neighbour instead of approaching them: {"world":{"feeling":{"tired":true}}}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● waits for a busy neighbour instead of approaching them: {"world":{"feeling":{},"capturedBy":"someone-else"}}

    expect(received).toBeNull()

    Received: {"indoors": false, "moves": ["6", "5", "4", "3", "2"], "person": "8"}

      175 |   const before = JSON.stringify(s);
      176 |   expect(chatCandidates(s)).toEqual([]);
    > 177 |   expect(personApproach(s)).toBeNull();
          |                             ^
      178 |   expect(JSON.stringify(s)).toBe(before);
      179 |   s.ecs.planner[person] = { task: ["home_downtime"], world: { feeling: {} } };
      180 |   expect(personApproach(s).person).toBe(person);

      at test/playtest_selection.test.js:177:29

  ● approaches a free neighbour ahead of a nearer busy one and waits for spent patience

    expect(received).toBe(expected) // Object.is equality

    Expected: "8"
    Received: "9"

      186 |     personable: { age: 30 }, controllable: { controllerId: "other" } }]);
      187 |   s.ecs.planner[busy] = { task: ["walk_to", "home"], world: { feeling: {} } };
    > 188 |   expect(personApproach(s).person).toBe(person);
          |                                    ^
      189 |   s.chat = { pairs: { [actor + ":" + person]: { resting: 6 } } };
      190 |   expect(personApproach(s)).toBeNull();
      191 | });

      at Object.<anonymous> (test/playtest_selection.test.js:188:36)

  ● moves closer before Chat when the walk exceeds half an hour

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 3

    - Array []
    + Array [
    +   "8",
    + ]

      195 |   s.ecs.playable[actor].known = tiles.map(id => Hex().fromPoint(s.ecs.spatial[id]));
      196 |   for (const walk of Object.values(s.ecs.walkable)) walk.speed = .1;
    > 197 |   expect(chatCandidates(s)).toEqual([]);
          |                             ^
      198 |   expect(personApproach(s)).toMatchObject({ person, moves: [tiles[5], tiles[4], tiles[3], tiles[2], tiles[1]] });
      199 |   s.ecs.spatial[actor] = { ...s.ecs.spatial[tiles[5]] };
      200 |   expect(chatCandidates(s)).toEqual([person]);

      at Object.<anonymous> (test/playtest_selection.test.js:197:29)

Test Suites: 1 failed, 1 total
Tests:       9 failed, 12 passed, 21 total
Snapshots:   0 total
Time:        3.923 s
Ran all test suites matching test/playtest_selection.test.js.
```

First implementation, before correcting the short-walk fixture. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
FAIL test/playtest_selection.test.js
  ● chooses a known neighbour who accepts Chat, excluding refusal, sleep and exhausted patience

    expect(received).toEqual(expected) // deep equality

    - Expected  - 3
    + Received  + 1

    - Array [
    -   "9",
    - ]
    + Array []

      151 |     [person]: { likes: [], dislikes: ["brave"], opinionSeed: 1, opinionThresholds: { hate: -.5, love: .5 } } };
      152 |   const before = JSON.stringify(s);
    > 153 |   expect(chatCandidates(s)).toEqual([friendly]);
          |                             ^
      154 |   expect(personApproach(s).person).toBe(friendly);
      155 |   expect(JSON.stringify(s)).toBe(before);
      156 |   s.ecs.planner[friendly].task = ["sleep"];

      at Object.<anonymous> (test/playtest_selection.test.js:153:29)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 20 passed, 21 total
Snapshots:   0 total
Time:        1.114 s, estimated 4 s
Ran all test suites matching test/playtest_selection.test.js.
```

Affected gate after discovery changes. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=377bf4a
```

```text
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        0.986 s, estimated 1 s
Ran all test suites related to changed files.
```

Affected gate after handling refusal during approach. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=377bf4a
```

```text
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        0.789 s, estimated 1 s
Ran all test suites related to changed files.
```

Affected gate after correcting the contact target. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=377bf4a
```

```text
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        0.854 s, estimated 1 s
Ran all test suites related to changed files.
```

Final affected gate after repairing the preference fixture. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=377bf4a
```

```text
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        1.061 s
Ran all test suites related to changed files.
```

Production build. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npm run build
```

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.62 MiB
    asset app.0145f8c9ef402f925e9b.js 2.68 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.62 MiB (7.63 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.0145f8c9ef402f925e9b.js 2.68 MiB 3 auxiliary assets
  orphan modules 481 KiB [orphan] 140 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.29 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.47 MiB
      modules by path ./src/game/*.js 962 KiB 99 modules
      modules by path ./src/components/*.js 84.7 KiB 7 modules
      ./src/index.js + 66 modules 326 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 128 KiB [built] [code generated]
  json modules 1.83 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.81 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets: 
    app.0145f8c9ef402f925e9b.js (2.68 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.81 MiB), ./src/index.js + 66 modules (326 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.62 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.0145f8c9ef402f925e9b.js

  WARNING in webpack performance recommendations: 
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 29987 ms

save-worker:
  asset save-worker.js 11.9 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 58.2 KiB [orphan] 14 modules
  ./src/game/save_worker.js + 11 modules 60.6 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 773 ms
```

Frozen seed-13 template. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build-world -- --seed 13
```

```text

> tinyking@1.0.0 build-world
> node scripts/build-world.js --seed 13

Building world 2026-W48 for seed 13
{"week":"2026-W48","key":"v1/2026-W48.json.gz","seed":13,"out":"/home/cp/code/tk-playtest8/worlds/v1/2026-W48.json.gz","seconds":99.223,"compressedBytes":4552476,"MiB":4.342}
```

Frozen seed-21 template. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build-world -- --seed 21 --out worlds/seed21/v1/2026-W48.json.gz
```

```text

> tinyking@1.0.0 build-world
> node scripts/build-world.js --seed 21 --out worlds/seed21/v1/2026-W48.json.gz

Building world 2026-W48 for seed 21
{"week":"2026-W48","key":"v1/2026-W48.json.gz","seed":21,"out":"/home/cp/code/tk-playtest8/worlds/seed21/v1/2026-W48.json.gz","seconds":148.038,"compressedBytes":5408685,"MiB":5.158}
```

These commands exited 0 and produced no output:

```sh
npx eslint scripts/playtest.js scripts/playtest-selection.js test/playtest_selection.test.js
npx eslint test/playtest_selection.test.js
node --check scripts/playtest.js
node --check scripts/playtest-selection.js
git diff --check 377bf4a -- scripts/playtest.js scripts/playtest-selection.js test/playtest_selection.test.js
git diff --exit-code 377bf4a -- src
```

The world template SHA-256 values are:

```text
43fc68e5e53f128804a556be8788f1d66f9a7593dedb5aa650e104311b718338  worlds/v1/2026-W48.json.gz
915064cbd0144a50d1f20a6e56a49dbebcae93ffffb0613ccc318cbe2ef17df4  worlds/seed21/v1/2026-W48.json.gz
```

</details>

The standard playtest is the verified scope. The optional `--gift-only` and `--acceptance-fixes` modes were not separately run. No other seeds or whole-suite checks were added. The search budget remains bounded when no neighbour becomes available.

Only verified owned server PIDs were stopped: 1358278, 1360138 and 1384207. Only ports 8184 and 8176 were used. Ports 8080, 8081 and 8082 were untouched. All commits remain local on `week-playtest-8`. The report is committed separately.
