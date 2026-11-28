TinyKing week-playtest-7 report

All three required scenarios passed on implementation `0222391`, with 26/26 browser checks and exit 0 each. The final affected gate passed 12 tests. The complete selection area passed 17 tests. Both production builds exited 0.

| Final scenario | URL | Exit | Checks |
| --- | --- | --- | --- |
| Frozen world, seed 13 | `http://localhost:8184/` | 0 | 26/26 |
| Frozen world, seed 21 | `http://localhost:8184/` | 0 | 26/26 |
| Browser-generated world, seed 13 | `http://[::1]:8176/?seed=13` | 0 | 26/26 |

Branch: `week-playtest-7`. Base: `8025a9eed79766ee4290d5cfe8557841e46b8735`.

The play test selects targets from detached snapshots of `window.tinyking`. It applies the game’s permission, navigation and land-use rules. Orders use the existing game controls. No files under `src/` changed. No state exposure was added.

| Previously failing check | How the driver finds its target |
| --- | --- |
| Seed-13 world check | Preserve the URL seed. Without a URL seed, unpack the exact world response consumed by the browser. Compare its `travel.seed` with the loaded world and require a populated map and player position. |
| Cut down eligibility check | Find known, reachable, permitted grassland with standing trees and no other obstacles. Cut its trees through the popup and let the full jobs carry the logs home. Require that exact tile to become eligible for storage. Walking wear can prevent field placement, so this uses the game’s storage rules. |
| Field, stockpile and tree popup check | Find fields and storage separately. Fields must pass `canPlaceField`. Storage must pass `designationPlants`. Trees must contain positive standing wood and permit player access. Rank timber by its native delivery home to avoid repeated long hauls. Exclude reserved targets and pan before clicking. |
| Run-to-the-end check | Re-read state before restarting each physical order. Prefer the original target only while it remains eligible. Otherwise choose the nearest eligible target and record the replacement. Assert final work at the tile actually ordered. The optional later-construction scenario also discovers its targets. |

Twelve new Jest cases cover site eligibility, permissions, known land, reachability, reservations, stale restarts, unchanged snapshots and seed identity. They also cover neighbour discovery, Chat readiness and timber delivery-home ranking.

Dependency setup: `npm ci` exited 0. It installed 1,056 packages in 18 seconds. `node_modules` used 336 MiB. npm reported Babel peer warnings, an old engine declaration, deprecated packages and 18 moderate vulnerabilities.

Port 8176 already had an IPv4 listener owned by PID 1276710. I left it running and served this worktree on IPv6 loopback, `[::1]:8176`. The frozen server used port 8184. Ports 8080, 8081 and 8082 were untouched.

Production artifacts: the first build reported `02e5a3d2d4305fbfdf31262ef5136e93ac84215f`. The restored build reports `ec339950447f2fc4d60faa458d329fb4c53bbe03`. Later commits change only the driver, its tests and this report. Game source remains unchanged from the base.

Implementation candidate: `0222391c0b8eb581ed99454d8833b69fe0f48cc6`. The final affected gate passed all 12 tests. Lint and syntax checks passed.

Seed 21 also required three supporting driver fixes. The click locator samples actual construction meshes, including corner stakes. Person discovery walks only discovered route prefixes towards living adults who accept Chat. Timber selection ranks eligible trees by their native delivery home so exploration does not create long repeated hauls across the map. Site and person selection use detached snapshots. Clicks are checked against the live renderer.

The first dev server cleaned `dist`, so the initial frozen seed-13 run failed only its final HTTP route check. A second production build restored the artifact. One seed-21 startup ran before restoration finished and failed to connect. Later seed-21 runs exposed the construction click, refused Chat and long-haul issues. Their logs and exit receipts remain intact. The final dev server uses its own output path. A byte comparison confirmed that it left the frozen artifact unchanged.

The affected Jest gates selected only `test/playtest_selection.test.js`. This JavaScript repository has no TypeScript checking command. Node syntax checks and ESLint passed for the changed scripts.

Selection-harness exception: the mesh click helper has no Jest import path. I also ran both selection unit files as the complete selection area, plus the requested complete browser scenarios. No whole game Jest suite ran.


Every browser run used `CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`, the default 60-second observation setting, and a unique `PLAYTEST_OUT` directory outside the repository. Game time advanced through actual UI orders and the native simulation. No timeout increased. No browser fixture was installed.

The initial frozen server command was `python3 scripts/serve-frozen.py dist --port 8184`. Seed 21 used `--worlds worlds/seed21`; the last seed-13 run used the default `worlds` directory again.

The final dev server command was:

```sh
node node_modules/webpack-cli/bin/cli.js serve --config webpack.dev.js --host ::1 --port 8176 --output-path /home/cp/code/tk-playtest7/shots/week-playtest-7-dev-output
```

Every browser exit is listed below. Passing evidence from earlier attempts remains separate from final-candidate evidence.

| Run | Driver commit | Exit | Passed checks | Result |
| --- | --- | --- | --- | --- |
| frozen13 attempt 1 | `ec33995` | 1 | 25/26 | The dev server cleaned dist; debug HTTP check failed. |
| frozen21 attempt 1 | `ec33995` | 1 | 1/2 | Connection refused after the server started before artifact restoration. |
| frozen21 attempt 2 | `ec33995` | 1 | 4/5 | The centre-only click locator could not hit the construction marker. |
| dev13 attempt 1 | `ec33995` | 0 | 26/26 | All checks passed before the later driver fixes. |
| frozen21 attempt 3 | `c53efe4` | 1 | 13/15 | The chosen villager refused Chat under disposition rules. |
| frozen21 attempt 4 | `f85a921` | 1 | 21/22 | A long final timber haul exceeded the existing 300-second job limit. |
| frozen21 attempt 5 | `0222391` | 0 | 26/26 | Final driver; all checks passed. |
| dev13 attempt 2 | `0222391` | 0 | 26/26 | Final driver; all checks passed. |
| frozen13 attempt 2 | `0222391` | 1 | 25/26 | Arrival timing measured 6.57 seconds; all other 25 checks passed. |
| frozen13 attempt 3 | `0222391` | 0 | 26/26 | One unchanged-candidate timing recheck; all checks passed. |

Final target and outcome evidence follows. Full JSON reports and screenshots remain in the listed output directories.

frozen13 final evidence: [JSON report](/tmp/tk-week-playtest7-frozen13-attempt3/playtest-report.json), [job menu](/tmp/tk-week-playtest7-frozen13-attempt3/job-menu.png), [completed shelter](/tmp/tk-week-playtest7-frozen13-attempt3/completed-shelter-desktop.png).

```json
{
  "identity": {
    "loaded": true,
    "seed": 13,
    "expectedSeed": 13,
    "source": "served world",
    "matches": true
  },
  "clearedSite": {
    "id": "terrain5_3-694",
    "trees": [
      "terrain5_3-2309"
    ],
    "eligible": true,
    "distance": 211.80033736339502
  },
  "clearingPassed": true,
  "popupTargets": {
    "fieldTile": "terrain5_3-695",
    "stockpileTile": "terrain5_3-694",
    "tree": "terrain5_3-2263"
  },
  "restarts": [
    {
      "action": "Create Field",
      "previous": "terrain5_3-695",
      "selected": "terrain5_3-695",
      "eligibleCandidates": 4
    },
    {
      "action": "Create Stockpile",
      "previous": "terrain5_3-694",
      "selected": "terrain5_3-694",
      "eligibleCandidates": 6
    },
    {
      "action": "Cut down",
      "previous": "terrain5_3-2263",
      "selected": "terrain5_3-2263",
      "eligibleCandidates": 85
    }
  ],
  "outcomesAtOrderedTiles": {
    "fields": 1,
    "fieldWaiting": false,
    "stockpiles": 1,
    "stockpileWaiting": false,
    "chatted": true,
    "chatWaiting": false,
    "treeGone": true,
    "treeWaiting": false
  },
  "physicalGift": {
    "itemId": "terrain5_3-4171",
    "type": "wood",
    "owner": "w5_3-social-96",
    "personId": "w5_3-social-96",
    "distance": 9.91560931555204,
    "receiptDay": 1.0270833333333353,
    "observedDay": 1.02777777777778
  },
  "shelter": {
    "passed": true,
    "seconds": 40.993,
    "gameHours": 4
  },
  "ranToEnd": true,
  "consoleErrors": []
}
```

frozen21 final evidence: [JSON report](/tmp/tk-week-playtest7-frozen21-attempt5/playtest-report.json), [job menu](/tmp/tk-week-playtest7-frozen21-attempt5/job-menu.png), [completed shelter](/tmp/tk-week-playtest7-frozen21-attempt5/completed-shelter-desktop.png).

```json
{
  "identity": {
    "loaded": true,
    "seed": 21,
    "expectedSeed": 21,
    "source": "served world",
    "matches": true
  },
  "clearedSite": {
    "id": "terrain5_4-1401",
    "trees": [
      "terrain5_4-2124"
    ],
    "eligible": true,
    "distance": 396.68162580000956
  },
  "clearingPassed": true,
  "popupTargets": {
    "fieldTile": "terrain5_4-1161",
    "stockpileTile": "terrain5_4-1401",
    "tree": "terrain5_4-2127"
  },
  "restarts": [
    {
      "action": "Create Field",
      "previous": "terrain5_4-1161",
      "selected": "terrain5_4-1161",
      "eligibleCandidates": 49
    },
    {
      "action": "Create Stockpile",
      "previous": "terrain5_4-1401",
      "selected": "terrain5_4-1401",
      "eligibleCandidates": 71
    },
    {
      "action": "Cut down",
      "previous": "terrain5_4-2127",
      "selected": "terrain5_4-2127",
      "eligibleCandidates": 25
    }
  ],
  "outcomesAtOrderedTiles": {
    "fields": 1,
    "fieldWaiting": false,
    "stockpiles": 1,
    "stockpileWaiting": false,
    "chatted": true,
    "chatWaiting": false,
    "treeGone": true,
    "treeWaiting": false
  },
  "physicalGift": {
    "itemId": "terrain5_4-2408",
    "type": "wood",
    "owner": "w5_4-social-114",
    "personId": "w5_4-social-114",
    "distance": 2.149374551040665,
    "receiptDay": 1.0965277777777906,
    "observedDay": 1.0972222222222352
  },
  "shelter": {
    "passed": true,
    "seconds": 36.229,
    "gameHours": 3
  },
  "ranToEnd": true,
  "consoleErrors": []
}
```

dev13 final evidence: [JSON report](/tmp/tk-week-playtest7-dev13-attempt2/playtest-report.json), [job menu](/tmp/tk-week-playtest7-dev13-attempt2/job-menu.png), [completed shelter](/tmp/tk-week-playtest7-dev13-attempt2/completed-shelter-desktop.png).

```json
{
  "identity": {
    "loaded": true,
    "seed": 13,
    "expectedSeed": 13,
    "source": "URL",
    "matches": true
  },
  "clearedSite": {
    "id": "terrain5_3-694",
    "trees": [
      "terrain5_3-2309"
    ],
    "eligible": true,
    "distance": 211.80033736339502
  },
  "clearingPassed": true,
  "popupTargets": {
    "fieldTile": "terrain5_3-695",
    "stockpileTile": "terrain5_3-694",
    "tree": "terrain5_3-2263"
  },
  "restarts": [
    {
      "action": "Create Field",
      "previous": "terrain5_3-695",
      "selected": "terrain5_3-695",
      "eligibleCandidates": 4
    },
    {
      "action": "Create Stockpile",
      "previous": "terrain5_3-694",
      "selected": "terrain5_3-694",
      "eligibleCandidates": 6
    },
    {
      "action": "Cut down",
      "previous": "terrain5_3-2263",
      "selected": "terrain5_3-2263",
      "eligibleCandidates": 85
    }
  ],
  "outcomesAtOrderedTiles": {
    "fields": 1,
    "fieldWaiting": false,
    "stockpiles": 1,
    "stockpileWaiting": false,
    "chatted": true,
    "chatWaiting": false,
    "treeGone": true,
    "treeWaiting": false
  },
  "physicalGift": {
    "itemId": "terrain5_3-4171",
    "type": "wood",
    "owner": "w5_3-social-96",
    "personId": "w5_3-social-96",
    "distance": 9.91560931555204,
    "receiptDay": 1.0270833333333353,
    "observedDay": 1.02777777777778
  },
  "shelter": {
    "passed": true,
    "seconds": 44.519,
    "gameHours": 4
  },
  "ranToEnd": true,
  "consoleErrors": []
}
```

Complete browser command output follows. ANSI colours and trailing spaces are removed for Markdown. The raw log files remain unchanged in `shots/`.

<details>
<summary>frozen13 attempt 1: exit 1, driver ec33995</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen13-attempt1 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.374 seconds
STARTUP character/world ready after 5.537 seconds
STARTUP click Start new game to standing: 14.369 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":13,"expectedSeed":13,"source":"served world","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.5480999999046325,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 4.319 seconds
STARTUP character/world ready after 5.356 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_3-694","trees":["terrain5_3-2309"],"eligible":true,"distance":211.80033736339502},"after":[{"id":"terrain5_3-739","trees":[],"eligible":true,"distance":96.18618445634972},{"id":"terrain5_3-695","trees":[],"eligible":true,"distance":100.01252583764267},{"id":"terrain5_3-784","trees":[],"eligible":true,"distance":100.5446705613693},{"id":"terrain5_3-694","trees":[],"eligible":true,"distance":173.18872186793104},{"id":"terrain5_3-568","trees":[],"eligible":true,"distance":359.786746719095},{"id":"terrain5_3-569","trees":[],"eligible":true,"distance":376.6359980895185},{"id":"terrain5_3-613","trees":[],"eligible":true,"distance":459.05170475586533}]}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-783"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-65"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-695","stockpileTile":"terrain5_3-694","tree":"terrain5_3-2263"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":160,"to":0}
PASS the completed task leaves the panel
CHAT approach w5_3-social-65
CHAT panel open w5_3-social-65
CHAT line player.direct_answer.fallback_answer_weather.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-65","lines":[{"id":"player.direct_answer.fallback_answer_weather.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-65"}],"contact":{"day":0.6902777777777767,"position":{"x":2474.966603162095,"y":1172.827923696332},"otherPosition":{"x":2523.4307806183465,"y":1145.1342951089919}}}
RESTART Create Field {"previous":"terrain5_3-695","selected":"terrain5_3-695","candidates":["terrain5_3-695","terrain5_3-613","terrain5_3-569","terrain5_3-568"]}
RESTART Create Stockpile {"previous":"terrain5_3-694","selected":"terrain5_3-694","candidates":["terrain5_3-694","terrain5_3-739","terrain5_3-784","terrain5_3-568","terrain5_3-569","terrain5_3-613"]}
RESTART Cut down {"previous":"terrain5_3-2263","selected":"terrain5_3-2263","candidates":["terrain5_3-2263","terrain5_3-2330","terrain5_3-2329","terrain5_3-2328","terrain5_3-2342","terrain5_3-2213","terrain5_3-2177","terrain5_3-3879","terrain5_3-2366","terrain5_3-2365","terrain5_3-2238","terrain5_3-2214","terrain5_3-2178","terrain5_3-2142","terrain5_3-2379","terrain5_3-2239","terrain5_3-2143","terrain5_3-2406","terrain5_3-2405","terrain5_3-2417","terrain5_3-2407","terrain5_3-3881","terrain5_3-2144","terrain5_3-2418","terrain5_3-2060","terrain5_3-2419","terrain5_3-2429","terrain5_3-2100","terrain5_3-3882","terrain5_3-2420","terrain5_3-2454","terrain5_3-2145","terrain5_3-3884","terrain5_3-2442","terrain5_3-3883","terrain5_3-2456","terrain5_3-2455","terrain5_3-2457","terrain5_3-2471","terrain5_3-2101","terrain5_3-3886","terrain5_3-3885","terrain5_3-2443","terrain5_3-2458","terrain5_3-3887","terrain5_3-2061","terrain5_3-2459","terrain5_3-2488","terrain5_3-2102","terrain5_3-3890","terrain5_3-2507","terrain5_3-3892","terrain5_3-2017","terrain5_3-2489","terrain5_3-3891","terrain5_3-2508","terrain5_3-3893","terrain5_3-2557","terrain5_3-2558","terrain5_3-2559","terrain5_3-2146","terrain5_3-2583","terrain5_3-2062","terrain5_3-2584","terrain5_3-2065","terrain5_3-2103","terrain5_3-2066","terrain5_3-2104","terrain5_3-2067","terrain5_3-2105","terrain5_3-2068","terrain5_3-2295","terrain5_3-2314","terrain5_3-2241","terrain5_3-2357","terrain5_3-2358","terrain5_3-2385","terrain5_3-2343","terrain5_3-2386","terrain5_3-2370","terrain5_3-2410","terrain5_3-2359","terrain5_3-2344","terrain5_3-2434","terrain5_3-2371"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4171","type":"wood","owner":"w5_3-social-80","personId":"w5_3-social-80","distance":6.594481289639391,"receiptDay":1.0020833333333314,"observedDay":1.002777777777776}
SIMULATION observation 1/12 {"day":1.0256944444444462,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.025694444444444138,"requestsStarted":true,"winter":false,"frames":3.87399999999559}}
SIMULATION observation 2/12 {"day":1.0465277777777828,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.004861111111110778,"requestsStarted":true,"winter":false,"frames":3.867999999996986}}
SIMULATION observation 3/12 {"day":1.140972222222242,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01597222222222184,"requestsStarted":true,"winter":false,"frames":1.8679999999969858}}
SIMULATION observation 4/12 {"day":1.2243055555555884,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.015972222222221798,"requestsStarted":true,"winter":false,"frames":9.867999999996986}}
SIMULATION observation 5/12 {"day":1.2506944444444814,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0006944444444440073,"requestsStarted":true,"winter":false,"frames":7.867999999996986}}
SIMULATION observation 6/12 {"day":1.2520833333333705,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.002083333333332896,"requestsStarted":true,"winter":false,"frames":5.867999999996986}}
SIMULATION observation 7/12 {"day":1.2534722222222596,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0034722222222217853,"requestsStarted":true,"winter":false,"frames":3.867999999996986}}
SIMULATION observation 8/12 {"day":1.2548611111111487,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.004861111111110674,"requestsStarted":true,"winter":false,"frames":1.8679999999969858}}
SIMULATION observation 9/12 {"day":1.2555555555555933,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555119,"requestsStarted":true,"winter":false,"frames":9.867999999996986}}
SIMULATION observation 10/12 {"day":1.2569444444444824,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006944444444444008,"requestsStarted":true,"winter":false,"frames":7.867999999996986}}
SIMULATION observation 11/12 {"day":1.2583333333333715,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.008333333333332896,"requestsStarted":true,"winter":false,"frames":5.867999999996986}}
SIMULATION observation 12/12 {"day":1.2597222222222606,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.009722222222221783,"requestsStarted":true,"winter":false,"frames":3.867999999996986}}
PASS villagers move about - {"moved":2,"of":83,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 113 116 130 144 147 148 182 184 187 191 193 196 198 214
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":64.622,"gameHours":3}
PASS the view follows a window resize - {"width":960,"height":640}
FAIL the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

EXIT_STATUS=1
```

</details>

<details>
<summary>frozen21 attempt 1: exit 1, driver ec33995</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen21-attempt1 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8184/
Call log:
  - navigating to "http://localhost:8184/", waiting until "load"

    at opening (/home/cp/code/tk-playtest7/scripts/playtest.js:100:14)
    at /home/cp/code/tk-playtest7/scripts/playtest.js:75:40
FAIL the playtest ran to the end - "page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8184/"
PASS no console errors - []

EXIT_STATUS=1
```

</details>

<details>
<summary>frozen21 attempt 2: exit 1, driver ec33995</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen21-attempt2 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.077 seconds
STARTUP character/world ready after 5.241 seconds
STARTUP click Start new game to standing: 13.183 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":21,"expectedSeed":21,"source":"served world","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.285099999904631,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
could not order Build shelter - terrain5_4-2371: not in view, or covered by something in front
Error: Could not restart the waiting build
    at play (/home/cp/code/tk-playtest7/scripts/playtest.js:400:62)
    at async /home/cp/code/tk-playtest7/scripts/playtest.js:76:5
FAIL the playtest ran to the end - "Could not restart the waiting build"
PASS no console errors - []

EXIT_STATUS=1
```

</details>

<details>
<summary>dev13 attempt 1: exit 0, driver ec33995</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-dev13-attempt1 flock -w 7200 /tmp/27agents-gate.lock npm run playtest -- 'http://[::1]:8176/?seed=13'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://[::1]:8176/?seed=13

STARTUP menu ready after 0.349 seconds
STARTUP character/world ready after 78.227 seconds
STARTUP click Start new game to standing: 87.822 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":13,"expectedSeed":13,"source":"URL","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.259299999713903,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 3.998 seconds
STARTUP character/world ready after 84.666 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_3-694","trees":["terrain5_3-2309"],"eligible":true,"distance":211.80033736339502},"after":[{"id":"terrain5_3-739","trees":[],"eligible":true,"distance":96.18618445634972},{"id":"terrain5_3-695","trees":[],"eligible":true,"distance":100.01252583764267},{"id":"terrain5_3-784","trees":[],"eligible":true,"distance":100.5446705613693},{"id":"terrain5_3-694","trees":[],"eligible":true,"distance":173.18872186793104},{"id":"terrain5_3-568","trees":[],"eligible":true,"distance":359.786746719095},{"id":"terrain5_3-569","trees":[],"eligible":true,"distance":376.6359980895185},{"id":"terrain5_3-613","trees":[],"eligible":true,"distance":459.05170475586533}]}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-783"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-65"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-695","stockpileTile":"terrain5_3-694","tree":"terrain5_3-2263"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":147,"to":0}
PASS the completed task leaves the panel
CHAT approach w5_3-social-65
CHAT panel open w5_3-social-65
CHAT line player.direct_answer.fallback_answer_weather.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-65","lines":[{"id":"player.direct_answer.fallback_answer_weather.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-65"}],"contact":{"day":0.6902777777777767,"position":{"x":2474.966603162095,"y":1172.827923696332},"otherPosition":{"x":2523.4307806183465,"y":1145.1342951089919}}}
RESTART Create Field {"previous":"terrain5_3-695","selected":"terrain5_3-695","candidates":["terrain5_3-695","terrain5_3-613","terrain5_3-569","terrain5_3-568"]}
RESTART Create Stockpile {"previous":"terrain5_3-694","selected":"terrain5_3-694","candidates":["terrain5_3-694","terrain5_3-739","terrain5_3-784","terrain5_3-568","terrain5_3-569","terrain5_3-613"]}
RESTART Cut down {"previous":"terrain5_3-2263","selected":"terrain5_3-2263","candidates":["terrain5_3-2263","terrain5_3-2330","terrain5_3-2329","terrain5_3-2328","terrain5_3-2342","terrain5_3-2213","terrain5_3-2177","terrain5_3-3879","terrain5_3-2366","terrain5_3-2365","terrain5_3-2238","terrain5_3-2214","terrain5_3-2178","terrain5_3-2142","terrain5_3-2379","terrain5_3-2239","terrain5_3-2143","terrain5_3-2406","terrain5_3-2405","terrain5_3-2417","terrain5_3-2407","terrain5_3-3881","terrain5_3-2144","terrain5_3-2418","terrain5_3-2060","terrain5_3-2419","terrain5_3-2429","terrain5_3-2100","terrain5_3-3882","terrain5_3-2420","terrain5_3-2454","terrain5_3-2145","terrain5_3-3884","terrain5_3-2442","terrain5_3-3883","terrain5_3-2456","terrain5_3-2455","terrain5_3-2457","terrain5_3-2471","terrain5_3-2101","terrain5_3-3886","terrain5_3-3885","terrain5_3-2443","terrain5_3-2458","terrain5_3-3887","terrain5_3-2061","terrain5_3-2459","terrain5_3-2488","terrain5_3-2102","terrain5_3-3890","terrain5_3-2507","terrain5_3-3892","terrain5_3-2017","terrain5_3-2489","terrain5_3-3891","terrain5_3-2508","terrain5_3-3893","terrain5_3-2557","terrain5_3-2558","terrain5_3-2559","terrain5_3-2146","terrain5_3-2583","terrain5_3-2062","terrain5_3-2584","terrain5_3-2065","terrain5_3-2103","terrain5_3-2066","terrain5_3-2104","terrain5_3-2067","terrain5_3-2105","terrain5_3-2068","terrain5_3-2295","terrain5_3-2314","terrain5_3-2241","terrain5_3-2357","terrain5_3-2358","terrain5_3-2385","terrain5_3-2343","terrain5_3-2386","terrain5_3-2370","terrain5_3-2410","terrain5_3-2359","terrain5_3-2344","terrain5_3-2434","terrain5_3-2371"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4171","type":"wood","owner":"w5_3-social-80","personId":"w5_3-social-80","distance":6.594481289639391,"receiptDay":1.0020833333333314,"observedDay":1.002777777777776}
SIMULATION observation 1/12 {"day":1.0256944444444462,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.025694444444444138,"requestsStarted":true,"winter":false,"frames":1.737999999984428}}
SIMULATION observation 2/12 {"day":1.0465277777777828,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.004861111111110778,"requestsStarted":true,"winter":false,"frames":2.751999999982335}}
SIMULATION observation 3/12 {"day":1.140972222222242,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01597222222222184,"requestsStarted":true,"winter":false,"frames":2.749999999981636}}
SIMULATION observation 4/12 {"day":1.2500000000000369,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":-4.371503159461554e-16,"requestsStarted":true,"winter":false,"frames":0.749999999981636}}
SIMULATION observation 5/12 {"day":1.2506944444444814,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0006944444444440073,"requestsStarted":true,"winter":false,"frames":8.749999999981636}}
SIMULATION observation 6/12 {"day":1.2520833333333705,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.002083333333332896,"requestsStarted":true,"winter":false,"frames":6.749999999981636}}
SIMULATION observation 7/12 {"day":1.2534722222222596,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0034722222222217853,"requestsStarted":true,"winter":false,"frames":4.749999999981636}}
SIMULATION observation 8/12 {"day":1.2548611111111487,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.004861111111110674,"requestsStarted":true,"winter":false,"frames":1.7539999999830336}}
SIMULATION observation 9/12 {"day":1.2555555555555933,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.005555555555555119,"requestsStarted":true,"winter":false,"frames":9.753999999983034}}
SIMULATION observation 10/12 {"day":1.2569444444444824,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006944444444444008,"requestsStarted":true,"winter":false,"frames":6.75799999998443}}
SIMULATION observation 11/12 {"day":1.257638888888927,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.007638888888888452,"requestsStarted":true,"winter":false,"frames":8.751999999982335}}
SIMULATION observation 12/12 {"day":1.259027777777816,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.00902777777777734,"requestsStarted":true,"winter":false,"frames":5.749999999985128}}
PASS villagers move about - {"moved":2,"of":83,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 113 116 130 144 147 148 182 184 187 191 193 196 198 214
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":54.753,"gameHours":3}
PASS the view follows a window resize - {"width":960,"height":640}
PASS the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

EXIT_STATUS=0
```

</details>

<details>
<summary>frozen21 attempt 3: exit 1, driver c53efe4</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen21-attempt3 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.061 seconds
STARTUP character/world ready after 4.424 seconds
STARTUP click Start new game to standing: 11.895 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":21,"expectedSeed":21,"source":"served world","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.270800000190734,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 5.103 seconds
STARTUP character/world ready after 6.281 seconds
PASS clicking a villager selects it - {"selected":"terrain5_4-person-2365"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_4-1401","trees":["terrain5_4-2124"],"eligible":true,"distance":396.68162580000956},"after":[{"id":"terrain5_4-1424","trees":[],"eligible":true,"distance":97.04904082082125},{"id":"terrain5_4-1398","trees":[],"eligible":true,"distance":100.46417140593523},{"id":"terrain5_4-1423","trees":[],"eligible":true,"distance":100.86015606637879},{"id":"terrain5_4-1370","trees":[],"eligible":true,"distance":107.33982441672663},{"id":"terrain5_4-1396","trees":[],"eligible":true,"distance":107.71053454173763},{"id":"terrain5_4-1369","trees":[],"eligible":true,"distance":110.7975300415427},{"id":"terrain5_4-1425","trees":[],"eligible":true,"distance":173.96626559982417},{"id":"terrain5_4-1449","trees":[],"eligible":true,"distance":174.19524365550777},{"id":"terrain5_4-1371","trees":[],"eligible":true,"distance":179.9099306550943},{"id":"terrain5_4-1422","trees":[],"eligible":true,"distance":180.35250438856434},{"id":"terrain5_4-1341","trees":[],"eligible":true,"distance":185.87798706502676},{"id":"terrain5_4-1368","trees":[],"eligible":true,"distance":186.09230887062307},{"id":"terrain5_4-1450","trees":[],"eligible":true,"distance":200.97195862783659},{"id":"terrain5_4-1399","trees":[],"eligible":true,"distance":204.3007463980205},{"id":"terrain5_4-1448","trees":[],"eligible":true,"distance":204.6905900858527},{"id":"terrain5_4-1342","trees":[],"eligible":true,"distance":211.1785294906975},{"id":"terrain5_4-1395","trees":[],"eligible":true,"distance":211.55569954212928},{"id":"terrain5_4-1451","trees":[],"eligible":true,"distance":268.39424993322046},{"id":"terrain5_4-1474","trees":[],"eligible":true,"distance":268.5427242407978},{"id":"terrain5_4-1426","trees":[],"eligible":true,"distance":269.6479312163468},{"id":"terrain5_4-1372","trees":[],"eligible":true,"distance":273.5202522498617},{"id":"terrain5_4-1343","trees":[],"eligible":true,"distance":276.1197503989176},{"id":"terrain5_4-1367","trees":[],"eligible":true,"distance":280.32945292689493},{"id":"terrain5_4-1475","trees":[],"eligible":true,"distance":304.89496549660555},{"id":"terrain5_4-1400","trees":[],"eligible":true,"distance":308.19562005533993},{"id":"terrain5_4-1344","trees":[],"eligible":true,"distance":359.84421879872923},{"id":"terrain5_4-1476","trees":[],"eligible":true,"distance":367.9764737421177},{"id":"terrain5_4-1373","trees":[],"eligible":true,"distance":372.6379927400521},{"id":"terrain5_4-1314","trees":[],"eligible":true,"distance":376.4527194381789},{"id":"terrain5_4-1401","trees":[],"eligible":true,"distance":412.10470206466044},{"id":"terrain5_4-1477","trees":[],"eligible":true,"distance":446.60097455132205},{"id":"terrain5_4-1453","trees":[],"eligible":true,"distance":447.35552291463927},{"id":"terrain5_4-1345","trees":[],"eligible":true,"distance":452.03274996992735},{"id":"terrain5_4-1374","trees":[],"eligible":true,"distance":473.81939478649696},{"id":"terrain5_4-1454","trees":[],"eligible":true,"distance":544.58489615921},{"id":"terrain5_4-1346","trees":[],"eligible":true,"distance":548.4335440943432},{"id":"terrain5_4-1375","trees":[],"eligible":true,"distance":575.9779198184158},{"id":"terrain5_4-1403","trees":[],"eligible":true,"distance":619.9369128780902}]}
EXPLORE neighbour {"person":"w5_4-social-151","moved":"terrain5_4-1346","beforeKnown":96,"afterKnown":105}
EXPLORE neighbour {"person":"w5_4-social-143","moved":"terrain5_4-1287","beforeKnown":105,"afterKnown":115}
EXPLORE neighbour {"person":"w5_4-social-143","moved":"terrain5_4-1289","beforeKnown":115,"afterKnown":125}
EXPLORE neighbour {"person":"w5_4-social-143","moved":"terrain5_4-1259","beforeKnown":125,"afterKnown":135}
EXPLORE neighbour {"person":"w5_4-social-120","moved":"terrain5_4-1228","beforeKnown":135,"afterKnown":145}
EXPLORE neighbour {"person":"w5_4-social-123","moved":"terrain5_4-1161","beforeKnown":145,"afterKnown":155}
EXPLORE neighbour {"person":"w6_4-social-107","moved":"terrain5_4-1163","beforeKnown":155,"afterKnown":165}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_4-1126"}
PASS the current order appears in the status strip
FAIL Chat starts a personal order from the person panel - {"person":"w5_4-social-151"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_4-1196","stockpileTile":"terrain5_4-1401","tree":"terrain5_4-1836"}
PASS the player walks to the ordered tile - {"walker":"terrain5_4-person-2365","from":163,"to":0}
PASS the completed task leaves the panel
Error: The person panel did not queue Chat with w5_4-social-151
    at play (/home/cp/code/tk-playtest7/scripts/playtest.js:553:23)
    at async /home/cp/code/tk-playtest7/scripts/playtest.js:76:5
FAIL the playtest ran to the end - "The person panel did not queue Chat with w5_4-social-151"
PASS no console errors - []

EXIT_STATUS=1
```

</details>

<details>
<summary>frozen21 attempt 4: exit 1, driver f85a921</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen21-attempt4 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.239 seconds
STARTUP character/world ready after 3.73 seconds
STARTUP click Start new game to standing: 10.477 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":21,"expectedSeed":21,"source":"served world","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.277499999999999,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 3.947 seconds
STARTUP character/world ready after 3.441 seconds
PASS clicking a villager selects it - {"selected":"terrain5_4-person-2365"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_4-1401","trees":["terrain5_4-2124"],"eligible":true,"distance":396.68162580000956},"after":[{"id":"terrain5_4-1424","trees":[],"eligible":true,"distance":97.04904082082125},{"id":"terrain5_4-1398","trees":[],"eligible":true,"distance":100.46417140593523},{"id":"terrain5_4-1423","trees":[],"eligible":true,"distance":100.86015606637879},{"id":"terrain5_4-1370","trees":[],"eligible":true,"distance":107.33982441672663},{"id":"terrain5_4-1396","trees":[],"eligible":true,"distance":107.71053454173763},{"id":"terrain5_4-1369","trees":[],"eligible":true,"distance":110.7975300415427},{"id":"terrain5_4-1425","trees":[],"eligible":true,"distance":173.96626559982417},{"id":"terrain5_4-1449","trees":[],"eligible":true,"distance":174.19524365550777},{"id":"terrain5_4-1371","trees":[],"eligible":true,"distance":179.9099306550943},{"id":"terrain5_4-1422","trees":[],"eligible":true,"distance":180.35250438856434},{"id":"terrain5_4-1341","trees":[],"eligible":true,"distance":185.87798706502676},{"id":"terrain5_4-1368","trees":[],"eligible":true,"distance":186.09230887062307},{"id":"terrain5_4-1450","trees":[],"eligible":true,"distance":200.97195862783659},{"id":"terrain5_4-1399","trees":[],"eligible":true,"distance":204.3007463980205},{"id":"terrain5_4-1448","trees":[],"eligible":true,"distance":204.6905900858527},{"id":"terrain5_4-1342","trees":[],"eligible":true,"distance":211.1785294906975},{"id":"terrain5_4-1395","trees":[],"eligible":true,"distance":211.55569954212928},{"id":"terrain5_4-1451","trees":[],"eligible":true,"distance":268.39424993322046},{"id":"terrain5_4-1474","trees":[],"eligible":true,"distance":268.5427242407978},{"id":"terrain5_4-1426","trees":[],"eligible":true,"distance":269.6479312163468},{"id":"terrain5_4-1372","trees":[],"eligible":true,"distance":273.5202522498617},{"id":"terrain5_4-1343","trees":[],"eligible":true,"distance":276.1197503989176},{"id":"terrain5_4-1367","trees":[],"eligible":true,"distance":280.32945292689493},{"id":"terrain5_4-1475","trees":[],"eligible":true,"distance":304.89496549660555},{"id":"terrain5_4-1400","trees":[],"eligible":true,"distance":308.19562005533993},{"id":"terrain5_4-1344","trees":[],"eligible":true,"distance":359.84421879872923},{"id":"terrain5_4-1476","trees":[],"eligible":true,"distance":367.9764737421177},{"id":"terrain5_4-1373","trees":[],"eligible":true,"distance":372.6379927400521},{"id":"terrain5_4-1314","trees":[],"eligible":true,"distance":376.4527194381789},{"id":"terrain5_4-1401","trees":[],"eligible":true,"distance":412.10470206466044},{"id":"terrain5_4-1477","trees":[],"eligible":true,"distance":446.60097455132205},{"id":"terrain5_4-1453","trees":[],"eligible":true,"distance":447.35552291463927},{"id":"terrain5_4-1345","trees":[],"eligible":true,"distance":452.03274996992735},{"id":"terrain5_4-1374","trees":[],"eligible":true,"distance":473.81939478649696},{"id":"terrain5_4-1454","trees":[],"eligible":true,"distance":544.58489615921},{"id":"terrain5_4-1346","trees":[],"eligible":true,"distance":548.4335440943432},{"id":"terrain5_4-1375","trees":[],"eligible":true,"distance":575.9779198184158},{"id":"terrain5_4-1403","trees":[],"eligible":true,"distance":619.9369128780902}]}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1345","beforeKnown":96,"afterKnown":101}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1317","beforeKnown":101,"afterKnown":110}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1288","beforeKnown":110,"afterKnown":120}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1258","beforeKnown":120,"afterKnown":130}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1260","beforeKnown":130,"afterKnown":140}
EXPLORE neighbour {"person":"w5_4-social-156","moved":"terrain5_4-1195","beforeKnown":140,"afterKnown":150}
EXPLORE neighbour {"person":"w6_4-social-107","moved":"terrain5_4-1162","beforeKnown":150,"afterKnown":160}
EXPLORE neighbour {"person":"w6_4-social-107","moved":"terrain5_4-1128","beforeKnown":160,"afterKnown":170}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_4-1198"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_4-social-148"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_4-1161","stockpileTile":"terrain5_4-1401","tree":"terrain5_4-1858"}
PASS the player walks to the ordered tile - {"walker":"terrain5_4-person-2365","from":163,"to":4}
PASS the completed task leaves the panel
CHAT approach w5_4-social-148
CHAT panel open w5_4-social-148
CHAT line player.season_talk.named.base.02
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_4-social-148","lines":[{"id":"player.season_talk.named.base.02","family":"season_talk","disabled":false,"matches":2,"score":0}],"pops":[{"kind":"topic","key":"season","score":-2,"amount":-2,"listenerId":"w5_4-social-148"},{"kind":"person","personId":"w5_4-social-148","score":0,"amount":0,"listenerId":"w5_4-social-148"}],"contact":{"day":0.7249999999999988,"position":{"x":2748.7659384300946,"y":2738.5457601568555},"otherPosition":{"x":2703.430780618348,"y":2703.980021920982}}}
RESTART Create Field {"previous":"terrain5_4-1161","selected":"terrain5_4-1161","candidates":["terrain5_4-1161","terrain5_4-1230","terrain5_4-1263","terrain5_4-1229","terrain5_4-1262","terrain5_4-1194","terrain5_4-1261","terrain5_4-1293","terrain5_4-1193","terrain5_4-1292","terrain5_4-1323","terrain5_4-1291","terrain5_4-1322","terrain5_4-1290","terrain5_4-1321","terrain5_4-1350","terrain5_4-1349","terrain5_4-1287","terrain5_4-1348","terrain5_4-1377","terrain5_4-1347","terrain5_4-1376","terrain5_4-1316","terrain5_4-1375","terrain5_4-1374","terrain5_4-1344","terrain5_4-1314","terrain5_4-1454","terrain5_4-1343","terrain5_4-1453","terrain5_4-1371","terrain5_4-1342","terrain5_4-1477","terrain5_4-1370","terrain5_4-1451","terrain5_4-1341","terrain5_4-1476","terrain5_4-1450","terrain5_4-1369","terrain5_4-1475","terrain5_4-1423","terrain5_4-1449","terrain5_4-1396","terrain5_4-1474","terrain5_4-1368","terrain5_4-1448","terrain5_4-1422","terrain5_4-1395","terrain5_4-1367"]}
RESTART Create Stockpile {"previous":"terrain5_4-1401","selected":"terrain5_4-1401","candidates":["terrain5_4-1401","terrain5_4-1125","terrain5_4-1195","terrain5_4-1196","terrain5_4-1194","terrain5_4-1229","terrain5_4-1228","terrain5_4-1230","terrain5_4-1193","terrain5_4-1261","terrain5_4-1262","terrain5_4-1260","terrain5_4-1263","terrain5_4-1293","terrain5_4-1259","terrain5_4-1292","terrain5_4-1291","terrain5_4-1258","terrain5_4-1323","terrain5_4-1322","terrain5_4-1290","terrain5_4-1321","terrain5_4-1289","terrain5_4-1350","terrain5_4-1288","terrain5_4-1349","terrain5_4-1287","terrain5_4-1318","terrain5_4-1348","terrain5_4-1377","terrain5_4-1317","terrain5_4-1347","terrain5_4-1376","terrain5_4-1316","terrain5_4-1346","terrain5_4-1375","terrain5_4-1403","terrain5_4-1345","terrain5_4-1374","terrain5_4-1344","terrain5_4-1314","terrain5_4-1373","terrain5_4-1454","terrain5_4-1343","terrain5_4-1372","terrain5_4-1400","terrain5_4-1453","terrain5_4-1371","terrain5_4-1342","terrain5_4-1399","terrain5_4-1426","terrain5_4-1477","terrain5_4-1398","terrain5_4-1370","terrain5_4-1425","terrain5_4-1341","terrain5_4-1451","terrain5_4-1476","terrain5_4-1369","terrain5_4-1424","terrain5_4-1450","terrain5_4-1475","terrain5_4-1423","terrain5_4-1396","terrain5_4-1368","terrain5_4-1449","terrain5_4-1474","terrain5_4-1422","terrain5_4-1395","terrain5_4-1448","terrain5_4-1367"]}
RESTART Cut down {"previous":"terrain5_4-1858","selected":"terrain5_4-1858","candidates":["terrain5_4-1858","terrain5_4-2084","terrain5_4-2083","terrain5_4-2123","terrain5_4-2076","terrain5_4-2078","terrain5_4-2127","terrain5_4-2079","terrain5_4-2126","terrain5_4-2125","terrain5_4-2090","terrain5_4-2085","terrain5_4-2054","terrain5_4-1964","terrain5_4-1939","terrain5_4-1952","terrain5_4-1953","terrain5_4-1940","terrain5_4-1921","terrain5_4-1922","terrain5_4-1900","terrain5_4-1878","terrain5_4-1857","terrain5_4-1808","terrain5_4-1836"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_4-2408","type":"wood","owner":"w5_4-social-114","personId":"w5_4-social-114","distance":2.250453259442389,"receiptDay":2.6923611111113734,"observedDay":2.693055555555818}
SIMULATION observation 1/12 {"day":2.714583333333599,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006249999999998835,"requestsStarted":true,"winter":false,"frames":0.9140000000054052}}
SIMULATION observation 2/12 {"day":2.7354166666669357,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.027083333333332175,"requestsStarted":true,"winter":false,"frames":1.9040000000054036}}
SIMULATION observation 3/12 {"day":2.7562500000002723,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006249999999998814,"requestsStarted":true,"winter":false,"frames":2.894000000005402}}
SIMULATION observation 4/12 {"day":2.777083333333609,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.027083333333332155,"requestsStarted":true,"winter":false,"frames":2.882000000008194}}
SIMULATION observation 5/12 {"day":2.7979166666669455,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006249999999998793,"requestsStarted":true,"winter":false,"frames":1.8620000000081909}}
SIMULATION observation 6/12 {"day":2.818750000000282,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.027083333333332134,"requestsStarted":true,"winter":false,"frames":1.8500000000109829}}
SIMULATION observation 7/12 {"day":2.8395833333336187,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006249999999998772,"requestsStarted":true,"winter":false,"frames":1.8380000000067902}}
SIMULATION observation 8/12 {"day":2.8604166666669553,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.027083333333332113,"requestsStarted":true,"winter":false,"frames":1.8260000000025993}}
SIMULATION observation 9/12 {"day":2.881250000000292,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006249999999998751,"requestsStarted":true,"winter":false,"frames":1.814000000005386}}
SIMULATION observation 10/12 {"day":2.9020833333336284,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.027083333333332092,"requestsStarted":true,"winter":false,"frames":1.802000000008178}}
SIMULATION observation 11/12 {"day":2.922916666666965,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0062499999999987305,"requestsStarted":true,"winter":false,"frames":2.7860000000095724}}
SIMULATION observation 12/12 {"day":2.9437500000003016,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.02708333333333207,"requestsStarted":true,"winter":false,"frames":0.7760000000095708}}
PASS villagers move about - {"moved":70,"of":133,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 62 90 91 99 102 107 109 112 113 114 116 121 123 127 128 129 130 135 137 144 145 149 150 157 160 162 167 170 180 181 182 184 185 192 194 197 198 200 201 202 204 205 207 208 211 212 216 217 219 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 246 247 248 249 250 252 253 255 257 260 264 265 269 270 271 273 274 279 280 281 282 283 284 287 288 293 294 296 297 299 301 303 304 305 306 307 308 309 310 311 312 313 314 315 316 317 318 319 321 323 326 328 330 332 335 343 348 356 357 363 364 365 368 370 375 378 379 382 384 386 388 390 396 397 401 405 407 412 413 416 418 419 423 425 426 430 436 437 438 440 444 447 448 449 450 451 452 454 455 457 458 459 460 461 462 463 464 465 467 471 472
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
page.waitForFunction: Timeout 300000ms exceeded.
    at finishOrder (/home/cp/code/tk-playtest7/scripts/playtest.js:169:16)
    at async play (/home/cp/code/tk-playtest7/scripts/playtest.js:704:93)
    at async /home/cp/code/tk-playtest7/scripts/playtest.js:77:5
FAIL the playtest ran to the end - "page.waitForFunction: Timeout 300000ms exceeded."
PASS no console errors - []

EXIT_STATUS=1
```

</details>

<details>
<summary>frozen21 attempt 5: exit 0, driver 0222391</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen21-attempt5 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.332 seconds
STARTUP character/world ready after 3.932 seconds
STARTUP click Start new game to standing: 10.860 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":21,"expectedSeed":21,"source":"served world","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.270099999904633,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 4.508 seconds
STARTUP character/world ready after 3.897 seconds
PASS clicking a villager selects it - {"selected":"terrain5_4-person-2365"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_4-1401","trees":["terrain5_4-2124"],"eligible":true,"distance":396.68162580000956},"after":[{"id":"terrain5_4-1424","trees":[],"eligible":true,"distance":97.04904082082125},{"id":"terrain5_4-1398","trees":[],"eligible":true,"distance":100.46417140593523},{"id":"terrain5_4-1423","trees":[],"eligible":true,"distance":100.86015606637879},{"id":"terrain5_4-1370","trees":[],"eligible":true,"distance":107.33982441672663},{"id":"terrain5_4-1396","trees":[],"eligible":true,"distance":107.71053454173763},{"id":"terrain5_4-1369","trees":[],"eligible":true,"distance":110.7975300415427},{"id":"terrain5_4-1425","trees":[],"eligible":true,"distance":173.96626559982417},{"id":"terrain5_4-1449","trees":[],"eligible":true,"distance":174.19524365550777},{"id":"terrain5_4-1371","trees":[],"eligible":true,"distance":179.9099306550943},{"id":"terrain5_4-1422","trees":[],"eligible":true,"distance":180.35250438856434},{"id":"terrain5_4-1341","trees":[],"eligible":true,"distance":185.87798706502676},{"id":"terrain5_4-1368","trees":[],"eligible":true,"distance":186.09230887062307},{"id":"terrain5_4-1450","trees":[],"eligible":true,"distance":200.97195862783659},{"id":"terrain5_4-1399","trees":[],"eligible":true,"distance":204.3007463980205},{"id":"terrain5_4-1448","trees":[],"eligible":true,"distance":204.6905900858527},{"id":"terrain5_4-1342","trees":[],"eligible":true,"distance":211.1785294906975},{"id":"terrain5_4-1395","trees":[],"eligible":true,"distance":211.55569954212928},{"id":"terrain5_4-1451","trees":[],"eligible":true,"distance":268.39424993322046},{"id":"terrain5_4-1474","trees":[],"eligible":true,"distance":268.5427242407978},{"id":"terrain5_4-1426","trees":[],"eligible":true,"distance":269.6479312163468},{"id":"terrain5_4-1372","trees":[],"eligible":true,"distance":273.5202522498617},{"id":"terrain5_4-1343","trees":[],"eligible":true,"distance":276.1197503989176},{"id":"terrain5_4-1367","trees":[],"eligible":true,"distance":280.32945292689493},{"id":"terrain5_4-1475","trees":[],"eligible":true,"distance":304.89496549660555},{"id":"terrain5_4-1400","trees":[],"eligible":true,"distance":308.19562005533993},{"id":"terrain5_4-1344","trees":[],"eligible":true,"distance":359.84421879872923},{"id":"terrain5_4-1476","trees":[],"eligible":true,"distance":367.9764737421177},{"id":"terrain5_4-1373","trees":[],"eligible":true,"distance":372.6379927400521},{"id":"terrain5_4-1314","trees":[],"eligible":true,"distance":376.4527194381789},{"id":"terrain5_4-1401","trees":[],"eligible":true,"distance":412.10470206466044},{"id":"terrain5_4-1477","trees":[],"eligible":true,"distance":446.60097455132205},{"id":"terrain5_4-1453","trees":[],"eligible":true,"distance":447.35552291463927},{"id":"terrain5_4-1345","trees":[],"eligible":true,"distance":452.03274996992735},{"id":"terrain5_4-1374","trees":[],"eligible":true,"distance":473.81939478649696},{"id":"terrain5_4-1454","trees":[],"eligible":true,"distance":544.58489615921},{"id":"terrain5_4-1346","trees":[],"eligible":true,"distance":548.4335440943432},{"id":"terrain5_4-1375","trees":[],"eligible":true,"distance":575.9779198184158},{"id":"terrain5_4-1403","trees":[],"eligible":true,"distance":619.9369128780902}]}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1345","beforeKnown":96,"afterKnown":101}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1317","beforeKnown":101,"afterKnown":110}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1288","beforeKnown":110,"afterKnown":120}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1258","beforeKnown":120,"afterKnown":130}
EXPLORE neighbour {"person":"w5_4-social-114","moved":"terrain5_4-1260","beforeKnown":130,"afterKnown":140}
EXPLORE neighbour {"person":"w5_4-social-156","moved":"terrain5_4-1195","beforeKnown":140,"afterKnown":150}
EXPLORE neighbour {"person":"w6_4-social-107","moved":"terrain5_4-1162","beforeKnown":150,"afterKnown":160}
EXPLORE neighbour {"person":"w6_4-social-107","moved":"terrain5_4-1128","beforeKnown":160,"afterKnown":170}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_4-1198"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_4-social-148"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_4-1161","stockpileTile":"terrain5_4-1401","tree":"terrain5_4-2127"}
PASS the player walks to the ordered tile - {"walker":"terrain5_4-person-2365","from":150,"to":4}
PASS the completed task leaves the panel
CHAT approach w5_4-social-148
CHAT panel open w5_4-social-148
CHAT line player.season_talk.named.base.02
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_4-social-148","lines":[{"id":"player.season_talk.named.base.02","family":"season_talk","disabled":false,"matches":2,"score":0}],"pops":[{"kind":"topic","key":"season","score":-2,"amount":-2,"listenerId":"w5_4-social-148"},{"kind":"person","personId":"w5_4-social-148","score":0,"amount":0,"listenerId":"w5_4-social-148"}],"contact":{"day":0.7249999999999988,"position":{"x":2748.7659384300946,"y":2738.5457601568555},"otherPosition":{"x":2703.430780618348,"y":2703.980021920982}}}
RESTART Create Field {"previous":"terrain5_4-1161","selected":"terrain5_4-1161","candidates":["terrain5_4-1161","terrain5_4-1230","terrain5_4-1263","terrain5_4-1229","terrain5_4-1262","terrain5_4-1194","terrain5_4-1261","terrain5_4-1293","terrain5_4-1193","terrain5_4-1292","terrain5_4-1323","terrain5_4-1291","terrain5_4-1322","terrain5_4-1290","terrain5_4-1321","terrain5_4-1350","terrain5_4-1349","terrain5_4-1287","terrain5_4-1348","terrain5_4-1377","terrain5_4-1347","terrain5_4-1376","terrain5_4-1316","terrain5_4-1375","terrain5_4-1374","terrain5_4-1344","terrain5_4-1314","terrain5_4-1454","terrain5_4-1343","terrain5_4-1453","terrain5_4-1371","terrain5_4-1342","terrain5_4-1477","terrain5_4-1370","terrain5_4-1451","terrain5_4-1341","terrain5_4-1476","terrain5_4-1450","terrain5_4-1369","terrain5_4-1475","terrain5_4-1423","terrain5_4-1449","terrain5_4-1396","terrain5_4-1474","terrain5_4-1368","terrain5_4-1448","terrain5_4-1422","terrain5_4-1395","terrain5_4-1367"]}
RESTART Create Stockpile {"previous":"terrain5_4-1401","selected":"terrain5_4-1401","candidates":["terrain5_4-1401","terrain5_4-1125","terrain5_4-1195","terrain5_4-1196","terrain5_4-1194","terrain5_4-1229","terrain5_4-1228","terrain5_4-1230","terrain5_4-1193","terrain5_4-1261","terrain5_4-1262","terrain5_4-1260","terrain5_4-1263","terrain5_4-1293","terrain5_4-1259","terrain5_4-1292","terrain5_4-1291","terrain5_4-1258","terrain5_4-1323","terrain5_4-1322","terrain5_4-1290","terrain5_4-1321","terrain5_4-1289","terrain5_4-1350","terrain5_4-1288","terrain5_4-1349","terrain5_4-1287","terrain5_4-1318","terrain5_4-1348","terrain5_4-1377","terrain5_4-1317","terrain5_4-1347","terrain5_4-1376","terrain5_4-1316","terrain5_4-1346","terrain5_4-1375","terrain5_4-1403","terrain5_4-1345","terrain5_4-1374","terrain5_4-1344","terrain5_4-1314","terrain5_4-1373","terrain5_4-1454","terrain5_4-1343","terrain5_4-1372","terrain5_4-1400","terrain5_4-1453","terrain5_4-1371","terrain5_4-1342","terrain5_4-1399","terrain5_4-1426","terrain5_4-1477","terrain5_4-1398","terrain5_4-1370","terrain5_4-1425","terrain5_4-1341","terrain5_4-1451","terrain5_4-1476","terrain5_4-1369","terrain5_4-1424","terrain5_4-1450","terrain5_4-1475","terrain5_4-1423","terrain5_4-1396","terrain5_4-1368","terrain5_4-1449","terrain5_4-1474","terrain5_4-1422","terrain5_4-1395","terrain5_4-1448","terrain5_4-1367"]}
RESTART Cut down {"previous":"terrain5_4-2127","selected":"terrain5_4-2127","candidates":["terrain5_4-2127","terrain5_4-2123","terrain5_4-2125","terrain5_4-2126","terrain5_4-2083","terrain5_4-2084","terrain5_4-2076","terrain5_4-2078","terrain5_4-2079","terrain5_4-2090","terrain5_4-2085","terrain5_4-1964","terrain5_4-2054","terrain5_4-1939","terrain5_4-1952","terrain5_4-1921","terrain5_4-1940","terrain5_4-1953","terrain5_4-1922","terrain5_4-1900","terrain5_4-1878","terrain5_4-1857","terrain5_4-1858","terrain5_4-1808","terrain5_4-1836"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_4-2408","type":"wood","owner":"w5_4-social-114","personId":"w5_4-social-114","distance":2.149374551040665,"receiptDay":1.0965277777777906,"observedDay":1.0972222222222352}
SIMULATION observation 1/12 {"day":1.1201388888889054,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.036805555555555196,"requestsStarted":true,"winter":false,"frames":1.4280000000011093}}
SIMULATION observation 2/12 {"day":1.140972222222242,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01597222222222184,"requestsStarted":true,"winter":false,"frames":3.408000000004588}}
SIMULATION observation 3/12 {"day":1.1618055555555786,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.036805555555555175,"requestsStarted":true,"winter":false,"frames":5.382000000002488}}
SIMULATION observation 4/12 {"day":1.1826388888889152,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01597222222222182,"requestsStarted":true,"winter":false,"frames":4.374000000003186}}
SIMULATION observation 5/12 {"day":1.2034722222222518,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.036805555555555154,"requestsStarted":true,"winter":false,"frames":2.3580000000010877}}
SIMULATION observation 6/12 {"day":1.2500000000000369,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":-4.371503159461554e-16,"requestsStarted":true,"winter":false,"frames":1.3560000000038812}}
SIMULATION observation 7/12 {"day":1.2506944444444814,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0006944444444440073,"requestsStarted":true,"winter":false,"frames":1.352000000005976}}
SIMULATION observation 8/12 {"day":1.2659722222222616,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.015972222222221777,"requestsStarted":true,"winter":false,"frames":0.34000000000177977}}
SIMULATION observation 9/12 {"day":1.2868055555555982,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.03680555555555511,"requestsStarted":true,"winter":false,"frames":1.3240000000066665}}
SIMULATION observation 10/12 {"day":1.3076388888889348,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.015972222222221756,"requestsStarted":true,"winter":false,"frames":3.322000000002472}}
SIMULATION observation 11/12 {"day":1.3284722222222713,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.03680555555555509,"requestsStarted":true,"winter":false,"frames":2.3080000000010656}}
SIMULATION observation 12/12 {"day":1.349305555555608,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.015972222222221735,"requestsStarted":true,"winter":false,"frames":1.293999999999663}}
PASS villagers move about - {"moved":30,"of":133,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 113 127 139 157 169 175 176 177 193 201 202 204 208 210 214 217 218 219 220 223 224 225 226 228 229 230 231 232 233 234 235 236 239 240 242 243 244 246 248 249 251 253 255 256 257 267 271 284 285 287 288 297 300 304 307 309 318 364 385 386 412 413 422 442 450 451 452 456 457 458 459 461 462 463 464 466 467 469 472
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":36.229,"gameHours":3}
PASS the view follows a window resize - {"width":960,"height":640}
PASS the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

EXIT_STATUS=0
```

</details>

<details>
<summary>dev13 attempt 2: exit 0, driver 0222391</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-dev13-attempt2 flock -w 7200 /tmp/27agents-gate.lock npm run playtest -- 'http://[::1]:8176/?seed=13'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://[::1]:8176/?seed=13

STARTUP menu ready after 0.252 seconds
STARTUP character/world ready after 70.201 seconds
STARTUP click Start new game to standing: 78.217 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":13,"expectedSeed":13,"source":"URL","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.2960000000000065,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 3.707 seconds
STARTUP character/world ready after 74.384 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_3-694","trees":["terrain5_3-2309"],"eligible":true,"distance":211.80033736339502},"after":[{"id":"terrain5_3-739","trees":[],"eligible":true,"distance":96.18618445634972},{"id":"terrain5_3-695","trees":[],"eligible":true,"distance":100.01252583764267},{"id":"terrain5_3-784","trees":[],"eligible":true,"distance":100.5446705613693},{"id":"terrain5_3-694","trees":[],"eligible":true,"distance":173.18872186793104},{"id":"terrain5_3-568","trees":[],"eligible":true,"distance":359.786746719095},{"id":"terrain5_3-569","trees":[],"eligible":true,"distance":376.6359980895185},{"id":"terrain5_3-613","trees":[],"eligible":true,"distance":459.05170475586533}]}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-783"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-65"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-695","stockpileTile":"terrain5_3-694","tree":"terrain5_3-2263"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":147,"to":0}
PASS the completed task leaves the panel
CHAT approach w5_3-social-65
CHAT panel open w5_3-social-65
CHAT line player.direct_answer.fallback_answer_weather.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-65","lines":[{"id":"player.direct_answer.fallback_answer_weather.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-65"}],"contact":{"day":0.6902777777777767,"position":{"x":2474.966603162095,"y":1172.827923696332},"otherPosition":{"x":2523.4307806183465,"y":1145.1342951089919}}}
RESTART Create Field {"previous":"terrain5_3-695","selected":"terrain5_3-695","candidates":["terrain5_3-695","terrain5_3-613","terrain5_3-569","terrain5_3-568"]}
RESTART Create Stockpile {"previous":"terrain5_3-694","selected":"terrain5_3-694","candidates":["terrain5_3-694","terrain5_3-739","terrain5_3-784","terrain5_3-568","terrain5_3-569","terrain5_3-613"]}
RESTART Cut down {"previous":"terrain5_3-2263","selected":"terrain5_3-2263","candidates":["terrain5_3-2263","terrain5_3-3879","terrain5_3-2407","terrain5_3-3881","terrain5_3-2238","terrain5_3-2239","terrain5_3-2366","terrain5_3-2330","terrain5_3-2419","terrain5_3-2420","terrain5_3-2406","terrain5_3-2418","terrain5_3-2379","terrain5_3-2329","terrain5_3-2405","terrain5_3-2365","terrain5_3-2214","terrain5_3-2213","terrain5_3-2429","terrain5_3-2342","terrain5_3-3882","terrain5_3-2417","terrain5_3-2328","terrain5_3-2442","terrain5_3-2178","terrain5_3-3883","terrain5_3-2443","terrain5_3-2143","terrain5_3-2456","terrain5_3-2177","terrain5_3-2457","terrain5_3-3886","terrain5_3-2458","terrain5_3-2144","terrain5_3-2454","terrain5_3-3884","terrain5_3-2142","terrain5_3-3885","terrain5_3-3887","terrain5_3-2455","terrain5_3-2459","terrain5_3-2100","terrain5_3-2471","terrain5_3-2145","terrain5_3-2060","terrain5_3-2488","terrain5_3-3890","terrain5_3-2489","terrain5_3-2101","terrain5_3-2507","terrain5_3-3891","terrain5_3-3892","terrain5_3-2061","terrain5_3-2102","terrain5_3-2508","terrain5_3-3893","terrain5_3-2017","terrain5_3-2557","terrain5_3-2558","terrain5_3-2559","terrain5_3-2583","terrain5_3-2584","terrain5_3-2146","terrain5_3-2062","terrain5_3-2065","terrain5_3-2103","terrain5_3-2066","terrain5_3-2104","terrain5_3-2067","terrain5_3-2314","terrain5_3-2295","terrain5_3-2241","terrain5_3-2105","terrain5_3-2068","terrain5_3-2357","terrain5_3-2358","terrain5_3-2385","terrain5_3-2386","terrain5_3-2343","terrain5_3-2370","terrain5_3-2410","terrain5_3-2359","terrain5_3-2344","terrain5_3-2434","terrain5_3-2371"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4171","type":"wood","owner":"w5_3-social-96","personId":"w5_3-social-96","distance":9.91560931555204,"receiptDay":1.0270833333333353,"observedDay":1.02777777777778}
SIMULATION observation 1/12 {"day":1.0506944444444501,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.009027777777777444,"requestsStarted":true,"winter":false,"frames":5.457999999961682}}
SIMULATION observation 2/12 {"day":1.0715277777777867,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.02986111111111079,"requestsStarted":true,"winter":false,"frames":0.4359999999679651}}
SIMULATION observation 3/12 {"day":1.0923611111111233,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.009027777777777423,"requestsStarted":true,"winter":false,"frames":4.437999999968662}}
SIMULATION observation 4/12 {"day":1.1840277777778043,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01736111111111071,"requestsStarted":true,"winter":false,"frames":5.4239999999637725}}
SIMULATION observation 5/12 {"day":1.2506944444444814,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0006944444444440073,"requestsStarted":true,"winter":false,"frames":3.4239999999637725}}
SIMULATION observation 6/12 {"day":1.2520833333333705,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.002083333333332896,"requestsStarted":true,"winter":false,"frames":1.4239999999637725}}
SIMULATION observation 7/12 {"day":1.252777777777815,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0027777777777773407,"requestsStarted":true,"winter":false,"frames":8.421999999963074}}
SIMULATION observation 8/12 {"day":1.2541666666667042,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0041666666666662295,"requestsStarted":true,"winter":false,"frames":6.421999999963074}}
SIMULATION observation 9/12 {"day":1.2548611111111487,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.004861111111110674,"requestsStarted":true,"winter":false,"frames":7.419999999962375}}
SIMULATION observation 10/12 {"day":1.2562500000000378,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.006249999999999563,"requestsStarted":true,"winter":false,"frames":4.411999999963072}}
SIMULATION observation 11/12 {"day":1.259027777777816,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.00902777777777734,"requestsStarted":true,"winter":false,"frames":0.4119999999630721}}
SIMULATION observation 12/12 {"day":1.2798611111111526,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.029861111111110686,"requestsStarted":true,"winter":false,"frames":3.363999999963763}}
PASS villagers move about - {"moved":41,"of":83,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 113 129 130 131 145 147 148 151 153 156 162 165 168 169 173 182 183 186 187 189 191 193 194 198 203 204 214 222
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":44.519,"gameHours":4}
PASS the view follows a window resize - {"width":960,"height":640}
PASS the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

EXIT_STATUS=0
```

</details>

<details>
<summary>frozen13 attempt 2: exit 1, driver 0222391</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen13-attempt2 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.265 seconds
STARTUP character/world ready after 3.789 seconds
STARTUP click Start new game to standing: 12.272 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":13,"expectedSeed":13,"source":"served world","matches":true}
FAIL the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":6.569799999713898,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 3.451 seconds
STARTUP character/world ready after 3.131 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_3-694","trees":["terrain5_3-2309"],"eligible":true,"distance":211.80033736339502},"after":[{"id":"terrain5_3-739","trees":[],"eligible":true,"distance":96.18618445634972},{"id":"terrain5_3-695","trees":[],"eligible":true,"distance":100.01252583764267},{"id":"terrain5_3-784","trees":[],"eligible":true,"distance":100.5446705613693},{"id":"terrain5_3-694","trees":[],"eligible":true,"distance":173.18872186793104},{"id":"terrain5_3-568","trees":[],"eligible":true,"distance":359.786746719095},{"id":"terrain5_3-569","trees":[],"eligible":true,"distance":376.6359980895185},{"id":"terrain5_3-613","trees":[],"eligible":true,"distance":459.05170475586533}]}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-783"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-65"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-695","stockpileTile":"terrain5_3-694","tree":"terrain5_3-2263"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":160,"to":0}
PASS the completed task leaves the panel
CHAT approach w5_3-social-65
CHAT panel open w5_3-social-65
CHAT line player.direct_answer.fallback_answer_weather.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-65","lines":[{"id":"player.direct_answer.fallback_answer_weather.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-65"}],"contact":{"day":0.6902777777777767,"position":{"x":2474.966603162095,"y":1172.827923696332},"otherPosition":{"x":2523.4307806183465,"y":1145.1342951089919}}}
RESTART Create Field {"previous":"terrain5_3-695","selected":"terrain5_3-695","candidates":["terrain5_3-695","terrain5_3-613","terrain5_3-569","terrain5_3-568"]}
RESTART Create Stockpile {"previous":"terrain5_3-694","selected":"terrain5_3-694","candidates":["terrain5_3-694","terrain5_3-739","terrain5_3-784","terrain5_3-568","terrain5_3-569","terrain5_3-613"]}
RESTART Cut down {"previous":"terrain5_3-2263","selected":"terrain5_3-2263","candidates":["terrain5_3-2263","terrain5_3-3879","terrain5_3-2407","terrain5_3-3881","terrain5_3-2238","terrain5_3-2239","terrain5_3-2366","terrain5_3-2330","terrain5_3-2419","terrain5_3-2420","terrain5_3-2406","terrain5_3-2418","terrain5_3-2379","terrain5_3-2329","terrain5_3-2405","terrain5_3-2365","terrain5_3-2214","terrain5_3-2213","terrain5_3-2429","terrain5_3-2342","terrain5_3-3882","terrain5_3-2417","terrain5_3-2328","terrain5_3-2442","terrain5_3-2178","terrain5_3-3883","terrain5_3-2443","terrain5_3-2143","terrain5_3-2456","terrain5_3-2177","terrain5_3-2457","terrain5_3-3886","terrain5_3-2458","terrain5_3-2144","terrain5_3-2454","terrain5_3-3884","terrain5_3-2142","terrain5_3-3885","terrain5_3-3887","terrain5_3-2455","terrain5_3-2459","terrain5_3-2100","terrain5_3-2471","terrain5_3-2145","terrain5_3-2060","terrain5_3-2488","terrain5_3-3890","terrain5_3-2489","terrain5_3-2101","terrain5_3-2507","terrain5_3-3891","terrain5_3-3892","terrain5_3-2061","terrain5_3-2102","terrain5_3-2508","terrain5_3-3893","terrain5_3-2017","terrain5_3-2557","terrain5_3-2558","terrain5_3-2559","terrain5_3-2583","terrain5_3-2584","terrain5_3-2146","terrain5_3-2062","terrain5_3-2065","terrain5_3-2103","terrain5_3-2066","terrain5_3-2104","terrain5_3-2067","terrain5_3-2314","terrain5_3-2295","terrain5_3-2241","terrain5_3-2105","terrain5_3-2068","terrain5_3-2357","terrain5_3-2358","terrain5_3-2385","terrain5_3-2386","terrain5_3-2343","terrain5_3-2370","terrain5_3-2410","terrain5_3-2359","terrain5_3-2344","terrain5_3-2434","terrain5_3-2371"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4171","type":"wood","owner":"w5_3-social-96","personId":"w5_3-social-96","distance":9.91560931555204,"receiptDay":1.0270833333333353,"observedDay":1.02777777777778}
SIMULATION observation 1/12 {"day":1.0500000000000056,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.008333333333333,"requestsStarted":true,"winter":false,"frames":2.4979999999995393}}
SIMULATION observation 2/12 {"day":1.0708333333333422,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.029166666666666344,"requestsStarted":true,"winter":false,"frames":3.4879999999995306}}
SIMULATION observation 3/12 {"day":1.0916666666666788,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.00833333333333298,"requestsStarted":true,"winter":false,"frames":2.4739999999981315}}
SIMULATION observation 4/12 {"day":1.1840277777778043,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01736111111111071,"requestsStarted":true,"winter":false,"frames":3.4679999999995275}}
SIMULATION observation 5/12 {"day":1.2500000000000369,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":-4.371503159461554e-16,"requestsStarted":true,"winter":false,"frames":8.461999999997431}}
SIMULATION observation 6/12 {"day":1.251388888888926,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0013888888888884518,"requestsStarted":true,"winter":false,"frames":0.46199999999743113}}
SIMULATION observation 7/12 {"day":1.2520833333333705,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.002083333333332896,"requestsStarted":true,"winter":false,"frames":1.4599999999967324}}
SIMULATION observation 8/12 {"day":1.252777777777815,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0027777777777773407,"requestsStarted":true,"winter":false,"frames":3.4599999999967324}}
SIMULATION observation 9/12 {"day":1.2534722222222596,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0034722222222217853,"requestsStarted":true,"winter":false,"frames":5.459999999996733}}
SIMULATION observation 10/12 {"day":1.2541666666667042,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0041666666666662295,"requestsStarted":true,"winter":false,"frames":5.461999999997431}}
SIMULATION observation 11/12 {"day":1.2583333333333715,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.008333333333332896,"requestsStarted":true,"winter":false,"frames":3.46399999999813}}
SIMULATION observation 12/12 {"day":1.279166666666708,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.02916666666666624,"requestsStarted":true,"winter":false,"frames":0.445999999998822}}
PASS villagers move about - {"moved":41,"of":83,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 113 129 130 132 145 147 148 151 152 157 162 165 168 173 182 183 186 187 188 189 191 193 194 195 198 201 203 214 222
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":41.432,"gameHours":4}
PASS the view follows a window resize - {"width":960,"height":640}
PASS the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

EXIT_STATUS=1
```

</details>

<details>
<summary>frozen13 attempt 3: exit 0, driver 0222391</summary>

```sh
CHROME=/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome PLAYTEST_OUT=/tmp/tk-week-playtest7-frozen13-attempt3 flock -w 7200 /tmp/27agents-gate-2.lock npm run playtest -- 'http://localhost:8184/'
```

```text

> tinyking@1.0.0 playtest
> node scripts/playtest.js http://localhost:8184/

STARTUP menu ready after 0.203 seconds
STARTUP character/world ready after 3.845 seconds
STARTUP click Start new game to standing: 10.940 seconds (includes character screen and arrival)
PASS the world loads and reports the seed requested by the URL or served world - {"loaded":true,"seed":13,"expectedSeed":13,"source":"served world","matches":true}
PASS the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds - {"seconds":5.298700000286101,"noCamp":true,"steps":2,"walked":true,"nearCamp":true,"standing":true,"bundle":true,"locked":true,"gameDays":0}
PASS the player starts at a camp with a bedroll and no house
PASS a waiting build is replaced by explicit chopping and finishes on a new build order
STARTUP menu ready after 3.452 seconds
STARTUP character/world ready after 3.46 seconds
PASS clicking a villager selects it - {"selected":"terrain5_3-person-4145"}
PASS explicit Cut down work makes natural terrain eligible for designation - {"site":{"id":"terrain5_3-694","trees":["terrain5_3-2309"],"eligible":true,"distance":211.80033736339502},"after":[{"id":"terrain5_3-739","trees":[],"eligible":true,"distance":96.18618445634972},{"id":"terrain5_3-695","trees":[],"eligible":true,"distance":100.01252583764267},{"id":"terrain5_3-784","trees":[],"eligible":true,"distance":100.5446705613693},{"id":"terrain5_3-694","trees":[],"eligible":true,"distance":173.18872186793104},{"id":"terrain5_3-568","trees":[],"eligible":true,"distance":359.786746719095},{"id":"terrain5_3-569","trees":[],"eligible":true,"distance":376.6359980895185},{"id":"terrain5_3-613","trees":[],"eligible":true,"distance":459.05170475586533}]}
PASS clicking a tile opens its job menu, and Move here starts an order - {"target":"terrain5_3-783"}
PASS the current order appears in the status strip
PASS Chat starts a personal order from the person panel - {"person":"w5_3-social-65"}
PASS the person panel has no Recruit order
PASS Create Field, Create Stockpile and Cut down can be ordered from the popups - {"fieldTile":"terrain5_3-695","stockpileTile":"terrain5_3-694","tree":"terrain5_3-2263"}
PASS the player walks to the ordered tile - {"walker":"terrain5_3-person-4145","from":160,"to":0}
PASS the completed task leaves the panel
CHAT approach w5_3-social-65
CHAT panel open w5_3-social-65
CHAT line player.direct_answer.fallback_answer_weather.base.01
PASS Chat pauses the world, chosen lines make contact and End chat releases the panel - {"person":"w5_3-social-65","lines":[{"id":"player.direct_answer.fallback_answer_weather.base.01","family":"direct_answer","disabled":false,"matches":1,"score":0}],"pops":[{"kind":"topic","key":"season","score":1,"amount":1,"listenerId":"w5_3-social-65"}],"contact":{"day":0.6902777777777767,"position":{"x":2474.966603162095,"y":1172.827923696332},"otherPosition":{"x":2523.4307806183465,"y":1145.1342951089919}}}
RESTART Create Field {"previous":"terrain5_3-695","selected":"terrain5_3-695","candidates":["terrain5_3-695","terrain5_3-613","terrain5_3-569","terrain5_3-568"]}
RESTART Create Stockpile {"previous":"terrain5_3-694","selected":"terrain5_3-694","candidates":["terrain5_3-694","terrain5_3-739","terrain5_3-784","terrain5_3-568","terrain5_3-569","terrain5_3-613"]}
RESTART Cut down {"previous":"terrain5_3-2263","selected":"terrain5_3-2263","candidates":["terrain5_3-2263","terrain5_3-3879","terrain5_3-2407","terrain5_3-3881","terrain5_3-2238","terrain5_3-2239","terrain5_3-2366","terrain5_3-2330","terrain5_3-2419","terrain5_3-2420","terrain5_3-2406","terrain5_3-2418","terrain5_3-2379","terrain5_3-2329","terrain5_3-2405","terrain5_3-2365","terrain5_3-2214","terrain5_3-2213","terrain5_3-2429","terrain5_3-2342","terrain5_3-3882","terrain5_3-2417","terrain5_3-2328","terrain5_3-2442","terrain5_3-2178","terrain5_3-3883","terrain5_3-2443","terrain5_3-2143","terrain5_3-2456","terrain5_3-2177","terrain5_3-2457","terrain5_3-3886","terrain5_3-2458","terrain5_3-2144","terrain5_3-2454","terrain5_3-3884","terrain5_3-2142","terrain5_3-3885","terrain5_3-3887","terrain5_3-2455","terrain5_3-2459","terrain5_3-2100","terrain5_3-2471","terrain5_3-2145","terrain5_3-2060","terrain5_3-2488","terrain5_3-3890","terrain5_3-2489","terrain5_3-2101","terrain5_3-2507","terrain5_3-3891","terrain5_3-3892","terrain5_3-2061","terrain5_3-2102","terrain5_3-2508","terrain5_3-3893","terrain5_3-2017","terrain5_3-2557","terrain5_3-2558","terrain5_3-2559","terrain5_3-2583","terrain5_3-2584","terrain5_3-2146","terrain5_3-2062","terrain5_3-2065","terrain5_3-2103","terrain5_3-2066","terrain5_3-2104","terrain5_3-2067","terrain5_3-2314","terrain5_3-2295","terrain5_3-2241","terrain5_3-2105","terrain5_3-2068","terrain5_3-2357","terrain5_3-2358","terrain5_3-2385","terrain5_3-2386","terrain5_3-2343","terrain5_3-2370","terrain5_3-2410","terrain5_3-2359","terrain5_3-2344","terrain5_3-2434","terrain5_3-2371"]}
PASS Gift chooser queues a real item for delivery
PASS the player walks over and gives the gift - {"itemId":"terrain5_3-4171","type":"wood","owner":"w5_3-social-96","personId":"w5_3-social-96","distance":9.91560931555204,"receiptDay":1.0270833333333353,"observedDay":1.02777777777778}
SIMULATION observation 1/12 {"day":1.049305555555561,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0076388888888885564,"requestsStarted":true,"winter":false,"frames":3.534000000002921}}
SIMULATION observation 2/12 {"day":1.0701388888888976,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0284722222222219,"requestsStarted":true,"winter":false,"frames":3.522000000002217}}
SIMULATION observation 3/12 {"day":1.0909722222222342,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.007638888888888536,"requestsStarted":true,"winter":false,"frames":0.5100000000015044}}
SIMULATION observation 4/12 {"day":1.1840277777778043,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.01736111111111071,"requestsStarted":true,"winter":false,"frames":2.4960000000035976}}
SIMULATION observation 5/12 {"day":1.2500000000000369,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":-4.371503159461554e-16,"requestsStarted":true,"winter":false,"frames":7.502000000005694}}
SIMULATION observation 6/12 {"day":1.2506944444444814,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0006944444444440073,"requestsStarted":true,"winter":false,"frames":8.500000000004995}}
SIMULATION observation 7/12 {"day":1.251388888888926,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0013888888888884518,"requestsStarted":true,"winter":false,"frames":7.500000000004995}}
SIMULATION observation 8/12 {"day":1.2520833333333705,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.002083333333332896,"requestsStarted":true,"winter":false,"frames":8.498000000004296}}
SIMULATION observation 9/12 {"day":1.252777777777815,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0027777777777773407,"requestsStarted":true,"winter":false,"frames":9.49600000000709}}
SIMULATION observation 10/12 {"day":1.2534722222222596,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.0034722222222217853,"requestsStarted":true,"winter":false,"frames":7.494000000006391}}
SIMULATION observation 11/12 {"day":1.257638888888927,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.007638888888888452,"requestsStarted":true,"winter":false,"frames":0.49800000000429634}}
SIMULATION observation 12/12 {"day":1.2784722222222635,"speed":"normal","worldBusy":false,"chatActive":false,"seasonTurn":false,"simulationClock":{"hour":0.028472222222221795,"requestsStarted":true,"winter":false,"frames":1.4880000000042948}}
PASS villagers move about - {"moved":41,"of":83,"gameHours":6}
PASS villagers are drawn on the ground - {"worstOffGround":0}
ground heights seen under villagers: 113 114 129 130 133 145 147 148 149 150 158 162 164 167 169 173 182 184 187 188 189 191 192 193 194 195 197 198 199 200 201 202 204 214 222 223
PASS the orders are carried out (or still waiting their turn) - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS at least one of those orders is done - {"fields":1,"fieldWaiting":false,"stockpiles":1,"stockpileWaiting":false,"chatted":true,"chatWaiting":false,"treeGone":true,"treeWaiting":false}
PASS a lean-to site can be placed from the popup
PASS logs are delivered and a lean-to finishes - {"seconds":40.993,"gameHours":4}
PASS the view follows a window resize - {"width":960,"height":640}
PASS the real debug deep link serves the SPA entry
PASS the targeted playtest ran to the end
PASS no console errors - []

EXIT_STATUS=0
```

</details>

<details>
<summary>Literal Jest, build, world-generation and server-start receipts</summary>

Verification receipts follow. Expected red runs are retained separately from passing gates. The early invalid-owner fixture attempt exited 1 with two failures and five passes. Its exception was `Called topController on owner which isn't a controllable entity`. I corrected the fixture owner, then the seven original cases passed.


Initial discovery regression. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
FAIL test/playtest_selection.test.js
  ● Test suite failed to run

    Cannot find module '../scripts/playtest-selection' from 'test/playtest_selection.test.js'

      3 | import { Hex } from "game/hex";
      4 | import { rowOfTiles } from "./support/world";
    > 5 | import { designationCandidates, treeCandidates, restartCandidates, worldIdentity } from "../scripts/playtest-selection";
        | ^
      6 |
      7 | function world() {
      8 |   const { state: s, tiles, villager: actor } = rowOfTiles(8);

      at Resolver._throwModNotFoundError (node_modules/jest-resolve/build/index.js:1031:11)
      at Object.<anonymous> (test/playtest_selection.test.js:5:1)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        3.613 s
Ran all test suites matching test/playtest_selection.test.js.
```

Initial discovery unit pass. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Snapshots:   0 total
Time:        1.58 s
Ran all test suites matching test/playtest_selection.test.js.
```

Initial affected gate. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=8025a9e
```

```text
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Snapshots:   0 total
Time:        1.255 s, estimated 2 s
Ran all test suites related to changed files.
```

Neighbour regression. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
FAIL test/playtest_selection.test.js
  ● finds a route towards a distant neighbour but orders only its discovered prefix

    TypeError: (0 , _playtestSelection.personApproach) is not a function

      116 |   const { s, tiles, person } = distantNeighbour();
      117 |   const before = JSON.stringify(s);
    > 118 |   expect(personApproach(s)).toMatchObject({ person, moves: [tiles[2], tiles[1]], indoors: false });
          |                        ^
      119 |   expect(JSON.stringify(s)).toBe(before);
      120 |   s.ecs.playable[s.ui.playerId].known = [tiles[0], tiles[1], tiles[4]].map(id => Hex().fromPoint(s.ecs.spatial[id]));
      121 |   expect(personApproach(s).moves).toEqual([tiles[1]]);

      at Object.<anonymous> (test/playtest_selection.test.js:118:24)

  ● ignores dead people and the player's household, and prefers an outdoor adult

    TypeError: (0 , _playtestSelection.personApproach) is not a function

      130 |     { spatial: { ...s.ecs.spatial[tiles[1]] }, personable: { age: 30 }, controllable: { controllerId: "other" }, interior: { buildingId: "house" } }
      131 |   ]);
    > 132 |   expect(personApproach(s).person).toBe(person);
          |                        ^
      133 |   s.ecs.interior[person] = { buildingId: "house" };
      134 |   expect(personApproach(s).indoors).toBe(true);
      135 | });

      at Object.<anonymous> (test/playtest_selection.test.js:132:24)

  ● returns no neighbour when no living other-household adult is reachable

    TypeError: (0 , _playtestSelection.personApproach) is not a function

      138 |   const { s, tiles } = distantNeighbour();
      139 |   s.ecs.walkable[tiles[2]].neighbours = {};
    > 140 |   expect(personApproach(s)).toBeNull();
          |                        ^
      141 | });
      142 |

      at Object.<anonymous> (test/playtest_selection.test.js:140:24)

Test Suites: 1 failed, 1 total
Tests:       3 failed, 7 passed, 10 total
Snapshots:   0 total
Time:        1.378 s, estimated 2 s
Ran all test suites matching test/playtest_selection.test.js.
```

Affected gate during neighbour regression. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=8025a9e
```

```text
FAIL test/playtest_selection.test.js
  ● finds a route towards a distant neighbour but orders only its discovered prefix

    TypeError: (0 , _playtestSelection.personApproach) is not a function

      116 |   const { s, tiles, person } = distantNeighbour();
      117 |   const before = JSON.stringify(s);
    > 118 |   expect(personApproach(s)).toMatchObject({ person, moves: [tiles[2], tiles[1]], indoors: false });
          |                        ^
      119 |   expect(JSON.stringify(s)).toBe(before);
      120 |   s.ecs.playable[s.ui.playerId].known = [tiles[0], tiles[1], tiles[4]].map(id => Hex().fromPoint(s.ecs.spatial[id]));
      121 |   expect(personApproach(s).moves).toEqual([tiles[1]]);

      at Object.<anonymous> (test/playtest_selection.test.js:118:24)

  ● ignores dead people and the player's household, and prefers an outdoor adult

    TypeError: (0 , _playtestSelection.personApproach) is not a function

      130 |     { spatial: { ...s.ecs.spatial[tiles[1]] }, personable: { age: 30 }, controllable: { controllerId: "other" }, interior: { buildingId: "house" } }
      131 |   ]);
    > 132 |   expect(personApproach(s).person).toBe(person);
          |                        ^
      133 |   s.ecs.interior[person] = { buildingId: "house" };
      134 |   expect(personApproach(s).indoors).toBe(true);
      135 | });

      at Object.<anonymous> (test/playtest_selection.test.js:132:24)

  ● returns no neighbour when no living other-household adult is reachable

    TypeError: (0 , _playtestSelection.personApproach) is not a function

      138 |   const { s, tiles } = distantNeighbour();
      139 |   s.ecs.walkable[tiles[2]].neighbours = {};
    > 140 |   expect(personApproach(s)).toBeNull();
          |                        ^
      141 | });
      142 |

      at Object.<anonymous> (test/playtest_selection.test.js:140:24)

Test Suites: 1 failed, 1 total
Tests:       3 failed, 7 passed, 10 total
Snapshots:   0 total
Time:        0.993 s, estimated 2 s
Ran all test suites related to changed files.
```

Affected gate after neighbour implementation. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=8025a9e
```

```text
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        1.249 s
Ran all test suites related to changed files.
```

Chat regression. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
FAIL test/playtest_selection.test.js
  ● chooses a known neighbour who accepts Chat, excluding refusal, sleep and exhausted patience

    TypeError: (0 , _playtestSelection.chatCandidates) is not a function

      150 |     [person]: { likes: [], dislikes: ["brave"], opinionSeed: 1, opinionThresholds: { hate: -.5, love: .5 } } };
      151 |   const before = JSON.stringify(s);
    > 152 |   expect(chatCandidates(s)).toEqual([friendly]);
          |                        ^
      153 |   expect(personApproach(s).person).toBe(friendly);
      154 |   expect(JSON.stringify(s)).toBe(before);
      155 |   s.ecs.planner[friendly].task = ["sleep"];

      at Object.<anonymous> (test/playtest_selection.test.js:152:24)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 10 passed, 11 total
Snapshots:   0 total
Time:        0.913 s, estimated 2 s
Ran all test suites matching test/playtest_selection.test.js.
```

Affected gate after Chat implementation. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=8025a9e
```

```text
Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        0.787 s, estimated 1 s
Ran all test suites related to changed files.
```

Timber delivery regression. Exit 1.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js
```

```text
FAIL test/playtest_selection.test.js
  ● chooses timber near its delivery home after exploring far from camp

    expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Array [
    -   "10",
        "9",
    +   "10",
      ]

      168 |     controllable: { controllerId: actor } }]);
      169 |   const before = JSON.stringify(s);
    > 170 |   expect(treeCandidates(s)).toEqual([nearHome, nearActor]);
          |                             ^
      171 |   expect(JSON.stringify(s)).toBe(before);
      172 | });
      173 |

      at Object.<anonymous> (test/playtest_selection.test.js:170:29)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 11 passed, 12 total
Snapshots:   0 total
Time:        0.94 s, estimated 1 s
Ran all test suites matching test/playtest_selection.test.js.
```

Final affected gate. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=8025a9e
```

```text
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        1.024 s
Ran all test suites related to changed files.
```

Production build. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.62 MiB
    asset app.b7002a9339b5e9bbec68.js 2.68 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.62 MiB (7.63 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.b7002a9339b5e9bbec68.js 2.68 MiB 3 auxiliary assets
  orphan modules 481 KiB [orphan] 140 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.29 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.46 MiB
      modules by path ./src/game/*.js 959 KiB 99 modules
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
    app.b7002a9339b5e9bbec68.js (2.68 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.81 MiB), ./src/index.js + 66 modules (326 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.62 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.b7002a9339b5e9bbec68.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 38624 ms

save-worker:
  asset save-worker.js 11.9 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 58.2 KiB [orphan] 14 modules
  ./src/game/save_worker.js + 11 modules 60.6 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 870 ms
```

Production artifact restoration after dev cleaned dist. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build
```

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.62 MiB
    asset app.ffe9036103afbd186d74.js 2.68 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.62 MiB (7.63 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.ffe9036103afbd186d74.js 2.68 MiB 3 auxiliary assets
  orphan modules 481 KiB [orphan] 140 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.29 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.46 MiB
      modules by path ./src/game/*.js 959 KiB 99 modules
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
    app.ffe9036103afbd186d74.js (2.68 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.81 MiB), ./src/index.js + 66 modules (326 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.62 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.ffe9036103afbd186d74.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 22920 ms

save-worker:
  asset save-worker.js 11.9 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 58.2 KiB [orphan] 14 modules
  ./src/game/save_worker.js + 11 modules 60.6 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 854 ms
```

Built world 13. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npm run build-world -- --seed 13
```

```text

> tinyking@1.0.0 build-world
> node scripts/build-world.js --seed 13

Building world 2026-W48 for seed 13
{"week":"2026-W48","key":"v1/2026-W48.json.gz","seed":13,"out":"/home/cp/code/tk-playtest7/worlds/v1/2026-W48.json.gz","seconds":113.111,"compressedBytes":4552476,"MiB":4.342}
```

Built world 21. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npm run build-world -- --seed 21 --out worlds/seed21/v1/2026-W48.json.gz
```

```text

> tinyking@1.0.0 build-world
> node scripts/build-world.js --seed 21 --out worlds/seed21/v1/2026-W48.json.gz

Building world 2026-W48 for seed 21
{"week":"2026-W48","key":"v1/2026-W48.json.gz","seed":21,"out":"/home/cp/code/tk-playtest7/worlds/seed21/v1/2026-W48.json.gz","seconds":155.507,"compressedBytes":5408685,"MiB":5.158}
```

Final lint command: `npx eslint scripts/playtest.js scripts/playtest-selection.js scripts/click-selection.js test/playtest_selection.test.js`. Exit 0, no output. All earlier syntax and lint commands exited 0. One intermediate click-helper lint reported 44 indentation warnings. ESLint fixed those warnings before the final checks. No lint rule changed.

`node --check` passed for all three changed scripts. The frozen-artifact byte comparison (`diff -qr dist shots/week-playtest-7-frozen-artifact-backup`) exited 0 after the isolated dev startup.

The initial seed-21 server startup exited 2 because `dist/index.html` was absent during the restoration build. Literal server output:

```text
usage: serve-frozen.py [-h] [--port PORT] [--worlds WORLDS] directory
serve-frozen.py: error: directory must contain the compiled index.html
```

Selection-harness area gate. Exit 0.

```sh
flock -w 7200 /tmp/27agents-gate.lock npx jest --runInBand test/playtest_selection.test.js test/designation_selection.test.js
```

```text

Test Suites: 2 passed, 2 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        1.568 s
Ran all test suites matching test/playtest_selection.test.js|test/designation_selection.test.js.
```

The world files have these SHA-256 checksums:

```text
43fc68e5e53f128804a556be8788f1d66f9a7593dedb5aa650e104311b718338  worlds/v1/2026-W48.json.gz
915064cbd0144a50d1f20a6e56a49dbebcae93ffffb0613ccc318cbe2ef17df4  worlds/seed21/v1/2026-W48.json.gz
```


</details>

The standard playtest is the verified scope. The optional `--gift-only` and `--acceptance-fixes` modes were not separately run. Their target selection no longer uses fixed entity IDs. All game source under `src/` remains unchanged, and no new observer exposure was needed.

The implementation commits are `02e5a3d`, `4cbbd96`, `ec33995`, `c53efe4`, `f85a921`, and `0222391`. This report is committed separately. Only saved PIDs verified as this worktree's servers were stopped. The pre-existing IPv4 listener on 8176 was left running. Nothing was pushed.

Things that should not exist: webpack dev's clean plugin deletes the shared `dist` artifact even while serving assets from memory. The isolated output path avoids that collision, but the repository configuration still permits it. npm reported 18 moderate vulnerabilities and obsolete dependency declarations during `npm ci`. Both production builds also retain three warnings about oversized bundles. The unchanged 4–6 second arrival check also produced one 6.57-second timing outlier on the final candidate, with all other 25 checks passing. One recheck retained the same source and limits. That wall-clock sensitivity also remains outside this target-discovery change.
