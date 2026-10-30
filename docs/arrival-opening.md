# Make camp after arriving

The opening starts without a camp entity, campfire or bedroll on the map.
The traveller enters from outside the boundary and crosses two hex links from the boundary tile to the clearing.
The traveller stops beside the future bedroll, lowers the bundle and stays standing.
The fire and bedroll scale into view in sequence.
At handover, the game creates the camp entity and assigns it as the player's household.

The camp uses the existing sleepable, controllable, village and spatial components.
It has one bed, no container and the grounded bundle.
Existing sleeping, loose goods, shelter placement and camp names therefore use the new location.
During setup, the renderer draws temporary pieces without creating a usable camp in the game state.
Skipping uses the same completion function as watching.

During the opening, all ordinary person activity bubbles stay hidden.
Selection markers also omit the extra height that makes room for those bubbles.
The renderer refreshes existing player and NPC models at entry and handover, even when their planners do not request a redraw.
After watching or skipping, ordinary activity bubbles and marker heights return.
The HUD skip prompt remains visible during the opening.

The intro review changed the earlier requirement that kept NPC bubbles visible.
`test/intro_view.test.js` now requires hidden NPC bubbles during the opening and restored idle, eating and trade bubbles after watch and skip.
Its existing player, marker, bundle and animation assertions remain.
`test/wood_task_view.test.js` tests ordinary NPC activity after the opening. Its eating, walking, trade, death and wood assertions remain.
Run `node scripts/intro-npc-label-shots.js http://localhost:8120/` against a server with hot and live reload disabled.
The script captures desktop and phone labels through real watch and skip inputs. It only reads game state.

## Timing and entry selection

The opening lasts 5.2 seconds, independent of simulation speed.
Time, needs, villagers and task queues stay frozen until handover.
The character remains at the stopped position throughout setup.
Click, tap, Escape and `?intro=skip` finish immediately with a standing character and a complete camp.

| Seconds | Behaviour |
| --- | --- |
| 0–0.3 | Hold the view of the traveller outside the edge |
| 0.3–2.7 | Walk from outside, through the boundary tile, two hex links inward |
| 2.7–3.7 | Lower the bundle from the shoulder to the ground |
| 3.7–4.25 | Scale in the campfire |
| 4.25–4.8 | Scale in the bedroll |
| 4.8–5.2 | Hold the completed setup, standing |
| 5.2 | Create the camp entity, assign the household and restore control |

The terrain survey now considers clearing centres exactly two hexes inside the boundary.
It retains two grassland rings, a nearby connected clearing, the mostly-land requirement and deterministic retries without an attempt cap.
Village placement still favours nearby reachable sites.
Tree generation still counts at least six reachable trees after clearing the camp ring.
Map entity placement rejects jittered tree positions outside existing grassland or inside settlements.
The lower-level tree generator and its exact historical count/checksum test remain unchanged.
Forage generation still supplies reachable starting food.

After village placement, the opening considers straight, connected approaches with exactly two links from the boundary tile to camp.
It ranks them by alignment towards the nearest village centre.
Stable direction order breaks ties, so the same seed produces the same route.
No approach crosses water or unwalkable land.
The camera holds the entry, traveller and camp together and fits the viewport's narrower field of view.

## Tests changed

All production changes followed failing tests.
The first red run failed 13 tests across five suites.
Separate red runs exposed the skipped character's missing facing direction and trees outside walkable land before those fixes.
No unrelated test assertion was relaxed.

| File and test | Change and reason |
| --- | --- |
| `test/intro.test.js`: closest connected edge across seeds | Replaced with no starting camp or player household, an outside starting point, exactly two adjacent inward links, walkable terrain and a repeatable route |
| `test/intro.test.js`: routes around unwalkable land | Changed the fixture to the future camp location and requires another valid two-link approach when the preferred approach is blocked |
| `test/intro.test.js`: skip to sitting at camp | Combined with the URL bypass test to compare the complete final ECS, intro and UI with watching, for skips in six phases and repeated skips |
| `test/intro.test.js`: ten real seconds with frozen simulation | Requires 4–6 seconds, no camp before completion, immediate standing and the same frozen time, needs, planners and queues |
| `test/intro.test.js`: URL bypass without changing needs or queue | Included in the complete final-state comparison above |
| `test/intro.test.js`: initial edge hold | Uses the shorter hold duration and still proves movement starts afterwards |
| `test/intro.test.js`: new village-facing test | Requires the route to face the nearer village, even with another village available |
| `test/intro.test.js`: new camp setup sequence test | Requires a stop, bundle drop, sequential fire and bedroll growth, late entity creation, household ownership, sleeping capacity and spatial indexing |
| `test/intro_view.test.js`: sitting with legs above ground | Replaced with standing geometry, no seated mesh, no carried bundle and the correct facing direction after a skip |
| `test/intro_view.test.js`: new camp setup visibility test | Requires all pieces hidden initially, bundle first, sequential piece scaling and the same final geometry as the real camp |
| `test/arrival.test.js`: new jittered-tree placement test | Requires every tree on seed 13 to remain on existing walkable grassland after jitter. The nearer-edge camp exposed three invalid trees, including one that broke chopping in the real playtest |
| `test/arrival.test.js`: edge camp playability across seeds | Requires no pre-placed camp, then skips the opening and checks the camp exactly two hexes inward on walkable grassland. Existing isolation, kinship, village, wood and food rules remain |
| `test/map.test.js`: hamlets with space around camp | Requires no camp or player household during generation. Existing village sizes, spacing, membership and every villager's household checks remain |
| `test/camera.test.js`: arrival framing at three sizes | Uses the new timing and checks the entry, traveller and camp throughout the opening at desktop, portrait and landscape sizes |
| `scripts/playtest.js`: opening check | Requires no starting camp, two links, a single completed camp, standing, the bundle placed, restored control, frozen simulation and 4–6 seconds |
| `scripts/playtest.js`: shelter completion wait | The first resumed series passed twice, then hit the 120-second construction timeout. The wait now allows 240 seconds for gathering, eating, sleeping and delivery through SwiftShader. The same actual lean-to completion assertion remains. The result records wall-clock seconds and game hours |
| `scripts/arrival-check.js`: seed checks | Adds two-link distance, no starting camp, walkability, grassland and reachable wood and forage to the existing 40-seed and survival checks |

The unchanged bundle geometry, lowering, death, skip overlay and game-control tests remain in the affected gate.
The older arrival and survival scripts now explicitly skip the opening before making their gameplay fixtures.
The weather bookkeeping benchmark removes all planners, so it does not require a playable camp and remains unchanged.
The capture script collects PNGs in the browser frame that draws each stage, then saves them after completion.
It also records video and checks all four skip inputs.

## Acceptance evidence

All commands run from `/home/cp/code/tinyking-intro2` on `intro2`.
The resumed run kept the existing changes and their failing-test evidence.
At resume, `git log origin/main..HEAD` was empty and HEAD was `72cbd52` (`Add the arrival opening`).
No other branch was inspected or merged.
The brief's final boundary forbids the whole suite, so the AFFECTED gate takes precedence over its earlier whole-suite request.
No whole-suite command ran.
This JavaScript project has no separate typecheck. Webpack compiles JS and JSX and runs ESLint.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --maxWorkers=2 --findRelatedTests src/game/intro.js src/game/map.js src/game/world_terrain.js src/render/camera.js src/render/models.js src/render/world_view.js src/components/world.js test/intro.test.js test/intro_view.test.js test/arrival.test.js test/camera.test.js test/map.test.js
```

Literal tail from `shots/intro2-resumed-jest.log`:

```text
Test Suites: 26 passed, 26 total
Tests:       172 passed, 172 total
Snapshots:   0 total
Time:        51.213 s
Ran all test suites related to files matching src/game/intro.js|src/game/map.js|src/game/world_terrain.js|src/render/camera.js|src/render/models.js|src/render/world_view.js|src/components/world.js|test/intro.test.js|test/intro_view.test.js|test/arrival.test.js|test/camera.test.js|test/map.test.js.
```

Build command: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`.
Literal tail from `shots/intro2-resumed-build.log`:

```text
WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/

webpack 5.112.2 compiled with 3 warnings in 50886 ms
```

The three warnings concern asset size, entrypoint size and code splitting.

ESLint passed with no output for all seven changed source files and all six changed scripts.
Its resumed log is `shots/intro2-resumed-eslint.log`.
The later playtest-script edit also passed ESLint in `shots/intro2-resumed-playtest-eslint.log`.
The red-run logs are `shots/intro2-red.log`, `shots/intro2-facing-red.log` and `shots/intro2-tree-red.log`.

## Browser captures

The server used `npx webpack serve --config webpack.dev.js --no-open --port 8105`.
Chromium used the supplied executable with `--use-gl=swiftshader --use-angle=swiftshader --enable-unsafe-swiftshader`.
The phone context set `isMobile: true` and `hasTouch: true`.
The script passed all four skip methods: click, touch, Escape and URL.

Run `node scripts/intro-shots.js http://localhost:8105/` to reproduce the captures and skip checks.
The script requires an ffmpeg build with H.264 encoding for MP4 output.
The cached Playwright ffmpeg only offered PNG and VP9 encoders, so this run used the installed `ffmpeg` for H.264 conversion.
Both MP4 files report the requested dimensions and H.264 video.

All paths below are under `/home/cp/code/tinyking-intro2/shots/` and are gitignored.
All sixteen PNGs were viewed at their viewport sizes.
They show the empty clearing, carried bundle, bundle drop, fire setup, bedroll setup and standing character.
The camera holds the entry edge and future camp throughout, including on the phone.
The control captures show the normal game after handover.

| Evidence | Desktop 1440×900 | Phone 390×664 |
| --- | --- | --- |
| Outside edge | `intro-desktop-edge.png` | `intro-phone-edge.png` |
| Walking | `intro-desktop-walking.png` | `intro-phone-walking.png` |
| Lowering bundle | `intro-desktop-lowering.png` | `intro-phone-lowering.png` |
| Bundle down | `intro-desktop-put-down.png` | `intro-phone-put-down.png` |
| Fire appearing | `intro-desktop-fire.png` | `intro-phone-fire.png` |
| Bedroll appearing | `intro-desktop-bedroll.png` | `intro-phone-bedroll.png` |
| Standing at completed setup | `intro-desktop-standing.png` | `intro-phone-standing.png` |
| Control restored | `intro-desktop-control.png` | `intro-phone-control.png` |
| MP4 | `intro-desktop.mp4` | `intro-phone.mp4` |
| Original video | `intro-desktop.webm` | `intro-phone.webm` |
| Frame metadata | `intro-desktop.json` | `intro-phone.json` |

The resumed recording took 5.3095 seconds to hand over on desktop and 5.2046 seconds on the phone.
Every opening frame had zero camp entities, and completion had a usable camp and standing character.
Full capture and skip results are in `shots/intro2-resumed-captures-final.log`.
All four skip methods passed. All sixteen final PNGs were viewed, and `ffprobe` confirmed both MP4 dimensions and H.264 video.

## Wider playability check

`node scripts/arrival-check.js` passed all 40 numeric and text seeds on the final map code.
Each seed has no initial camp, a two-link approach, walkable grassland, a reachable nearby village, reachable wood and reachable forage.
The player survived ten days and ate nine meals.
A repeat produced the same complete ECS hash.
Without food, the player reached Starving after three days.

Literal tail from `shots/intro2-arrival-check.log`:

```text
{"seed":13,"days":10,"eat":true,"meals":9,"hunger":1.583333333333334,"starving":false,"hash":"bd2bcfc58f5ceb8c8e0108d9035435e8fdceddfcb7b35f537f3f671dea87ad0a"}
{"seed":13,"days":10,"eat":true,"meals":9,"hunger":1.583333333333334,"starving":false,"hash":"bd2bcfc58f5ceb8c8e0108d9035435e8fdceddfcb7b35f537f3f671dea87ad0a"}
{"seed":13,"days":3,"eat":false,"meals":0,"hunger":3.437354799089334,"starving":true,"hash":"247b738d4ba473a8893e8361494f061dcf4187181ed1fe55b9e793ec7fbe916e"}
PASS 40 seeds; ten-day forage survival; starvation without food; deterministic full ECS replay
```

## Three consecutive browser playtests

The final series ran `npm run playtest -- http://localhost:8105/` three times in sequence, with no intervening source or build changes.
Every run exited 0 and passed all 17 checks, including the updated opening, real timber gathering, delivery and completed construction.
Every run reported zero console errors.

| Run | Passed | Failed | Opening seconds | Construction seconds | Construction game hours | Full literal output |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 17 | 0 | 5.1807 | 70.557 | 49 | `shots/intro2-final-playtest-1.log` |
| 2 | 17 | 0 | 5.2041 | 173.543 | 33 | `shots/intro2-final-playtest-2.log` |
| 3 | 17 | 0 | 5.2543 | 197.792 | 56 | `shots/intro2-final-playtest-3.log` |

The first resumed series passed twice, then hit the old 120-second construction timeout.
The final series used the documented 240-second wait and the same actual completion assertion.
The 4–6-second opening bound remained unchanged.
No materials were injected, and no simulation or task-queue source changed to obtain these passes.
Machine-readable results are in `shots/intro2-final-playtest-results.json`.

Literal tails, in run order:

```text
PASS logs are delivered and a lean-to finishes - {"seconds":70.557,"gameHours":49}
PASS the view follows a window resize - {"width":960,"height":640}
PASS no console errors - []

PASS logs are delivered and a lean-to finishes - {"seconds":173.543,"gameHours":33}
PASS the view follows a window resize - {"width":960,"height":640}
PASS no console errors - []

PASS logs are delivered and a lean-to finishes - {"seconds":197.792,"gameHours":56}
PASS the view follows a window resize - {"width":960,"height":640}
PASS no console errors - []
```

## Server cleanup and delivery

The resumed run started its own server with `npx webpack serve --config webpack.dev.js --no-open --port 8105`.
Its working directory was `/home/cp/code/tinyking-intro2`, and its webpack PID was `3797406`.
After all recordings and skip checks passed, `kill -TERM 3797406` stopped it.
`ss` then showed no listener on port 8105.
The before-and-after output is in `shots/intro2-resumed-server-stop.log`.
Port 8080 was not used.

The changes stay on branch `intro2`; no push was made.
The commit message ends with the requested Claude session URL and has no Co-Authored-By trailer.
