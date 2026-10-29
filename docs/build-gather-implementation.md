# Waiting tasks and timber delivery

Construction uses HTN methods for collecting one stored log, carrying it to the
site, and doing the shared construction work. It never adds a chopping task.
Stored timber includes owned loose logs at camp or a finished shelter, owned
stockpile logs, and owned container contents. Ordered chopping already carries
its output home; the build now recognises that timber and resumes automatically.

The personal queue selects its first ready task. Missing targets, inaccessible
routes, depleted forage and unavailable timber leave the order in the list with
a reason. Runtime task failures release the order so later work can run; those
failures are retried after another order finishes or the planner's idle wait
finishes. Cached hauling pickups also replan if construction consumes their
chosen log before pickup. Construction pickup also removes timber from the
tile contents, so interrupted deliveries cannot duplicate a stockpile entry. Material and route conditions are checked again whenever the player
is free. Meals and sleep retain priority. Cancellation and reordering work when
the active order sits below waiting rows.

The panel highlights the assigned order, dims waiting rows and shows an
hourglass and reason. Its compact status also follows the assigned order.
Selecting the player suppresses the old selected-person HUD; selecting someone
else still displays it. Task locations use the owned home, named villages, or
terrain, compass direction and hex distance from camp.

## New UI strings

- `Waiting for logs · {delivered} of {required}` (extends the existing phrase).
- `Target gone`; `Site gone`; `No path there`; `No path to logs`.
- `Waiting for food to grow`; `No home for delivery`; `Can't do this yet`.
- `at camp`; `by your {lean-to|hut|house}`.
- `in {village}`; `near {village}`.
- `{terrain|woods|field} {direction} of camp · {distance} hexes`.
- `land` when no terrain is available in a partial state.
- Compass words: `north`, `north-east`, `east`, `south-east`, `south`,
  `south-west`, `west`, `north-west`. Existing terrain names are reused.
- Waiting marker: `⌛`.

## Tests

Test-first red runs are retained in `shots/red-build-gather.log`,
`shots/red-retry-edge-cases.log`, `shots/red-needs.log` and
`shots/red-consumed-log.log`, `shots/red-hauling-transfer.log` and
`shots/red-chop-delivery.log` and `shots/red-stockpile-space.log`.

Existing tests changed, without deleting tests or weakening retained checks:

- `test/arrival_tasks.test.js`: the depleted-plant test now expects the plant
  order to remain waiting, while retaining duplicate-order and later-completion
  assertions. This is the new requested behaviour. The stockpile redraw test now
  drives the real planner to pickup instead of calling the former combined
  construction primitive. The empty-stockpile and redraw assertions remain,
  with a new assertion that pickup removes the log from tile contents.
- `test/task_panel.test.js`: current-task fixtures include an assigned actor,
  because queue position no longer defines current work. The queued-place
  assertion uses readable location text instead of tile coordinates. The layout
  test also renders the selected player and asserts exactly one player name.
- `test/tasks.test.js`: added consumed-log and failed-transfer regressions;
  existing assertions are unchanged. These cover cached timber disappearing,
  full backpacks, missing held goods and a stockpile filling before delivery.
- `test/selected_person.test.js`: added player suppression and retained the
  existing other-person and hunger assertions.

Additional coverage in those files and `test/task_places.test.js` checks the
empty-store build, no unsolicited chopping, later task execution, camp delivery,
automatic resume ahead of later work, prefilled stores, partial deliveries,
cancellation, every task type's missing target, targets disappearing during a
walk, unavailable routes reopening, forage regrowth, runtime failure recovery,
active work below waiting rows, reachable stores, sleep-trip preservation and
a chop delivery that cannot pick up its logs.

`scripts/playtest.js` adds one fresh-map check through popup orders: construction
first, chopping second, waiting and chopping observed together, then completion.
`scripts/build-gather-shots.js` captures real planner state without fixture logs.

## Verification

The brief contains conflicting whole-suite instructions. Its later boundary
forbids whole-suite runs, so only the AFFECTED Jest gate was run. There is no
project `CLAUDE.md` and no TypeScript check; webpack compiles the JS/JSX and runs
ESLint. No dependency installation was needed.

The affected command was:

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --maxWorkers=2 --findRelatedTests src/game/manager.js src/game/construction.js src/game/compound.js src/game/primitive.js src/game/tasks.js src/game/htn.js src/game/simulation.js src/game/task_places.js src/components/task_panel.js src/components/selected_person.js test/arrival_tasks.test.js test/task_panel.test.js test/selected_person.test.js test/task_places.test.js test/tasks.test.js
```

Literal output from `shots/jest-affected.log`:

```text
Test Suites: 10 passed, 10 total
Tests:       92 passed, 92 total
Snapshots:   0 total
Time:        2.156 s
Ran all test suites related to files matching src/game/manager.js|src/game/construction.js|src/game/compound.js|src/game/primitive.js|src/game/tasks.js|src/game/htn.js|src/game/simulation.js|src/game/task_places.js|src/components/task_panel.js|src/components/selected_person.js|test/arrival_tasks.test.js|test/task_panel.test.js|test/selected_person.test.js|test/task_places.test.js|test/tasks.test.js.
```

Build command: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`.
Literal tail from `shots/build.log`:

```text
      runtime.42ef496b93112205a055.js
      vendors.9f95f87c7be5ff6052be.js
      app.73d3720ce8a42856a584.js

WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/

webpack 5.112.2 compiled with 3 warnings in 12620 ms
```

The three warnings concern bundle size, entrypoint size and code splitting.
Targeted ESLint passed with no output (`shots/eslint.log`).

## Browser evidence

The server command was
`npx webpack serve --config webpack.dev.js --no-open --port 8103`.

`node scripts/build-gather-shots.js http://localhost:8103/` passed. All four
final screenshots were opened and inspected. They show a waiting build and
active chopping, then the single player status name at the bottom. Chromium
used `--use-gl=swiftshader --enable-unsafe-swiftshader`. Phone contexts set
both `isMobile: true` and `hasTouch: true`.

All paths below are under `/home/cp/code/tinyking-build/` (gitignored):

| Viewport | Waiting build and active chop | Single player name |
| --- | --- | --- |
| 1440×900 | `shots/desktop-waiting-chop.png` | `shots/desktop-single-name.png` |
| 390×664 | `shots/phone-waiting-chop.png` | `shots/phone-single-name.png` |

Development browser checks exposed cached pickups, failed inventory transfers
and duplicate stockpile tile contents. Each now has a Jest regression. Logs and
the failure-state capture remain in `shots/`. The simulation-only replay also
completes the lean-to (`shots/later-build-node.log`).

The final consecutive runs use unchanged source after the build and screenshots
finished.

Command for each run: `npm run playtest -- http://localhost:8103/`.
The three commands ran sequentially and all exited with status 0.

```text
Run 1: 17 passed, 0 failed, no console errors
Run 2: 17 passed, 0 failed, no console errors
Run 3: 17 passed, 0 failed, no console errors
```

Literal playtest output is retained in `shots/playtest-1.log`,
`shots/playtest-2.log` and `shots/playtest-3.log`. Each includes the fresh-map
construction-before-chopping check and the original later construction check.

The server was stopped with `kill -TERM 3550936`. The final
`ss -ltnp 'sport = :8103'` showed no listener; before/after output is in
`shots/server-stop.log`. Port 8080 was not used. No push was made.
