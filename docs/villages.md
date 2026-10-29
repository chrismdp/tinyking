# Village life

Every generated village household farms one or two fields. Each field uses the
existing 19 crop slots, permissions, ploughing, sowing, harvesting and hauling.
Spring, summer and autumn crops start with 1.5–3.5 growing days of progress;
winter starts with dormant sown grain. Trades, animal pens and gardens do not
produce grain or food. They establish places and routines for later gameplay.

Households have one or two different backyard features: a kitchen garden,
chicken coop, pig pen, goat pen or beehives. Villages also have a fenced sheep
or cow pasture where nearby reachable grassland is available. Animals follow
slow seeded paths inside the fence, with clearance for their bodies. Time must
advance for them to move.

The household's adult trade holder works between 8am and 5pm, after needs,
player jobs and available farm work. The planner walks to the workplace, shows
an activity label and works in half-hour periods. Hunger and tiredness keep
their existing priority. Forges and ovens smoke only during actual work. Trade
holders sway slightly as they work. Workshops stand behind the worker so the
person is visible.

Village size determines trade count:

| Houses | Distinct trades |
| --- | ---: |
| 3 | 1 |
| 4 | 2 |
| 5 | 3 |
| 6 | 4 |
| 7 | 5 |
| 8 | 6 |

The six trades are smith, carpenter, weaver, baker, tanner and miller. Their
buildings are a forge and anvil, workbench and timber pile, loom, oven, drying
racks and windmill. The ordered list rotates between villages, so small
villages have different trades. There is at most one of each per village.

Every village has a well and green. From five houses it also has a chapel and
alehouse. Between 6pm and 9pm, the existing idle/meeting search picks a point
on that villager's own green or outside its alehouse. The seeded choice varies
the venue each day. Reserved gathering points spread visitors across clear
grassland around each place. Points have 34 units of separation and leave
houses, fields, workshops and animal pens clear. Meals and sleep still take
precedence.

Generation preserves timber within four tiles of the player's start. Fields,
yards, shared places and pasture reserve grassland, clear their trees and keep
wild plants and new woodland out. Placement follows the navigation graph and
leaves the start's own ring untouched.

## ECS records

Ids are strings. The usual component `id` field is present.

| Record | Fields |
| --- | --- |
| `household[personId]` | Existing `{ houseId }` membership |
| `household[houseId]` | `{ farming, fields: id[], backyards: id[], storeId, plot: { hexes: string[] }, trade?, workplaceId? }` |
| `farmable[fieldId]` | Existing slots and claimer, plus `houseId` |
| `backyard[id]` | `{ houseId, kind }` |
| `profession[personId]` | `{ houseId, trade, workplaceId }`; copied into the planner's world |
| `workplace[id]` | `{ houseId, trade, power }`; mills use wind |
| `pasture[id]` | `{ houseId, kind, centre: {x,y}, halfWidth, halfDepth }`; also on backyard pens |
| `animal[id]` | `{ houseId, pastureId, kind, phase, radius, facing }`, with moving `spatial` |
| `meetingPlace[id]` | `{ kind: 'well' \| 'green' \| 'chapel' \| 'alehouse', gatheringPoints?: {x,y}[] }` |
| `village[id]` | Existing village membership, also on new features and animals |
| `mappable[tileId].villagePlot` | Reserved village ground, protected from vegetation |
| `state.villages[villageId].sharedPlaces` | Array of shared-place entity ids |

A house's household record intentionally has no `houseId`: membership queries
continue to count people, and every member points to that house's record. Field
and workshop controllers follow the existing family head. Harvest is owned and
stored through those same permissions in the household's existing room store.

## Rendering

Props share cached coloured geometry. Crops across fields, fence posts and
rails, animals of each species, and repeated household/shared features use
instance batches. Field soil and furrows merge into one mesh per field. Static
batches upload only after a redraw or discovery change; animal groups update
as their positions change. Picking retains entity ids for each instance.
Fences follow the terrain. Crop height reads actual growing progress, so it
also pauses visually in winter.

## Acceptance evidence

The final instruction in the brief forbids a full-suite run, overriding the
earlier request for bare `npx jest`. The affected gate uses Jest's import graph
with `--findRelatedTests`, an explicit source list and the four new test files,
under `/tmp/27agents-gate.lock`. This JavaScript repository has no separate
typecheck; webpack compiles JavaScript/JSX and runs ESLint.

No Jest assertions from `origin/main` were changed or deleted. Added `villages.test.js`,
`village_view.test.js`, `village_hauling.test.js` and `village_camera.test.js`.
Each suite first failed before its production changes.
The hauling suite covers a stale loose-grain target taken by another family member,
which sustained family harvesting exposed. Missing walking targets now clear
that cache and allow the planner to find another portion.
The village suite also gained a failing test after visual inspection exposed
crowded evening visitors. It requires room for their bodies and keeps them
outside houses and pens. Gathering points are allocated after household plots,
so shared clearings do not take land needed by farms or backyards.

The existing browser script had a reset using Node's `URL` constructor as a
string (`URL.includes`). The real playtest failed there. Its reset now uses the
already-constructed `playURL.href`; every original check remains.
Menu discovery now uses the script's existing ten-second wait. A diagnostic
capture showed the requested button after the former 1.2-second deadline.
Field and stockpile checks now count entities on their ordered tiles. Generated
household fields must not satisfy the player's Create Field assertion.
The second shelter check allows 180 seconds instead of 120. A saved-state replay
completed that shelter six game hours after the original deadline. Meals,
sleep and existing farm work still run while that check waits. The assertion
still requires delivered logs and a finished lean-to.

Reproduction scripts: `scripts/village-shots.js` runs the real planner to collect
work and evening snapshots; `scripts/village-performance.js` measures actual
WebGL draw calls and triangles. Screenshots reveal the map for inspection and
pause the simulation at those snapshots. They do not move or assign villagers.
The crop snapshot requires two family members working their own fields.
The evening snapshot selects idle visitors after their meals. Desktop captures
use 1440×900, and the phone uses 390×664 with touch and mobile emulation.

The affected gate command was:

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand --findRelatedTests src/game/villages.js src/game/map.js src/game/ecology.js src/game/tasks.js src/game/compound.js src/game/primitive.js src/game/simulation.js src/render/villages.js src/render/instances.js src/render/models.js src/render/world_view.js src/data/messages.json test/villages.test.js test/village_view.test.js test/village_hauling.test.js test/village_camera.test.js
```

The literal tail in `shots/jest-final.log` was:

```text
Test Suites: 28 passed, 28 total
Tests:       189 passed, 189 total
Snapshots:   0 total
Time:        214.376 s
Ran all test suites related to files matching src/game/villages.js|src/game/map.js|src/game/ecology.js|src/game/tasks.js|src/game/compound.js|src/game/primitive.js|src/game/simulation.js|src/render/villages.js|src/render/instances.js|src/render/models.js|src/render/world_view.js|src/data/messages.json|test/villages.test.js|test/village_view.test.js|test/village_hauling.test.js|test/village_camera.test.js.
```

The build command was:

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

The literal tail in `shots/build-final.log` was:

```text
WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/

webpack 5.112.2 compiled with 3 warnings in 30447 ms
```

The three warnings concern asset size, entrypoint size and code splitting.
Separate ESLint passes passed. Generation of seeds 0–99 completed without
errors, and every household received at least one field.
The probe output is in `shots/generation-probe.log`.

The survival command was:

```sh
node scripts/survival-check.js 20 1234 98765 --determinism
```

It runs the real planner for two years without player orders. It asserts at
least 75% survival, actual meals and finite hunger. All three seeds passed.

| Seed | Biome | Survivors | Meals | Winter meals | Maximum hunger | Seconds |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 20 | Jungle | 147/148 | 3,388 | 848 | 6.042 | 98.38 |
| 1234 | Jungle | 182/182 | 4,087 | 999 | 4.458 | 106.74 |
| 98765 | Marsh | 148/148 | 3,408 | 846 | 3.958 | 100.46 |

Overall, 477 of 478 people survived. Seed 20 had one starvation death.
The seed-20 replay matched the complete final ECS, the entity-component state.
Its SHA-256 hash was
`5396325982063371d9986680f9af87b28d1743938894bdbdc6138980246ad2b2`.
The command finished with:

```text
PASS identical two-year ECS for repeated seed 20
```

The full output is in `shots/survival-final.log`. Raw JSON records and totals
are also in `shots/survival-summary.json`.
The final direct invocation exited with status 0. An earlier npm wrapper returned
a termination status after printing all assertions. The direct invocation runs
the same script and confirmed identical results.

The performance comparison uses seed 20, the radius-22 map with 1,519 tiles,
and a 1440×900 viewport. Both runs pause at the same time and use the same
camera movements. The script counts actual WebGL draw calls and triangles.
The baseline source matches all 74 `src/` files in `origin/main`, commit
`d31c3fe222ca007e6a93a7c713dc1531cf5830dc`.

| Camera | Draw calls before | Draw calls after | Triangles before | Triangles after |
| --- | ---: | ---: | ---: | ---: |
| Whole large map | 379 | 483 | 114,288 | 168,030 |
| Village | 87 | 130 | 816,296 | 750,282 |

The after map has 55 houses, 148 people, 81 fields, 181 animals and 33 workplaces.
Whole-map draw calls rise by 27.4%. Village triangles fall by 8.1% because village
clearings remove nearby trees. The added instances still contribute triangles
at the distant whole-map view. These are rendering counts, not a frame-rate benchmark.

Commands and raw records:

```sh
node scripts/village-performance.js --baseline
node scripts/village-performance.js
```

```json
{"seed":20,"viewport":"1440x900","wholeMap":{"calls":379,"triangles":114288},"village":{"calls":87,"triangles":816296},"entities":{"mappable":1519,"personable":148,"building":55,"farmable":0,"animal":0,"workplace":0}}
{"seed":20,"viewport":"1440x900","wholeMap":{"calls":483,"triangles":168030},"village":{"calls":130,"triangles":750282},"entities":{"mappable":1519,"personable":148,"building":55,"farmable":81,"animal":181,"workplace":33}}
```

The records are in `shots/performance-before.json` and `shots/performance-after.json`.
`shots/baseline-verification.log` records the baseline source comparison.

All six final screenshots were visually inspected. The village captures use
the default camera distance of 1,000 units and pitch of 0.8 radians. Close-ups
use the same pitch. The field capture shows two family members working their
fields, and the evening capture contains 14 idle visitors at their own green.
The pasture capture uses a real flock with no person obscuring the animals.
The final captures show no animal bodies crossing fences or visible z-fighting.

| Capture | Path | Size |
| --- | --- | --- |
| Whole village | `shots/village-default.png` | 1440×900 |
| Smith at the forge | `shots/smith-forge.png` | 1440×900 |
| Family fields | `shots/family-fields.png` | 1440×900 |
| Pasture | `shots/animals-pasture.png` | 1440×900 |
| Evening green | `shots/green-evening.png` | 1440×900 |
| Phone village | `shots/village-phone.png` | 390×664 |

The phone context sets both `isMobile: true` and `hasTouch: true`.
`shots/village-shots.log` records the entity ids, two active family workers,
14 idle visitors and an empty browser-error list.

The development server command was:

```sh
npx webpack serve --config webpack.dev.js --no-open --port 8106
```

Three consecutive final invocations used:

```sh
npm run playtest -- http://localhost:8106/?intro=skip
```

Each invocation exited with status 0 and passed all 18 checks. All three used
the same implementation and browser checks. Their literal output follows.

Run 1, from `shots/playtest-1.log`:

```text
> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8106/?intro=skip

PASS the arrival plays, holds time and control, then sits at camp with the bundle placed - {"seconds":10.378400000095366,"walked":true,"nearCamp":true,"sitting":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS fresh build-first queue waits, chops explicitly ordered wood, and finishes the lean-to
PASS clicking a villager selects it - {"selected":"1900"}
PASS clicking a tile opens its job menu, and Move here queues a job - {"target":"785"}
PASS a task appears in the task panel
PASS Recruit can be ordered on another realm's villager - {"recruit":"1762"}
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"741","stockpileTile":"786","tree":"1644"}
PASS a villager walks to the ordered tile - {"walker":"1900","from":125,"to":0}
PASS the completed task leaves the panel
PASS villagers move about - {"moved":117,"of":139,"gameHours":28}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 39 49 54
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"recruited":true,"recruitWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"recruited":true,"recruitWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes
PASS the view follows a window resize - {"width":960,"height":640}
PASS no console errors - []
```

Run 2, from `shots/playtest-2.log`:

```text
> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8106/?intro=skip

PASS the arrival plays, holds time and control, then sits at camp with the bundle placed - {"seconds":10.362299999952315,"walked":true,"nearCamp":true,"sitting":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS fresh build-first queue waits, chops explicitly ordered wood, and finishes the lean-to
PASS clicking a villager selects it - {"selected":"1900"}
PASS clicking a tile opens its job menu, and Move here queues a job - {"target":"740"}
PASS a task appears in the task panel
PASS Recruit can be ordered on another realm's villager - {"recruit":"1762"}
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"741","stockpileTile":"786","tree":"1644"}
PASS a villager walks to the ordered tile - {"walker":"1900","from":139,"to":7}
PASS the completed task leaves the panel
PASS villagers move about - {"moved":115,"of":139,"gameHours":29}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 49 54
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"recruited":true,"recruitWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"recruited":true,"recruitWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes
PASS the view follows a window resize - {"width":960,"height":640}
PASS no console errors - []
```

Run 3, from `shots/playtest-3.log`:

```text
> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8106/?intro=skip

PASS the arrival plays, holds time and control, then sits at camp with the bundle placed - {"seconds":10.588700000047682,"walked":true,"nearCamp":true,"sitting":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS fresh build-first queue waits, chops explicitly ordered wood, and finishes the lean-to
PASS clicking a villager selects it - {"selected":"1900"}
PASS clicking a tile opens its job menu, and Move here queues a job - {"target":"740"}
PASS a task appears in the task panel
PASS Recruit can be ordered on another realm's villager - {"recruit":"1762"}
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"741","stockpileTile":"786","tree":"1644"}
PASS a villager walks to the ordered tile - {"walker":"1900","from":139,"to":7}
PASS the completed task leaves the panel
PASS villagers move about - {"moved":111,"of":139,"gameHours":26}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 49 54
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"recruited":true,"recruitWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"recruited":true,"recruitWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes
PASS the view follows a window resize - {"width":960,"height":640}
PASS no console errors - []
```

The server was stopped with `kill -TERM 3794136`. The subsequent `ss`
output in `shots/port-8106-after.log` confirms that port 8106 is free.
Port 8080 was not used.
