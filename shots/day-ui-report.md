# TinyKing: a day with people

The browser game is built at `?mode=day`, with saved worlds for seeds 13 and 7. It has the day story, real conversations, a valley map, family trees, person sheets, an asks journal, travel and replay. The simulation rules are unchanged.

I played two full days through the UI at 1280 px and 390 px. The phone game then completed a three-part journey to another valley. All recorded story assertions passed, with no browser errors. The command runner ended with status 143 before it retained a clean child exit. That limit is recorded, not treated as a successful command exit.

The play exposed two confusing reference labels. Startup also needed an immediate menu and deferred legacy generation. The final menu appeared in 602 ms and opened the saved day game in 11,734 ms overall, with no browser errors. The final production build and focused menu check both passed.

The game is promising, but I cannot claim that it yet makes the player feel strongly consequential. Geoffrey's food promise stayed open after the two-day play. The portraits also reuse a small set of supplied paintings; women still use the supplied placeholder.

## Chris's four questions

| Question | Honest answer | Evidence |
| --- | --- | --- |
| Are there meaningful choices? | 3/5. Accepting or declining Geoffrey's food ask creates a purpose. Reading known tastes, making icon matches, choosing who gets a part of the day and spending a day on travel are real decisions. Ordinary chat still offers much small talk. | [Reply and icon preview](day-ui/desktop-day1-morning-reply-preview.png), [phone matching pair](day-ui/phone-day1-morning-matching-pair.png), [world map](day-ui/phone-world-map.png). |
| Do I feel I make a difference? | 2/5. Delivering food warmed Geoffrey's regard, and the promise persisted. The two-day run did not finish it. No peace or introduction outcome was proved through the UI. The final journal now states partial deliveries from their real records. | [After helping Geoffrey](day-ui/desktop-day1-evening-result.png), [open promise](day-ui/desktop-asks.png), [partial-delivery regression](day-ui/play-findings-green.log). |
| Is it immersive? | 3/5. Geoffrey recognises Dionisia's child. The village's actual quarrel reaches the story. People work, talk, eat and sleep; the road passes in three parts. Some sightings remain generic, and the older chat catalogue still produces repetitive replies. | [Morning result](day-ui/desktop-day1-morning-result.png), [overnight](day-ui/phone-day1-evening-result.png), [road](day-ui/phone-road-part1.png), [arrival](day-ui/phone-arrived-valley.png). |
| Do I care about the characters? | 3/5. An uncle's welcome and his short household meals give me a reason to return. Simon's “I'm only Simon. Nobody special in Reedbrook” gives him a little presence. The family and speech records help memory. Repeated portraits and limited responses to distress still weaken this. | [Person sheet](day-ui/desktop-people.png), [Geoffrey's own ask](day-ui/phone-asks.png), [corrected family tree](day-ui/final-family-phone.png). |

These are provisional judgments from my own play. I did not alter relationships, stocks, the clock or results to produce these scenes.

## What is built

| Requirement | Implementation and evidence |
| --- | --- |
| Quick start | `scripts/export-day-worlds.cjs` restores the supplied v8 snapshots with `replaceGame`, writes `serialiseGame`, gzips the result and proves a restore round trip. The committed static files contain 4,554,903 and 2,715,788 compressed bytes. The browser decompresses and calls `restoreGame` through the save module. Seed 13 opened in 8.280–10.599 seconds on this shared headless machine. [Export output](day-ui/export.log), [seed 7](day-ui/mechanical-seed7.png). |
| Day and night | The header shows season, day, current part, house and standing. Places and people offer the real `slotChoices`, including reasons for blocked actions. `playSlot` runs movement, work, conversations and sleep. Result prose uses actual sightings, learned facts, news, regard and unfinished reasons. Gathering also compares actual stocks. [Day story](day-ui/desktop-day1-morning-result.png), [next morning](day-ui/desktop-day1-evening-result.png). |
| Conversation | The row reuses the game's committed chat playback and real reactions. Icons stage, land and pop in green, red or grey. Replies preview their icons before Say this. Topics select family, work, news, help, village, season, moods or Tell. Required answers remain offered. Asks are offered and accepted through real lines. [Desktop conversation](day-ui/desktop-day1-morning-reply-preview.png), [phone conversation](day-ui/phone-day1-morning-reply-preview.png). |
| Reference views | Desktop keeps Map, Family, People and Asks on the right. Phone keeps them one tap away. The valley shows named houses, shared places, fields, gathering grounds and camp, with people and the player's location. Clicking a hex spends the part there. The tree uses real kin data and Unknown nodes. Sheets retain learned traits, story and speech. Asks retain the giver's actual wording, relevant learned news and outcomes. No relationship bars or scores appear. [Map](day-ui/phone-map.png), [tree](day-ui/final-family-desktop.png), [person](day-ui/desktop-people.png), [asks](day-ui/phone-asks.png). |
| Travel | The world uses real hex geometry and available routes. Departure is limited by the day layer. A hop uses three parts. The UI offers companions when the simulation supplies them. The observed journey was alone. It reached a new valley through real UI actions. [Road part one](day-ui/phone-road-part1.png), [part two](day-ui/phone-road-part2-result.png), [part three](day-ui/phone-road-part3-result.png). |
| Portraits | The supplied storybook assets are committed locally. Person id, sex and age select a stable image from the available pool. CSS crops the paintings to portrait frames. The pool has two adult male, two older male and two child variants, plus the supplied female/unknown placeholder. [Portraits in the person sheet](day-ui/desktop-people.png). |
| Replay and seasons | Replay restores the same seed, and the picker restores the distinct seed 7 world. There is no week-end limit in the screen. Numerical season boundaries become season names and display the simulation's own change lines. The real season crossing passes the existing day test; it was not reached in the browser pass. [Replay and seed receipt](day-ui/mechanical-first.json), [season/day tests](day-ui/affected-initial.log). |
| Phone and early preview | The real game ran two days at 390 px, with no horizontal overflow. Story and reference controls remain usable. The first working screenshots were committed in `1f0f1ac`. [Early desktop](day-ui/early-desktop.png), [early phone](day-ui/early-phone.png), [final phone tree](day-ui/final-family-phone.png). |

The valley map groups ordinary ground under landmarks and arranges the landmarks in reading order. The world map preserves real world-hex positions. The day screen does not start a 3D renderer.

## What the play found and fixed

- Corrected anonymous family labels. The tree now shows a learned mother's name and keeps unlearned relatives Unknown. A person sheet distinguishes knowing a name from having met.
- Corrected ask feedback. Different kinds of ask keep their own quotations. An accepted request with recorded progress now states that some help reached the household.
- Corrected seasonal labels. Numeric boundaries render season names and preserve the actual seasonal summary lines.
- Corrected food feedback. Gathering reports actual stock changes, and the next choice shows the food available to offer.
- Corrected startup. The old menu launched generation immediately and hid its new entry behind the loading screen. Generation now begins only after Start new game.

The first mechanical run proved the family fixes, replay and seed picker, then failed on the hidden menu entry. Its failing output is retained. The final pass rechecks the corrected entry; it does not replay unchanged two-day scenarios.

## Checks and receipts

No whole test suite ran. Jest is this repository's runner. There is no separate typecheck command in this JavaScript repository. ESLint and webpack cover the touched source's syntax and module resolution.

| Check | Exit and result | Literal output |
| --- | --- | --- |
| Dependency install | `npm ci`: 0. 1,056 packages installed in 11 seconds. Existing Babel peer and engine warnings; 19 npm audit findings. Dependencies remain in this worktree. | Tool receipt; no install log file was retained. |
| Save export | 0. Both supplied snapshots converted and their player/clock round trips passed. | [export.log](day-ui/export.log) |
| Initial red test | 1. The presentation module did not exist yet. An intermediate name-table loader failure also returned 1 before the fixture mocks were added. | [test-first.log](day-ui/test-first.log) |
| Initial presentation test | 0. Nine tests passed. | [day-view-tests.log](day-ui/day-view-tests.log) |
| Initial affected regressions | 0. Four suites and 46 tests passed: presentation, day, day travel and asks. | [affected-initial.log](day-ui/affected-initial.log) |
| Refinement red tests | 1. Season names, distinct ask wording and the gathering landmark failed before implementation. | [refinements-red.log](day-ui/refinements-red.log), [map-red.log](day-ui/map-red.log) |
| Refinement green tests | 0. Twelve tests passed. | [refinements-green.log](day-ui/refinements-green.log) |
| Stock red/green tests | 1 before stock prose; 0 after it. The first road fixture lacked its container table (1); the corrected red fixture reproduced the missing-controller exception (1). | [supplies-red.log](day-ui/supplies-red.log), [supplies-green.log](day-ui/supplies-green.log), [road-stock-red.log](day-ui/road-stock-red.log), [road-stock-red-2.log](day-ui/road-stock-red-2.log) |
| Affected gate at first candidate | 0. `jest --changedSince=8f35028 --runInBand`: 14 tests passed. | [affected-final.log](day-ui/affected-final.log) |
| Reference findings red/green | 1 before the play findings; 0 after them. Sixteen tests passed. | [play-findings-red.log](day-ui/play-findings-red.log), [play-findings-green.log](day-ui/play-findings-green.log) |
| Early browser preview | Initial connection refusal; its stuck process was stopped by saved PID. Retry: 0, three screenshots and no page errors. | [early-preview.log](day-ui/early-preview.log), [early-preview-retry.log](day-ui/early-preview-retry.log) |
| Development compilations | Both 0. One earlier queued build wait was stopped before compilation because the second slot was occupied. | [dev-build.log](day-ui/dev-build.log), [dev-build-2.log](day-ui/dev-build-2.log) |
| Conversation probes | Probe 1: 0 with a driver timing race. Probe 2: 1, stopped server. Probe 3: 0 with the same early-frame race. Probe 4: 1, driver tried to read history before ending its long talk. These are not claimed as completed gameplay tests. | [probe.log](day-ui/probe.log), [probe-2.log](day-ui/probe-2.log), [probe-3.log](day-ui/probe-3.log), [probe-4.log](day-ui/probe-4.log) |
| Storyboard | Tool session: 143. Both two-day assertions, both viewport assertions, travel arrival and no-browser-error assertion passed. Browser child exit unknown. | [storyboard.log](day-ui/storyboard.log), [story.json](day-ui/story.json), [command receipt](day-ui/storyboard-command.json) |
| First mechanical pass | 1. Reference labels, replay and seed picker passed. The exact menu-name selector failed; startup also began legacy generation before selection. | [mechanical-first.log](day-ui/mechanical-first.log), [mechanical-first.json](day-ui/mechanical-first.json) |
| First production build | 0, runtime `c5462a8`. Three size warnings. | [production-build.log](day-ui/production-build.log) |
| Reference-fix production build | 0, runtime `550f8f0`. Required after the demonstrated reference fixes. | [final-production-build.log](day-ui/final-production-build.log) |

Initial lint passed with three unused warnings. A later script lint found quote errors and indentation warnings (1); automatic formatting fixed them. The final lint receipt is linked below. No existing test was changed.

Final menu regression, final affected gate, final production build and final mechanical receipts follow below. Four production builds ran as findings changed the candidate. That exceeded the brief's one-build target; all four outputs are retained.

## Remaining limits

- The two-day play proved a promise, partial help and changing regard. It did not prove a completed food promise, a peace, an introduction or a house being built.
- The UI journey was alone. Companion conversation is wired to the day hook and covered by existing travel logic tests, but was not observed in this browser run.
- A season boundary was tested in logic, including real simulation crossing. It has no browser screenshot from this pass.
- Supplied art is a small temporary pool. Faces repeat, the child paintings show little face detail, and women still use the placeholder.
- Sightings use broad words for activities outside the small presentation vocabulary. Some catalogue lines remain repetitive or emotionally flat.
- The story can report an unfinished chat task after the spoken conversation ended. That is the day result's actual task reason. I left the rule intact.
- The day game holds its current run in memory. Reloading starts the selected seed again. Persistent day-game resume was outside this brief.
- Initial load remains about eight to twelve seconds here. Webpack reports large bundle and world-asset sizes.

No deployment, push, delegation, external message or whole-suite test ran. All task files are in this worktree. The browser wrapper saves the PIDs of its server and command, and stops its own server afterwards.

## Final candidate gates

Runtime source: `cfc117e`. The last runtime correction paints the menu immediately and inspects saves asynchronously. Legacy generation starts only when Start new game is chosen. The entry check now passes with the actual accessible name, including its decorative arrow.

The two-day browser evidence uses runtime `c5462a8`. Reference labels were rechecked on `550f8f0`. Later changes affect reference labels and startup. They do not invalidate the recorded day simulation or travel outcomes. No existing test or simulation implementation changed.

| Final check | Exit and result | Literal output |
| --- | --- | --- |
| Startup and save regression | 0. Two suites, 17 tests passed. | [menu-regression.log](day-ui/menu-regression.log) |
| Affected Jest gate | 0. Sixteen tests passed. | [affected-menu-final.log](day-ui/affected-menu-final.log) |
| Source lint | 0. No warnings or errors. | [final-lint.log](day-ui/final-lint.log) |
| Browser driver lint | 0. No warnings or errors. | [browser-driver-lint.log](day-ui/browser-driver-lint.log) |
| Third production build | 0, runtime `7f7db9a`. Startup deferred generation. | [menu-production-build.log](day-ui/menu-production-build.log) |
| Final production build | 0, runtime `cfc117e`. Startup also paints the menu immediately. Three size warnings remain. | [ready-menu-production-build.log](day-ui/ready-menu-production-build.log) |
| Second and third menu checks | Both 1. The exact accessible-name selector failed. The DOM diagnostic proved the entry was visible. | [mechanical-second.log](day-ui/mechanical-second.log), [mechanical-third.log](day-ui/mechanical-third.log) |
| Menu DOM diagnostic | 0. The day link was visible, with its expected URL and a real on-screen rectangle. The only resource error was the favicon 404. | [menu-diagnostic.log](day-ui/menu-diagnostic.log), [captured menu](day-ui/menu-diagnostic.png) |
| Final focused menu browser check | 0. Menu in 602 ms; saved game in 11,734 ms overall; no browser errors. | [mechanical.log](day-ui/mechanical.log), [mechanical.json](day-ui/mechanical.json), [main menu](day-ui/main-menu.png), [opened game](day-ui/final-menu-entry.png) |

I initially treated the menu locator failures as startup failures. Capturing the DOM showed that the final two failures were also a driver-name mismatch. I corrected the selector and retained those failures. The startup changes independently remove generation and save inspection from the path to the day entry.

The literal final gate receipts follow. Each heavy command used one of the two shared locks.

`flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runInBand --runTestsByPath test/first_run.test.js test/autosave.test.js`

```text

Test Suites: 2 passed, 2 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        1.456 s
Ran all test suites within paths "test/first_run.test.js", "test/autosave.test.js".
exit=0
```

`flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=8f35028 --runInBand`

```text
Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        0.751 s, estimated 1 s
Ran all test suites related to changed files.
exit=0
```

`npx eslint src/components/world.js src/components/main_menu.js src/game/day_view.js src/components/day/*.js scripts/day-ui-*.cjs scripts/storyboard.js scripts/playtest.js webpack.common.js`

```text
exit=0
```

`flock -w 7200 /tmp/27agents-gate-2.lock node scripts/day-ui-serve.cjs npm run playtest -- 'http://127.0.0.1:8127/?mode=day' shots/day-ui --menu-only`

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://127.0.0.1:8127/?mode=day shots/day-ui --menu-only

PASS main menu is available before world generation {"milliseconds":602}
FRAME final-menu-entry.png 0.375
PASS main menu opens the saved day game {"milliseconds":11734}
PASS no browser errors []
exit=0
```

`flock -w 7200 /tmp/27agents-gate-2.lock npm run build`

<details>
<summary>Final production build output</summary>

Line-end padding is omitted here. The linked build log retains the unedited output.

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by info 10.9 MiB [immutable]
    assets by chunk 7.27 MiB (auxiliary name: app)
      assets by path *.webp 241 KiB 5 assets
      assets by status 6.93 MiB [big] 2 assets
      assets by path *.jpg 105 KiB 2 assets
    assets by path *.js 3.64 MiB
      asset app.a8716cab2afbea7a6bb9.js 2.7 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
      asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
      asset runtime.f25bbccb9cd57926708e.js 1.59 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.64 MiB (15 MiB) = runtime.f25bbccb9cd57926708e.js 1.59 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.a8716cab2afbea7a6bb9.js 2.7 MiB 12 auxiliary assets
  orphan modules 545 KiB [orphan] 139 modules
  runtime modules 3.93 KiB 10 modules
  javascript modules 5.36 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.53 MiB 105 modules
  asset modules 7.27 MiB (asset) 378 bytes (javascript)
    modules by path ./src/assets/day/*.webp 241 KiB (asset) 210 bytes (javascript) 5 modules
    modules by path ./src/assets/day/*.gz 6.93 MiB (asset) 84 bytes (javascript) 2 modules
    modules by path ./src/assets/day/*.jpg 105 KiB (asset) 84 bytes (javascript) 2 modules
  json modules 1.8 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.78 MiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets:
    de6b6855a07c5b580ba7.gz (4.34 MiB)
    960cba74c132368dc2dd.gz (2.59 MiB)
    app.a8716cab2afbea7a6bb9.js (2.7 MiB)
      Largest modules: ./src/assets/day/seed-13.json.gz (4.34 MiB), ./src/assets/day/seed-7.json.gz (2.59 MiB), ./src/data/conversation_lines.json (1.78 MiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.64 MiB)
        runtime.f25bbccb9cd57926708e.js
        vendors.67f5ab9c200a0caba974.js
        app.a8716cab2afbea7a6bb9.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 23593 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.5 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 659 ms
exit=0
```

</details>
