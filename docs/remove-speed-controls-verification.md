TinyKing speed controls: implementation and verification, 19 November 2026.

The implementation is on `remove-speed-controls`, based on `00ff1c5`. The final runtime commit is `87427370a6cc2ee7dfdbe04ee350dcbb773f348f`.

Deleted the Pause and Normal buttons, `speed_controls.js`, `speed_keys.js`, the Space listener, their styles, and the `resume` guidance action. Removed the obsolete visibility flag from gameplay, tutorial setup and screenshot fixtures. The gameplay HUD now follows the current screen. Moved the existing Debug button beside the camera controls.

Kept `state.ui.actions.set_speed` because play and screenshot scripts still use it for observer pauses. Removed browser checks that only exercised the deleted buttons, their touch targets or their overlap with news. No Jest tests covered only those controls. No view tests were added.

Deleted the movement check's loop over every person and its distance dictionary. It now measures the player alone. Away people can have person records without local positions. Their positions have no bearing on this order. The original arrival-distance and positive-movement assertions remain. No missing-position guards were added.

Every production pause assignment was reviewed:

| Location | Reason | How play resumes |
| --- | --- | --- |
| `src/game/chat.js`, `openChat` | A conversation is open. | `closeChat` always selects normal speed. A failed opening also returns to normal. Old `previousSpeed` values cannot restore a manual pause. |
| `src/game/seasons.js`, `seasonTurnAt` | The season-turn page is open. | Begin calls `finishSeasonTurn`, clears the page and selects normal speed. Existing tests cover the complete pause and release. |
| `src/game/new_game.js`, `openCharacter` | Character setup is open. | Start game calls `startGame`, closes the menu/setup and selects normal speed. |
| `src/game/new_game.js`, `closeCharacter` | Cancelling setup returns to the main menu. | The menu remains paused. Start game or Continue leaves it through the normal start/load path. |
| `src/components/world.js`, `generate_map`, initial replacement | Generation owns an incomplete world. | Generation prepares normal speed before creating the live simulation. The loading screen covers generation. |
| `src/components/world.js`, `generate_map`, completion | Generation finishes while the menu/setup remains open. | Start game closes setup and selects normal speed. The browser smoke observed this exact transition. |
| `src/game/save_game.js`, `restoreGame` | A loaded conversation or season page remains open. | Its ordinary Close/Begin action resumes play. A manually paused world save loads at normal speed. |
| `src/game/hex_storage.js`, `decodeWorldSave` | The split save format restores the active map before choosing speed. | It follows the same conversation/season rule. A manually paused world manifest loads at normal speed. |
| `src/game/succession.js`, `resolveSuccession` | An existing season-turn page still owns its pause. | Begin releases that pause. Every other succession continues at normal speed, including a new stranger's arrival. |

Removed the unconditional pause after succession. Removed the redundant pause assignment after a fatal travel error. That error already blocks simulation through `travelError`. The fatal error still has no recovery UI. This existing limitation does not become recoverable through a speed button, and this change does not attempt to resume a partially failed transfer.

Twelve regression cases preceded the implementation. The red run failed on paused saves in both formats, obsolete guidance, legacy chat speed, succession and the travel-error speed marker. Two existing succession assertions now require normal speed. Other existing assertion edits only corrected quotes and indentation for lint.

| Check | Literal exit status | Pass counts or result | Complete output |
| --- | --- | --- | --- |
| `npm ci` | `0` | 1,056 packages installed in 26 seconds. npm reported 18 moderate vulnerabilities and dependency warnings. | Session installation output. |
| Narrow regression run, before implementation | `1` | 7 failed suites. 9 failed, 86 passed, 95 total tests. | [Red log](../shots/no-speed/red.log) |
| Same narrow regression run, after implementation | `0` | 7 passed suites. 95 passed tests. | [Green log](../shots/no-speed/green.log) |
| Affected Jest gate against `00ff1c5` | `0` | 154 passed suites. 1,507 passed tests. 1 passed snapshot. | [Affected log](../shots/no-speed/affected.log) |
| Initial lint attempt | `1` | 64 errors and 55 warnings, including missing test globals and existing quote/indentation errors. | [Initial lint log](../shots/no-speed/lint.log) |
| Test lint correction | `0` | 0 errors and 2 existing unused-variable warnings. | [Test lint log](../shots/no-speed/lint-tests-fix.log) |
| Final lint on all 29 changed JavaScript files | `0` | 0 errors and 2 existing unused-variable warnings. | [Final lint log, including the exact file list](../shots/no-speed/lint-final.log) |
| Production build before the startup correction | `0` | App and save worker compiled. 3 bundle-size warnings. | [Initial build log](../shots/no-speed/build.log) |
| Required full playtest, exactly one run | `1` | 0 passed checks and 2 failed checks. Initial render threw before the menu appeared. | [Playtest log](../shots/no-speed/playtest.log), [report](../shots/playtest-report.json) |
| Lint on the startup correction | `0` | 0 errors and 0 warnings. | [Startup lint log](../shots/no-speed/lint-startup.log) |
| Affected Jest gate against `0c8c2f6`, after the startup correction | `0` | No related tests found. The React correction received browser evidence instead of a view test. | [Startup affected log](../shots/no-speed/startup-affected.log) |
| First focused smoke | `1` | 5 passed checks. Its added movement assertion ran at a path segment boundary. No page errors were recorded. | [First smoke log](../shots/no-speed/startup-smoke.log), [observations](../shots/no-speed/startup-smoke.json) |
| Corrected focused smoke | `0` | 7 passed checks. A real player order moved 88.47077518499933 to 3.9615242270663202 units from its target. | [Final smoke log](../shots/no-speed/startup-smoke-completion.log), [observations](../shots/no-speed/startup-smoke-completion.json), [screenshot](../shots/no-speed/startup-smoke-completion.png) |
| Final production build after the startup correction | `0` | App and save worker compiled. 3 bundle-size warnings. | [Final build log](../shots/no-speed/build-final.log) |
| Owned server shutdown | `0` | Verified PID `2366066` belonged to this worktree's webpack process. Sent SIGTERM and confirmed the process and port 8136 were gone. | [Shutdown receipt](../shots/no-speed/server-stop.log) |

The affected gate used the shared test lock and stayed within the import graph:

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=00ff1c5 --runInBand
```

Its complete literal output follows:

```text
{"childExtras":false,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
{"childExtras":true,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}

Test Suites: 154 passed, 154 total
Tests:       1507 passed, 1507 total
Snapshots:   1 passed, 1 total
Time:        178.258 s
Ran all test suites related to changed files.

EXIT_STATUS=0
```

The startup correction used this narrow command:

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=0c8c2f6 --runInBand --passWithNoTests
```

```text
No tests found related to files changed since "0c8c2f6".

EXIT_STATUS=0
```

Both production builds used the shared build lock:

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

The second build was necessary because the failed browser run exposed an initial-render error in the new HUD condition. The correction uses `state.ui?.playerId` before UI state exists. The first build remains recorded. The final build's complete literal output follows:

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.58 MiB
    asset app.11b1667704789df2ad0a.js 2.64 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.58 MiB (7.59 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.11b1667704789df2ad0a.js 2.64 MiB 3 auxiliary assets
  orphan modules 459 KiB [orphan] 134 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.25 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.43 MiB
      modules by path ./src/game/*.js 931 KiB 96 modules
      modules by path ./src/components/*.js 84.5 KiB 6 modules
      ./src/index.js + 62 modules 318 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 126 KiB [built] [code generated]
  json modules 1.82 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.8 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets: 
    app.11b1667704789df2ad0a.js (2.64 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.8 MiB), ./src/index.js + 62 modules (318 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (126 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.58 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.11b1667704789df2ad0a.js

  WARNING in webpack performance recommendations: 
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 26151 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.6 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60.1 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 1017 ms

EXIT_STATUS=0
```

The required full browser command ran once:

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome npm run playtest -- 'http://localhost:8136/?seed=13'
```

Its complete literal output follows:

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8136/?seed=13

locator.waitFor: Timeout 300000ms exceeded.
Call log:
[2m  - waiting for getByText('Start new game', { exact: true }) to be visible[22m

    at waitForStartMenu (/home/cp/code/tk-nospeed/scripts/acceptance-selection.js:436:55)
    at opening (/home/cp/code/tk-nospeed/scripts/playtest.js:83:9)
    at async /home/cp/code/tk-nospeed/scripts/playtest.js:59:34
FAIL the playtest ran to the end - "locator.waitFor: Timeout 300000ms exceeded."
FAIL no console errors - ["pageerror: Cannot read properties of undefined (reading 'playerId')"]

EXIT_STATUS=1
```

The full run did not reach movement or later gameplay. It was not repeated. The startup correction received a focused seed-13 smoke with the opening skipped. That smoke observed generation, handover, absent speed buttons, Space, time advancement and one real Move here order. Its first movement probe waited for `progress == 1`, which the planner also uses at intermediate path segments. The corrected probe waited for the order to leave the queue. It retained the same distance assertion and recorded the actual distances. Both attempts remain in the evidence directory.

The corrected smoke's complete literal output follows:

```text
STARTUP menu ready after 0.239 seconds
PASS menu renders {}
STARTUP character/world ready after 95.858 seconds
PASS generation finishes in paused character setup {"speed":"paused","generating":false}
PASS Start game resumes normal play without speed buttons {"speed":"normal","days":0.3763888888888889,"controls":0}
PASS Space leaves normal play running {"speed":"normal"}
PASS time advances after handover {"days":0.37916666666666665}
MOVE_OBSERVATION {"player":"terrain5_3-person-3904","target":"terrain5_3-741","from":88.47077518499933,"to":3.9615242270663202,"assigned":"terrain5_3-person-3904","progress":1}
PASS one player completes the real Move here order {"player":"terrain5_3-person-3904","target":"terrain5_3-741","from":88.47077518499933,"to":3.9615242270663202,"assigned":"terrain5_3-person-3904","progress":1}
PASS no page errors {"errors":[]}

EXIT_STATUS=0
```

The screenshot was inspected. The Pause and Normal buttons are absent. The HUD, camera controls and existing Debug button remain visible.

This JavaScript repository has no configured typecheck. No whole-suite command, delegation, push, stash, outside-worktree source edit or independent storyboard was performed. The required affected graph selected 154 suites. The full browser acceptance result remains failed, with later gameplay unproved by that run. The focused correction evidence does not replace a full acceptance pass.

Implementation commits: `d1252cc` removed the controls and repaired pause rules, `0c8c2f6` updated scripts/docs and test lint, and `8742737` corrected initial rendering.
