All three changes are implemented on `names-talk`, starting at `f417ff0a1841ea5ec79825c809a395dcf62b9ecc`. The final seed 13 world has 1,410 people and 1,410 distinct full names. The affected gate passed all 1,513 tests in 154 suites and one snapshot. The production build passed.

New people avoid names held by living or remembered people. The keeping question uses the listener’s portrait and real reaction. Family and Moods reserve it alongside required answers.

Rules and scope:

- Preserve family names and deterministic results for a given seed.
- Cover founding history, village families, settlers, births, player arrivals, maternal reference people and succession strangers.
- Use the listener's existing person reaction, including dislike of talking about themselves.
- Keep required answers before the keeping question in the four choices.
- Run narrow failing tests before each implementation, the affected Jest gate and one production build under shared locks.
- Generate seed 13 through `generateWorldGame`, with the game's CSV loading behaviour, and count every person in the world directory.

Setup: `npm ci` exited 0. It installed 1,056 packages in 15 seconds. npm reported existing peer/engine warnings and 19 dependency vulnerabilities. No dependency versions were changed.

Evidence and exit statuses follow. No sub-agents, other branches, outside-worktree writes, pushes or shared stash operations are part of this work.

Scope limit: this builder does not repeat the independent browser acceptance pass.

Preparation: name lists moved from CSV to JSON without changing any rows, including the loader's final empty row. Name allocation now needs these lists in simulation code, which Jest imports directly. JSON lets both Jest and the browser load the same data without adding a test transformer or changing the shared test configuration. Existing name-list mocks now target JSON. This is a data-format change only.

`flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/names.test.js test/character_names.test.js` exited 0. Literal output: `shots/names-data-check.log`.

Failing regressions before implementation:

`flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/person_names.test.js test/chat_own_question.test.js` exited 1. Literal output: `shots/names-talk-red.log`.

The run failed 13 tests and passed 5. It demonstrated all three requested defects: repeated and remembered names collided, all four authored keeping questions used Family icons, and the Family choices omitted an eligible keeping question. A three-community history contained 245 people but only 228 distinct full names. The regression also reproduced collisions at births, maternal references and succession.

Implementation:

- Added one name allocator in `src/game/name.js`. It checks local person records and all available world directories. It stores a changed first name in the existing component. It uses the person's seed, leaves a free original name intact, and changes only a colliding first name. Compound first names keep allocation possible after one family uses all ordinary first names.
- Called the allocator from normal entity creation, seasonal social creation and maternal reference creation. Founding communities share their earlier people before the world travel directory is assembled. Village families, player arrivals, settlers and succession use normal entity creation.
- Bound all four `own_question` rows to `npc` person icons. Existing person scoring supplies positive, neutral and negative reactions.
- Reserved an eligible `own_question` inside the existing required-choice merge for Family and Moods. Required answers still lead the choices.

An intermediate run passed all nine name regressions and the choice regressions, but still failed the three icon regressions. The JSON edit script stopped on an indentation assertion before changing the file. I corrected the edit and retained the failed run in `shots/names-talk-green.log` (exit 1, despite that filename). No game outcome was fabricated.

`npx eslint src/game/name.js src/game/entities.js src/game/social.js src/game/mother_family.js src/game/world_history.js src/game/chat.js scripts/research/names-talk-check.cjs` exited 0 with no output. This JavaScript project has no typecheck command or TypeScript configuration.

The seed 13 runs used the real `generateWorldGame` then `startGame` path under `/tmp/27agents-gate-2.lock`. The checker compares each generated person's final name with its original seed-derived name, so valley changes do not need a second generation run.

`flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/chat_own_question.test.js test/person_names.test.js test/chat_answers.test.js test/chat_row_rules.test.js test/people.test.js test/succession.test.js test/mother_family.test.js` exited 0. All 81 tests in seven files passed. Literal output: `shots/names-talk-focused.log`.

The first real seed 13 generation exited 0 in 125,515 ms. It contained 1,410 people and 1,410 distinct names. The additional maternal uncle changed from Hugh Seesi to Humphrey Seesi. Initial evidence is retained as `shots/names-talk-seed13-initial.*`.

A review then found that storing every generated name as a typed override froze the character editor's seed and sex changes. A new regression failed before the correction (`shots/names-reroll-red.log`, exit 1). Allocation now stores only a changed first name. Free names still come from their seeds and family names retain their original fields. I generated seed 13 again on the final implementation because the allocator changed.

Direct village-family and settler regressions were added. Their first run passed the uniqueness assertions but failed an incorrect fixture population assumption: the eight-house fixture creates 23 people, not more than 30. The test now checks the declared eight houses and its one player, alongside uniqueness. The failure remains in `shots/person-names-complete.log` (exit 1).

Final name regressions: `flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/person_names.test.js` exited 0. All 12 tests passed in 44.503 seconds. Literal output: `shots/person-names-final.log`.

Implementation commits:

- `8ed1a38`: load the unchanged name lists as JSON in the browser and simulation tests.
- `75e0c33`: allocate unique generated names across all creation paths and world records.
- `417cfc3`: bind the keeping question to the listener and reserve it beside required answers.

The affected gate passed using `flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=f417ff0 --runInBand`. No whole-suite command was run. The name-list format changes remain visible to Jest through imports. No shared harness, test configuration or generated types changed, so no whole-area exception is needed.

Final seed 13 evidence:

`flock -w 7200 /tmp/27agents-gate-2.lock node scripts/research/names-talk-check.cjs` exited 0. The real new-game path completed in 191,629 ms. It produced 1,410 people: 721 living and 689 dead. All 1,410 full names were unique. The starting valley was `5,3`, with 83 local living and remembered people. The first run and final run have the same name hash, `03b5afc390d3e93ecbd36bb902de89def4f5e885840dcde56f54f41e6d60bd39`.

The comparison uses each person’s original name and family seeds, with the new first-name override removed. No other generation inputs changed. These are all nine changes among the starting valley’s records:

| Person ID | Original name | Final name | State |
| --- | --- | --- | --- |
| `w5_3-social-41` | Ralph Thuson | Peter Thuson | Remembered dead |
| `w5_3-social-45` | Reynold Jobari | Nicholas Jobari | Remembered dead |
| `w5_3-social-52` | Reynold Thubaho | Henry Thubaho | Remembered dead |
| `w5_3-social-65` | Ralph Thuson | Adam Thuson | Living |
| `w5_3-social-68` | Edgar Thuson | William Thuson | Living |
| `w6_3-social-82` | Juliana Thuho | Joan Thuho | Living |
| `w6_3-social-89` | Agnes Friforrin | Joan Friforrin | Living |
| `w5_3-social-93` | Christina Thuson | Mabel Thuson | Living |
| `terrain5_3-person-4147` | Hugh Seesi | Humphrey Seesi | Living |

The additional maternal uncle is now Humphrey Seesi. The smith keeps Hugh Seesi. Family names are unchanged. The complete directory is in `shots/names-talk-seed13-people.json`, and the generation output is in `shots/names-talk-seed13.log`.

Remaining limits:

- Existing saves and the prebuilt Day-mode snapshots are not retroactively renamed. New creation checks their remembered records.
- Manual character name edits can still choose an existing name. This change allocates generated names at creation.
- No browser screenshots or independent play review were run. The tests cover data, reactions and offered choices, and the real seed run covers generation.
- The production build reports three bundle-size warnings. npm reports 19 existing dependency vulnerabilities.

No server was started, no port was used and no process was stopped. No sub-agent, other branch, vault, delegation log, bench ledger, push or stash was used.

Production build literal output:

Command: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by info 10.9 MiB [immutable]
    assets by chunk 7.27 MiB (auxiliary name: app)
      assets by path *.webp 241 KiB 5 assets
      assets by status 6.93 MiB [big] 2 assets
      assets by path *.jpg 105 KiB 2 assets
    assets by path *.js 3.66 MiB
      asset app.63274a7e422da3c82830.js 2.72 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
      asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
      asset runtime.f25bbccb9cd57926708e.js 1.59 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.66 MiB (15 MiB) = runtime.f25bbccb9cd57926708e.js 1.59 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.63274a7e422da3c82830.js 2.72 MiB 12 auxiliary assets
  orphan modules 520 KiB [orphan] 138 modules
  runtime modules 3.93 KiB 10 modules
  javascript modules 5.38 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.55 MiB 107 modules
  asset modules 7.27 MiB (asset) 378 bytes (javascript)
    modules by path ./src/assets/day/*.webp 241 KiB (asset) 210 bytes (javascript) 5 modules
    modules by path ./src/assets/day/*.gz 6.93 MiB (asset) 84 bytes (javascript) 2 modules
    modules by path ./src/assets/day/*.jpg 105 KiB (asset) 84 bytes (javascript) 2 modules
  json modules 1.81 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.79 MiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets:
    de6b6855a07c5b580ba7.gz (4.34 MiB)
    960cba74c132368dc2dd.gz (2.59 MiB)
    app.63274a7e422da3c82830.js (2.72 MiB)
      Largest modules: ./src/assets/day/seed-13.json.gz (4.34 MiB), ./src/assets/day/seed-7.json.gz (2.59 MiB), ./src/data/conversation_lines.json (1.79 MiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.66 MiB)
        runtime.f25bbccb9cd57926708e.js
        vendors.67f5ab9c200a0caba974.js
        app.63274a7e422da3c82830.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 49324 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.5 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 1048 ms

EXIT_STATUS=0
```

Source lint exited 0 with no output. Test lint exited 0 with no output using the files’ Jest globals:

`npx eslint --global it --global expect --global jest --global beforeEach --rule '{"no-redeclare":["error",{"builtinGlobals":false}]}' test/person_names.test.js test/chat_own_question.test.js test/names.test.js test/character_names.test.js test/first_run.test.js test/happy_paths.test.js test/mother_family.test.js test/day_view.test.js`

The first test-lint command omitted `beforeEach` and treated an existing globals comment as a redeclaration. It exited 1. The corrected command changes only lint invocation, and its output is in `shots/names-talk-test-lint.log`. The first output remains in `shots/names-talk-test-lint-initial.log`. No source or assertions changed for lint.

Changed existing tests: `names`, `character_names`, `first_run`, `happy_paths`, `mother_family` and `day_view` only change their name-list imports or mocks from CSV to JSON. Their behaviour assertions are unchanged. New rule tests are in `test/person_names.test.js` and `test/chat_own_question.test.js`.

Affected gate literal output:

Command: `flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=f417ff0 --runInBand`

```text
{"childExtras":false,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
{"childExtras":true,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}

Test Suites: 154 passed, 154 total
Tests:       1513 passed, 1513 total
Snapshots:   1 passed, 1 total
Time:        338.466 s
Ran all test suites related to changed files.

EXIT_STATUS=0
```

Acceptance evidence:

| Rule | Evidence | Result |
| --- | --- | --- |
| Unique generated names | Twelve creation, directory, save, exhaustion and reroll regressions, plus the real seed 13 world | 1,410 people, 1,410 full names, no duplicates |
| Listener portrait and reaction | All four authored rows bind the listener; proud, humble and neutral listeners change goodwill by +1, -1 and -0.25 | Passed |
| Always offered under Family and Moods | Twelve encounters per topic across six pending-answer states, plus full-row and ineligible cases | Required answers lead, the eligible question remains, and the set stays within four choices |
| Affected gate | `npx jest --changedSince=f417ff0 --runInBand`, under the first lock | Exit 0; 154 suites, 1,513 tests and one snapshot passed |
| Production build | One `npm run build`, under the second lock | Exit 0; app and save worker compiled |
| Source and test lint | Explicit changed JavaScript files | Exit 0 |

The built runtime candidate is `417cfc37ce0389416242b45fb45f0bdd5fc158eb`. Later changes contain only this report and captured evidence. The implementation is frozen for independent acceptance. All owned test, generation and build processes completed normally.
