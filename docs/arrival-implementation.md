# The arrival, piece 1

The player arrives at an edge camp with a campfire and bedroll, no stores,
no house, no followers, no village membership and empty kinship. The terrain
survey chooses two connected grassland clearings near the edge and keeps its
deterministic retry rule. Village placement considers reachable nearby sites
first. Starting trees are counted after clearing the camp ring.

Popup orders append to an ordered personal job queue. Stable task ids support
repeated destinations, drag reordering, accessible up/down controls and
cancellation. Reordering preserves completed gathering, delivery and work.
Hunger and sleep can interrupt orders. Queue edits preserve meals in progress.
The existing popup Cancel link uses the same cleanup as the queue’s × button.
Depleted or missing gathering targets advance rather than blocking the queue.
Villagers retain their existing planner priorities and household control, while
the player works through the personal queue.

Tasks accept `forId` and `expectedGoodwill`. The panel can display these fields,
but nothing in the game creates favours. This first arrival piece did not add a
favour list, person panel or family tree. The subsequent people UI work is
recorded in [people-ui-implementation.md](people-ui-implementation.md).

Chopping and ordered foraging carry goods home. Camp goods lie on the ground,
with no camp container. Finished shelters provide an owned store and sleeping
place. The camp's sleep position is the bedroll. Construction physically fetches
owned loose, stockpiled or contained wood, delivers each log, then accumulates
work. Workers contribute to the same effort total; helping does not move a
villager's household or change their cached bed. Upgrades retain the entity id,
location and stored goods. Camps and shelters block tree regrowth.

| Stage | Logs for this stage | Work at full speed | Store capacity |
| --- | ---: | ---: | ---: |
| Lean-to | 4 | 2 hours | 8 portions/items |
| Hut | 10 | 5 hours | 20 portions/items |
| House | 20 | 10 hours | 40 portions/items |

Log costs are additional at each upgrade. Hunger slows walking and work using
the existing survival rules. Construction may wait for wood; the player can
reorder gathering ahead of it. A cancelled construction order leaves the
part-built site available to resume from its popup.

## Mock-up and mobile

Section 01 supplies the panel's width, left position, palette, current-task
highlight, progress, amount, queue wording, hunger wording and footer note.
The desktop player name/status HUD sits below the world beside the queue,
following the mock-up. The brief's single hunger sentence is displayed as the
mock-up's separate “Hungry” and “Working more slowly” labels.

Intentional differences from the static sample:

- Real tile coordinates replace invented place names. Time estimates include
  direct walking distance and remaining work, in minutes; food/sleep delays and
  timber collection are not predicted.
- Up/down buttons replace the sample's decorative ↕ indicator, on desktop too.
  Dragging remains available, including the current task.
- Actual task counts, log amounts, building durations, generated names and
  hunger levels replace sample values. No sample favours are fabricated.
- On narrow or short screens the queue starts collapsed above the speed controls.
  The name/status stays in the compact strip. The toggle opens a scrollable list;
  up/down and cancel controls have 44px targets. Landscape popups sit beside
  the strip so both remain visible. The desktop name/status HUD moves
  into the strip on these screens.

One finger pans, two fingers pinch to zoom and twist to rotate; a tap selects
and opens the popup. Pointer cancellation does not select anything. Touch selection waits until the
browser's follow-up click has passed, so opening a menu cannot accidentally
activate the button beneath the finger. Existing
new-game windows and popups scroll within the viewport. Menus, window close
buttons, chooser controls and speed controls have 44px targets. Fonts use pixel
sizes rather than shrinking with viewport height. Selected-person text remains
readable above the speed controls. Nothing requires hover.

The screenshot script explicitly enables the existing selected-person HUD as
well as the new player HUD to check both at desktop and phone sizes. Snapshot
construction uses fixture logs; all delivery, walking and work use the real
planner. The separate playtest builds a lean-to from trees through popup orders,
without injected materials.

## New UI wording

Mock-up wording and pre-existing order labels are reused where available. This
is the complete inventory of added wording and templates (including accessible
labels); placeholders stand for live values.

- `Build shelter`; `Build the hut`; `Build the house`.
- `Camp`; `Lean-to`; `Hut`; `House`.
- `Waiting for logs`; `Building`; `Carrying food to camp`; `Carrying logs to camp`.
- `Choose an action on the map to add a task.`
- `Tile {x}, {y}`; `You · Stranger · Camp at the edge`;
  `You · Stranger · {Lean-to|Hut|House}`.
- `0 of 1 meal`; `0 of 1 task`.
- `Ready`; `{hunger stage} · {task or activity}` in the compact strip.
- `{delivered} of {required} logs · {worked} of {required} minutes of work`
  in construction information.
- `Expand task list`; `Move earlier`; `Move later`; `Cancel {task title}`;
  `Close menu`; `Close window`.
- `Carrying goods home`; `Walking`; `Chopping wood`; `Foraging`; `Sleeping`;
  `Eating`; `Clearing a field`; `Clearing a stockpile`; `Waiting`; `Working`
  in the existing selected-person HUD (`Building` is shared).

The sample already supplies `Your tasks`, `{n} IN QUEUE`, `Chop wood`,
`Forage & eat`, `Build the lean-to`, `Your work`, `Camp`, the log-count/progress
and approximate-time formats, `For {name}`, `Favour · {goodwill estimate}`,
`Hungry`, `Working more slowly`, `You have no food. Foraging is next.`,
`Collapse task list`, and `Drag ⠿ to reorder · × to cancel · You do each job.`
The existing game supplies Move here, Recruit, Create Field, Create Stockpile,
Fed, Starving and Dead. The ↑/↓ controls use the new accessible labels above;
the player marker ♙ comes from the mock-up.

## Tests and gates

Five new Jest files cover camp placement across eight seeds; queue append,
order, duplicate destinations, reorder, cancellation and advancement; `forId`;
interruption and delivery; staged construction and shared effort; bedroll and
shelter sleeping; owned food storage/eating; ten-day forage survival and
starvation; low-poly assets; approved panel content and synthetic touch gestures.

Existing tests changed:

- `test/map.test.js`: the village house count no longer adds a player house.
  It now also asserts exactly one camp; the test description names the camp.
  All existing village size, spacing, membership and household checks remain.
- `test/ecology.test.js`: added two checks that regrowth avoids camps/shelters.
  No existing assertion changed.
- `test/selected_person.test.js`: added a readable arrival activity-label check.
  No existing assertion changed.

No tests were weakened or deleted. Every production behaviour was driven by a
failing focused Jest test. Red-run evidence is retained in `shots/red-*.log`.
CSS layout was also checked against real browser captures.

The later boundary in the brief forbids a whole-suite run, so the AFFECTED gate
was used. No whole-suite Jest command was run. This JavaScript project has no
TypeScript check; the build compiles JS/JSX and runs ESLint. Separate ESLint on
`src` and the three arrival/playtest scripts also passed with no output.

The affected command, under `/tmp/27agents-gate.lock`, was:

```sh
npx jest --maxWorkers=2 --findRelatedTests src/game/map.js src/game/world_terrain.js src/game/manager.js src/game/construction.js src/game/tasks.js src/game/compound.js src/game/primitive.js src/game/simulation.js src/game/ecology.js src/render/camera.js src/render/models.js src/render/world_view.js src/components/task_panel.js src/components/world.js src/components/user_interface.js src/components/info.js src/components/window.js src/components/selected_person.js src/data/messages.json test/arrival.test.js test/arrival_tasks.test.js test/camera.test.js test/task_panel.test.js test/arrival_view.test.js
```

Literal summary from `shots/jest-final.log`:

```text
Test Suites: 23 passed, 23 total
Tests:       154 passed, 154 total
Snapshots:   0 total
Time:        11.485 s, estimated 12 s
```

Build command: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`.
Literal tail from `shots/build-final.log`:

```text
WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/

webpack 5.112.2 compiled with 3 warnings in 11300 ms
```

The three warnings concern asset size, entrypoint size and code splitting.

`node scripts/arrival-check.js` checks 40 numeric/text seeds, then runs the real
player's planner for ten days from camp. The wider check lives outside Jest to
keep the quick gate near its previous time. Seed 13 ate nine meals, survived
with hunger 1.5833 and no Starving flag. With food removed, the same player's
hunger reached 3.4463 and Starving after three days. A repeat of the ten-day run
matched its complete final ECS SHA-256:
`ec0d935a86e8f2cfa59be920cf6625a09d9afc2d7754783b65ed64ccdc71aa99`.
Full output: `shots/arrival-check.log`.

## Browser evidence

All sixteen final captures were inspected at their full viewport sizes. The
desktop task list was compared with section 01. Portrait controls remain readable;
landscape popups sit beside the task strip. The phone script asserts 44px queue,
speed and popup button targets, and checks that tapping opens a popup without
activating its action.

The captures use 1440×900 and 390×844. The phone context sets `isMobile: true`
and `hasTouch: true`; landscape is 844×390. Chromium uses SwiftShader and an
eight-second initial wait. Reproduce with:

```sh
node scripts/arrival-shots.js http://localhost:8101/
```

All paths below are under `/home/cp/code/tinyking-arrival/` (gitignored):

| State | Desktop | Phone portrait |
| --- | --- | --- |
| Camp start | `shots/desktop-camp.png` | `shots/phone-camp.png` |
| Several tasks | `shots/desktop-tasks.png` | `shots/phone-tasks.png` |
| Part-built site | `shots/desktop-construction.png` | `shots/phone-construction.png` |
| Finished lean-to | `shots/desktop-lean-to.png` | `shots/phone-lean-to.png` |
| Finished hut | `shots/desktop-hut.png` | `shots/phone-hut.png` |
| Hunger warning | `shots/desktop-hunger.png` | `shots/phone-hunger.png` |

Additional captures: `shots/phone-landscape.png`, `shots/phone-popup.png`,
`shots/desktop-new-game.png`, `shots/phone-new-game.png`.
Capture log: `shots/screenshots.log`.

The server command was:

```sh
npx webpack serve --config webpack.dev.js --no-open --port 8101
```

Three consecutive runs of `npm run playtest -- http://localhost:8101/` passed
all 16 checks each, with no console errors. Every run checked camp arrival,
selection, Recruit, Move here, field/stockpile/chopping orders, actual walking,
queue appearance and completion, villagers moving on the ground, carried-out
orders, a lean-to placed and built through the popup, resizing and the debug
worldgen page.

| Run | Passed | Failed | Log |
| --- | ---: | ---: | --- |
| 1 | 16 | 0 | `shots/playtest-1.log` |
| 2 | 16 | 0 | `shots/playtest-2.log` |
| 3 | 16 | 0 | `shots/playtest-3.log` |

Earlier development attempts interrupted by source/build reloads were repeated
with unchanged source. The screenshot check also found and drove the fix for
the touch follow-up click activating a new popup button.

The server was stopped with `kill -TERM 3446900`. `ss` then showed no listener
on port 8101; before/after output is in `shots/server-stop.log`. Port 8080 and
the other checkout were not used.

Implementation commits:

- `9625795554090b59dd7ba4ed19d9bbcc35a13830`: camp, personal queue, staged
  shelters, rendering, responsive UI and regression tests.
- `ea3bd46`: popup cancellation, touch selection and final layout corrections.

The final evidence commit contains this report and the reproducible scripts.
No push was made.
