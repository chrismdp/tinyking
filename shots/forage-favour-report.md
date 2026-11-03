# Forage and promised food

Forage now keeps an accepted food favour and resumes its delivery after gathering. The boundary checks pass for roots, berries, and a favour with one portion already delivered. Guidance and popup titles no longer append entity IDs. Picked plants explain their missing Forage action. In production Chromium on seed 13, the original food favour completed with three stored roots and an observed +12 goodwill change.

Production source: `35f4cfd748eab532c4b4b942e7d9610599156a7f`, on `fix/forage-favour`, based on `27931032814eff9e4fd2370541f308db5d279a16`.

## Cause and changes

`enqueueTask` cancelled every existing order through `cancelTask`. That function also called `cancelFavour` for the accepted delivery. Following the supply hint therefore cancelled the promise before gathering started, including after partial delivery.

`src/game/manager.js` now retains the accepted delivery when the new order supplies its material: Forage for food, or Cut down for wood. The supply order runs first. An active delivery releases its planner assignment so gathering can start. The same favour task then resumes with its previous progress and receipts. Other replacement orders and explicit cancellation retain their existing rules.

`src/game/guidance.js` removes IDs from shelter, field, seed and approach instructions. Their existing buttons still select the intended entities. `src/components/info.js` removes the ID suffix from popup titles. IDs remain available through the debug disclosure. Exhausted plants show “Picked clean. Food regrows in the growing season.” `docs/favours.md` describes the supply-order rule.

## Tests and build

The first regression used the six-tile `peopleWorld` fixture through real acceptance, queued Forage orders and simulation steps. It checked delivered food, household stores, receipts, completion, goodwill and a single completion event. It covered roots and berries with zero or one portion already delivered. No completion or goodwill was injected.

| Check | Result | Exit |
| --- | --- | --- |
| Before fix, food regressions | 4 failed, 50 skipped, 54 total in 1 suite; each received `cancelled` instead of `accepted` | 1 |
| Focused checks after fix | 61 passed, 0 failed, 0 skipped in 3 suites | 0 |
| Affected gate, base `2793103` | 1,360 passed, 0 failed, 0 skipped in 138 suites | 0 |
| ESLint on three changed source files | 0 errors, 0 warnings | 0 |
| Production build | App and save worker compiled; 3 webpack bundle-size warnings | 0 |
| Seed-13 history before and after | Both 199,928,327 bytes; matching SHA-256 | 0 each |
| Direct comparison of complete history JSON | Byte-identical | 0 |
| Browser receipt assertions | 21 passed, 0 failed | 0 |
| Interactive browser process | Completed; 8 failed driver commands retained below | 0 |

The affected gate used the import-graph selector from `scripts/history-cpu-gate.cjs`. A copy under `.cache/forage-favour/affected-gate.cjs` changed only the hard-coded base to `2793103` and output paths into this task's cache. Its selection logic and Jest options stayed unchanged. The selected-file list and exact command are in `affected-affected-files.txt` and `affected-affected-receipt.json` under that cache directory. Every Jest run used `/tmp/27agents-gate-2.lock`. No whole-suite command ran. There is no TypeScript configuration or typecheck script in this JavaScript project. ESLint and production compilation covered the touched source.

The focused command was:

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/favours.test.js test/forage_orders.test.js test/chat_guidance.test.js --runInBand --json --outputFile=.cache/forage-favour/green-tests.json
```

Five new favour cases were added. Existing favour assertions were not changed. The shelter-guidance test gained an assertion for its exact text and retained its placement check. The affected gate also passed the existing cancellation, ownership, food conservation and history tests.

The history probe called `generateWorldHistory(state, 13)` on a fresh empty state and serialised the complete state with `JSON.stringify`. It applied no sorting, projection or filtering. The complete before and after files compare equal. SHA-256:

```text
5c22e0dcd4489c73646701b29ed3823e7d5e35097a95e6a4e30bf63621d7f5e2
```

`src/game/world_history.js` was not edited. Its Git object remains `113f0e4fa0c4724cdd437dc69de7c82ad60f561a`.

## Production browser

The frozen `dist/` build ran in headless Chromium `156.0.8078.4` at 1440 × 900. `scripts/serve-frozen.py` served port **8187**. The URL was `http://127.0.0.1:8187/?seed=13&intro=skip`. `dist/COMMITHASH` matched the production source above. Source stayed frozen throughout play. No development server or debug simulation exports were used.

The driver reused the React state-reference lookup from `scripts/step8-measure.cjs`. It exposed that existing reference to its observer without changing game records. Selection used public `ui.actions` and camera focus. Chat replies, Forage, the journal and Show shelter tile used actual UI clicks or keys. Simulation ran through the normal ticker at Normal speed. Paused conversations and inspections stopped the ticker to avoid rendering the unchanged scene, then resumed it for walking, gathering and delivery. No goods, needs, relationships, progress, events or completion states were injected. There was one generated seed-13 play session.

I followed the opening Chat button to Geoffrey Jobari, answered his greeting and introduced the player's mother. Geoffrey recognised his nephew and offered: “I don't like to ask. Could you bring us three portions?” I selected “I'll bring three portions.” This accepted `terrain5_3-favour-1`, the same request identity as the first reported failure.

The supply hint led to Wild Roots `terrain5_3-4057`, also the original reported plant. I selected it and clicked Forage. The accepted delivery remained behind the gathering order. Its first root reached `w5_3-store-12`. I repeated Forage on the available roots `terrain5_3-4028` and `terrain5_3-4029`. The second and third orders retained the same favour task, `task-2`, with one and two portions already delivered.

The favour completed at game day `0.7004633333319236`, about 4:48pm on the first day. All three distinct root portions have stored-delivery receipts from the player to the requesting pantry. The pantry held three roots. All three plants had amount zero. The observation trace contains only `accepted` and `completed` statuses, with deliveries 0, 1, 2 and 3. The task retired and one favour event recorded twelve goodwill. Consecutive observer frames captured Geoffrey's goodwill changing from `34.55000000000001` to `46.55000000000001`: exactly **+12**. The journal showed “Completed · +12 goodwill with the requester”.

The resulting shelter hint selected `terrain5_3-786`, the same tile cited in the report. Its player-facing title was “Grassland”, without the ID. Debug remained collapsed. The requested screenshots were opened and inspected.

| Screenshot | Evidence |
| --- | --- |
| [Food offer](../.cache/forage-favour/food-offer.png) | Spoken request and acceptance choice |
| [Food supply hint](../.cache/forage-favour/food-supply-hint.png) | Waiting delivery and exact forage instruction |
| [Wild Roots popup](../.cache/forage-favour/wild-roots-popup.png) | ID-free title and Forage button |
| [Picked Roots popup](../.cache/forage-favour/picked-roots-popup.png) | Picked explanation and no Forage action |
| [Completed favour in journal](../.cache/forage-favour/completed-favour-journal.png) | Completed request and +12 goodwill outcome |
| [Shelter hint and popup](../.cache/forage-favour/shelter-hint-and-popup.png) | ID-free instruction and Grassland title |

Exact visible strings:

- Food hint: “Select a forage plant and choose Forage to supply your promised food.”
- Shelter hint: “Select grassland near camp and choose Build shelter before night.” Its button says “Show shelter tile”.
- Full plant popup: “Wild Roots”, “Forage”, and “(debug)”.
- Picked plant popup: “Wild Roots”, “Picked clean. Food regrows in the growing season.”, and “(debug)”.
- Shelter tile popup: “Grassland”, “marsh mix”, “Temperature: temperate”, and “World hex: jungle (neutral, hot, wet)”. Its buttons say “Move here” and “Build shelter”, followed by “(debug)”.
- Completed journal outcome: “Completed · +12 goodwill with the requester”.

The driver retained **eight failed commands**. The first navigation found that the initial background server had exited. A managed server session fixed that. Two probes assumed the development state export, then switched to the existing production React lookup. Three 5-second click acknowledgements timed out while rendering the paused chat. The first reply did take effect. Stopping its paused ticker allowed the remaining UI clicks. One read used `.popup` instead of `.popper`. The third delivery's 60-second observation expired with the third root still carried and two receipts recorded. Continuing that same order completed the handover after another 39 seconds of game time. No timeout was increased and no scenario was reset. The page-error listener recorded the same erroneous `generating` probe exception once. No other page errors were recorded.

The incomplete third-delivery image remains as [third-portion-still-carried-journal.png](../.cache/forage-favour/third-portion-still-carried-journal.png). The first completed image had the journal disclosure collapsed and remains as [completed-favour-journal-collapsed.png](../.cache/forage-favour/completed-favour-journal-collapsed.png). The final screenshot opens that disclosure. Raw commands and errors remain in [browser-receipt.json](../.cache/forage-favour/browser-receipt.json). The terminal state, trajectory and goodwill frames are in [final-observation.json](../.cache/forage-favour/final-observation.json). The 21 assertion results are in [browser-checks.json](../.cache/forage-favour/browser-checks.json).

## Delivery and limits

Commit `35f4cfd` contains the green implementation, boundary regressions, guidance assertion and favour documentation. This report is committed separately after acceptance evidence. The required loop and both guidance issues are proved on the frozen production build. The browser run covers desktop seed 13. Berries and the wood supply route have boundary-test coverage, not an additional browser playthrough.

Dependencies were already installed and were not changed. No whole-suite run, delegation, push, stash, other-branch inspection or outside-worktree write was performed. All screenshots, browser temporary files and probe receipts stay under `.cache/forage-favour/`. The frozen server was stopped using its saved and verified PID `1025039`. The stop command exited 0. The serving wrapper exited 143 from that deliberate SIGTERM. Chromium and its interactive driver closed with exit 0. No unrelated process was stopped. No gameplay acceptance criterion remains unresolved.
