# Food, hunger and woodland regrowth

Grain is edible as porridge. One stored grain portion makes one full meal;
there is no stove or crafting prerequisite. This uses the existing pickup,
hauling and eating tasks, rather than completing the unfinished workshop chain.
Gruel remains edible too. A full meal takes one game hour and resets hunger to
zero, including the starving flag.

The food chain is sow → grow for 4.5 growing days → harvest six grain per slot →
haul loose grain to a household container or stockpile → fetch a portion → eat.
Sowing consumes one grain per slot. Only sown slots grow; harvested slots cannot
produce again until replanted. Crops, wild food and trees pause in winter, and
crop progress displays that pause.

The planner first looks for held food, then loose or stored food, then reachable
wild food. Existing sleep, work and hauling priorities remain in place. Berries
and roots supply the same `forage` good: one meal per plant, taking half an hour
of work to gather. Hungry people gather and eat automatically. The player can
also order **Forage** on a full plant, then carry the portion home using the
usual storage plan. Picking is checked again when the work completes so two
people cannot take the same portion. Wild food is public; stored food continues
to follow the existing controller permissions.

## Hunger

Hunger counts game days since a full meal. Thresholds are strict.

| Hunger | Stage | Walking and work speed |
|---|---|---|
| ≤ 0.9 | Fed | 100% |
| > 0.9 | Hungry | 80% |
| > 2.5 | Starving | 60% |
| > 6 | Dead | No planning or work |

`personable.starving` is available for relationship rules. Starvation sets the
existing `dead` flag, releases jobs, field claims and captured attention, and
redraws the person lying down. Dead people no longer accumulate needs. Meals
clear starvation immediately. The selected-person panel shows the current stage.

## Biome rates

Density is expected forage plants per grassland tile; berries is their share,
with roots making up the remainder. Each depleted plant replaces one meal after
the listed number of growing days. No wild food can be gathered in winter.
At least three plants are placed within three reachable tiles of the start,
including desert starts.

| Biome | Forage density | Berries | Meal regrowth, growing days | Sapling attempts per mature tree per growing day |
|---|---:|---:|---:|---:|
| Jungle | 1.50 | 80% | 2.5 | 0.500 |
| Taiga | 0.70 | 70% | 3 | 0.200 |
| Grassland | 0.90 | 65% | 3 | 0.200 |
| Marsh | 1.10 | 40% | 2.5 | 0.200 |
| Savanna | 0.45 | 30% | 4 | 0.070 |
| Steppe | 0.35 | 15% | 4 | 0.070 |
| Snowfield | 0.20 | 10% | 5 | 0.025 |
| Tundra | 0.25 | 20% | 5 | 0.025 |
| Desert | 0.12 | 0% | 6 | 0.003 |

Tree density caps are each biome's original generated tree count on that map.
Cutting frees capacity. New saplings appear 30–90 world units from mature trees,
including across tile edges, with 18 units of clearance from other vegetation.
Houses, fields and stockpiles block new trees. A completely cleared wood cannot
seed itself.

Saplings become young after three growing days and mature after six. They draw
at 25%, 55% and 100% of mature size, sharing instanced geometry. Saplings give no
logs, young trees give one, and new mature trees give their full two or three.
Original mature trees retain their generated log amounts. Picked forage draws as
bare stems, also using the existing instancing.

Each hourly vegetation update visits plants and trees once. Seeding checks only
the candidate tile and its six neighbours. On seed 20, with 1,519 tiles and 6,422
trees, 1,200 updates averaged 0.414 ms at full density and 1.836 ms after felling
500 trees; density stayed below the original cap.

## Verification, 29 October 2026

All production changes were driven by failing focused Jest tests. No pre-existing
tests were edited or deleted. Added suites: `survival`, `ecology`,
`vegetation_view`, `selected_person` and `farm_progress`.

The later instruction in the brief forbids the whole suite. The affected gate
used `--findRelatedTests` on the changed source files and the five new suites,
under `/tmp/27agents-gate.lock`. There is no TypeScript gate; the build compiles
JavaScript and JSX and runs ESLint. A separate ESLint pass also succeeded.

Final Jest summary (full literal output in `shots/jest-final.log`):

```text
Test Suites: 17 passed, 17 total
Tests:       98 passed, 98 total
Snapshots:   0 total
Time:        7.961 s, estimated 9 s
```

Build command: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`.
Literal build tail, from `shots/build-final.log`:

```text
WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/

webpack 5.112.2 compiled with 3 warnings in 23254 ms
```

The three warnings concern asset size, entrypoint size and code splitting.

`npm run survival-check -- 20 1234 98765 1 2 53 84 --determinism` runs the real
planner and simulation without a browser, for two game years without orders.
It asserts at least 75% survival, actual meals and finite hunger, then repeats
seed 20 and compares the complete final ECS hash.

| Seed | Biome | Survivors | Meals | Winter meals | Maximum hunger | Seconds |
|---|---|---:|---:|---:|---:|---:|
| 20 | Jungle | 87/87 | 2,095 | 513 | 2.792 | 36.77 |
| 1234 | Jungle | 54/54 | 1,308 | 322 | 1.708 | 19.31 |
| 98765 | Marsh | 88/88 | 2,036 | 507 | 1.849 | 30.56 |
| 1 | Grassland | 70/70 | 1,590 | 399 | 1.750 | 23.13 |
| 2 | Desert | 75/75 | 1,629 | 418 | 2.042 | 23.58 |
| 53 | Taiga | 62/62 | 1,327 | 333 | 3.292 | 25.39 |
| 84 | Tundra | 80/80 | 1,718 | 438 | 2.000 | 34.06 |

All 516 survived. The seven runs took 192.8 seconds, plus the seed-20 replay.
The replay's full ECS hash matched. Winter consumed stored food on every seed;
for example seed 20 went from 1,701 to 1,438 portions in its first winter and
611 to 343 in its second. A separate food-deprived winter test reaches Starving
and recovers from spring forage. The generated maps have no automatic fields;
these unattended runs use the existing starting stores and wild plants. The
harvest-to-storage path and complete winter pause are checked separately.

The food-only baseline, run before adding consequences, also survived two years:
87/87 on seed 20, 54/54 on 1234, and 88/88 on 98765. Logs are in
`shots/food-baseline.log`.

The server command was:

```sh
npx webpack serve --config webpack.dev.js --no-open --port 8098
```

Three consecutive final runs of `npm run playtest -- http://localhost:8098/`
passed all 12 checks each. Full logs: `shots/playtest-1.log`,
`shots/playtest-2.log`, `shots/playtest-3.log`. Earlier attempts interrupted by
source/build reloads were repeated after those writes stopped. The server was
stopped with `kill -TERM 3414064`; `ss` confirmed port 8098 was free afterwards.
Port 8080 was not used.

The screenshots use Chromium with SwiftShader and waits of at least eight
seconds. `node scripts/survival-shots.js http://localhost:8098/` reproduces them
from real simulation snapshots. The screenshot fixtures empty the player's
stores to force foraging and fell a patch to demonstrate tree regrowth. All were
visually inspected:

- `shots/person-foraging.png`
- `shots/bush-before-picking.png`
- `shots/bush-after-picking.png`
- `shots/selected-person-hungry.png`
- `shots/wood-edge-sapling.png`
- `shots/wood-edge-young.png`
- `shots/wood-edge-mature.png`

The before-picking capture moves the observer home using the walking task, so
the full bush is visible. The three woodland captures show the same sapling at
birth, after three growing days, and after six.
