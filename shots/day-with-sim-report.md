# The day spent with people: simulation report

The chosen-outcome test failed in seed 13. The replay changed community events but achieved no planned peace or introduction. Both games used the same generated starting state and played 42 choices through two calendar seasons. Their event records differ. The general helpful policy achieved a completed intervention in 0 of ten specified seeds. These results test this policy, not every possible way to play.

Neither intervention became available in any survey seed. The rules work in small-world tests, but this helpful policy does not reliably earn the trust and timing they require. The idea is therefore not demonstrated across these ten seeds.

Base: `a2c0cba`. Branch: `day-with`. Fixed-step first commit: `3d01265`. Day and social rules: `a3ad541`. Runtime corrections end at `0744eef`. The API and test notes precede the measured proofs.

## API and rules

`slotChoices(game)` returns `{day, slot, endsAt, places, choices}`. A place is a discovered walkable map tile. Its people are there now or walking there through an existing plan. Each choice contains `id`, `placeId`, `personId`, `activity`, `available` and a reason. Pair choices also contain `otherId`. Work choices identify a real spoken request. Food choices identify a real owned portion. Listing choices grants no names, events, offers or relationship changes.

`playSlot(game, choice, hooks)` refreshes the menu and rejects invented, stale or unavailable choices. It queues orders through `enqueueTask`, then runs `createSimulation().tick()`. That is the same one-minute transition that the live browser uses. Real walks discover ground and consume game time, without a rendering step. Chat uses the real panel state and authored lines. `hooks.chooseLine(game, lines, choice)` returns an offered line key, an offered line object, or `null` to end. The default selects visible matches and learned tastes, and ends when fresh lines run out.

The result contains the chosen slot, start and end times, newly known events, changed knowledge facts, changes in regard towards the player, actual conversation transcripts and unfinished-task reasons. It does not return unheard community news. The research driver records community observations separately. A quiet place also offers a visit so that the player can discover more ground when nobody can stop.

Morning ends at noon. Afternoon ends at six. Evening company ends at nine, then a real rest order runs through the night to six. The arrival morning starts at nine. The existing season clock advances ageing, deaths, births, courtships and moves. The day runner acknowledges the existing season account and returns its lines. It does not replace seasonal simulation.

Making peace requires Personal trust from both parties towards the helper, within their fixed disposition caps. The helper must know the quarrel and complete a conversation with each person after it. A successful request expires avoidance and supplies the ordinary visit plans. The request records no reconciliation or goodwill reward. The next real contact uses the existing `reconcile` action and its once-per-season attempt record. Fixed hate still caps trust at Public.

Introducing two people requires the same trust, existing `eligiblePartner` rules, reciprocal orientation compatibility and willingness. It also requires available planners, satisfied needs, reachable destinations and enough daylight to arrive and talk. It supplies the same visit plans as autonomous company. After a real half-hour courting contact, `tasks.socialise` calls `courtTogether` with fractional season time. The existing consent, waiting period, recent-contact and housing rules still decide marriage.

Working uses real offered harvest or fuel favours. Asking about a favour is the existing help subject in conversation. Accepting a spoken offer authorises actual work and delivery. Harvest keeps the existing gleaning share. The existing simulation also retains friend help, social visits, food, travel and offscreen seasonal updates. No duplicate planner, conversation, gift or marriage system was added.

The new regressions were written before their relevant implementation. The frame-cadence regression first produced different dates and positions, then passed for a full week at 10 ms and 100 ms. Other regressions cover hidden ground, unavailable orders, actual lines and learned facts, real food transfer, three slots and overnight rest, seasonal ageing, harvest conservation, a completed introduction, trust, post-quarrel conversations, the hate cap, seasonal reconciliation limits, kinship, orientation, hunger, busy planners, routes and courtship waits. Additional fixtures exercise actual delivery and the season boundary.

The first implementation exposed two rounding boundaries: noon and the completed half-hour contact. Both now use the existing small clock tolerance. Old assertions for partial simulation frames now allow complete minutes to accumulate. Other assertions remain intact. An extra harvest assertion accounts for the real helper's grain rather than assuming all produce enters the family pantry.

The first seed-13 diagnostic generated its starting graph in 367,886 ms, then did not complete a slot. A regression confirmed that the default picker could repeat fallback lines. It now ends when only spoken lines remain. A live inspector sample in a second slow run found repeated food inventory scans in conversation choices. A small-world regression counted 298 scans for one query. The existing favour code now shares one food snapshot during a synchronous choice calculation and discards it before mutation. The tests also require stable choices and fresh results after food stores change.

Dependency setup ran first: `npm ci` added 1,056 packages and audited 1,057 in three minutes. No dependency file changed. Focused checks passed before the affected gate: 17 fixed-clock tests, then 111 chat, favour, day and intervention tests. Raw failing and passing logs remain in `.cache/day-with/`. The receipts below distinguish the broad affected gate from later targeted rechecks.

A survey pilot also found that a quiet first slot left the helpful policy with an empty target list forever. A failing policy test reproduced this. The corrected policy selects targets when people later become visible. Pilot logs remain separate from final counts. The seed-13 replay already had two remembered targets, so that correction does not alter its decisions.

The policy extraction initially omitted its pair-key helper. Its regression caught the error. One survey bundle started before that check finished and retained the omission. That partial run was stopped by its recorded PID. The final pipeline requires the policy test to pass before it builds and runs the corrected bundle. This was a driver error, not a simulation outcome. The runtime stayed frozen.

The first affected gate retained 1,379 passing tests and exposed nine failing files, including an added regression. The fixed browser wrapper now preserves explicit zero-wall-time headless calls, advances the arrival presentation in real time, and commits completed travel inputs while paused without an extra planner step. Three old observation tests now request a full game quantum. The walking-departure test observes actual `leave_edge` execution rather than a brief task sampled after a six-minute frame. All original outcome assertions remain.

Seasonal checks then exposed an hourly timestamp of `6.999999999999999`. A new regression reproduced it. Fresh clocks now align to world hours and stamp those hours exactly. The lifecycle, succession and travel checks then passed: 34 tests in three files. Because canonical hour dates feed seeded schedules and seasonal rules throughout the graph, the full affected gate and the real-game proofs were repeated after this correction. Earlier runs remain labelled as pre-correction evidence.

The final default-picker regression supplied a row with no space for an introduction. The old default selected that introduction because it ranked the subject above fit. The regression first failed. The default and the research callback now require `previewLine(...).fits`, the same rule that actual speech uses. They still answer pending questions and use only real offered lines. The final proof bundle includes this correction.

The final affected gate passed 143 files and 1,391 tests. The final picker and clock check passed another 23 focused tests, including the newly added fit regression. The production build passed. The affected Jest process reported a worker shutdown warning despite exit 0. Its full output is retained below. No handle audit or whole-suite run was added.

The seed-7 survey found a separate housing error after the first season. An unrelated cross-hex wedding moved a camping player because the transfer sweep treated a non-building household as foreign. A failing small-world regression confirmed the player's removal. The corrected sweep requires the selected home to belong to the destination community. The regression retains a real wedding and checks the camper's residence, position, discovery and usable day menu. Earlier complete games and the partial survey were preserved separately before the final batch was repeated. The fix then passed 98 tests across the five affected marriage, travel and day files. The final browser production build and headless bundle both passed after that correction.

Existing test edits are limited to the clock contract and observing actual execution:

| Existing file | Change and retained evidence |
| --- | --- |
| `simulation.test.js` | Two frame units now accumulate without advancing. Another eight advance one minute. Added fresh-hour and exact-season regressions. |
| `player_day.test.js` | The awake-night sample requests ten frame units and expects sixty game seconds. Chat and pause still stop sleep. |
| `background_checkpoint.test.js` | Calls one complete tick after arrival. Time must still resume only after the checkpoint. |
| `fireside.test.js` | Calls one complete tick. The exhausted traveller must still settle a fire without household sleep. |
| `first_run.test.js` | Calls one complete tick after the arrival handover. Ownership, camp state and resume assertions remain. |
| `world_journeys.test.js` | Observes actual `leave_edge` calls because a six-minute frame can contain the entire task. Keeps active-hex, seasonal catch-up and recorded-arrival assertions. |
| `nearby_courtship.test.js` | Adds the camping-player wedding regression. Existing marriage assertions are unchanged. |

The `ask_favour` activity asks about current household help through the existing conversation subject. A spoken offer can authorise real collection, work and delivery. It is not a new command that orders a villager to work for the player. Existing friend help remains automatic and conditional on the player's real field or building work. A later screen should label this activity “Ask about help” to match its actual behaviour.

The auxiliary “unfinished” outcome follows the retained order’s progress. Some rows still have this mark after an actual gift event, with “They accepted your gift” as the last message. Treat that mark as queue progress. The gift and favour counts in the proofs use real completion events and the counts of conversations use the real completed-contact flag.

## Same seed, different choices

Both games restore `.cache/day-with/initial-13.bin`, through the game's own save and restore functions. The baseline asks about ordinary help and visits different neighbours. The second game remembers only facts the first player learned. It tries to earn trust through actual conversation lines, gifts and offered work, then selects any available peace or introduction. No player action changes a need, relationship, identity, resource or event directly.

The first player learned quarrels involving: Geoffrey Jobari, Hugh Jobari. The replay's final priority pair was Geoffrey Jobari / Hugh Jobari. The policies use spoken food needs and learned topic and mood tastes. A blocked or unreached conversation earns no contact.

| Measure | Baseline | Learned replay |
| --- | ---: | ---: |
| visit | 282 | 263 |
| gift | 0 | 1 |
| favour | 0 | 0 |
| quarrel | 17 | 26 |
| reconciliation | 13 | 21 |
| marriage | 2 | 0 |
| move | 4 | 2 |
| birth | 3 | 3 |
| death | 2 | 2 |
| Final day value | 14.250000 | 14.250000 |

Baseline choices: {"ask_favour":41,"visit":1}. Replay choices: {"ask_favour":39,"visit":2,"give_food":1}. These counts distinguish selected activity from completed work.

| Remembered person | Baseline final regard towards player | Replay final regard towards player |
| --- | --- | --- |
| Geoffrey Jobari | social, 36.0 | public, 6.5 |
| Hugh Jobari | personal, 41.7 | intimate, 186.4 |

The values are goodwill. The ring is the actual rule for trust. In this replay Geoffrey was Personal on the first day, then fell to Social on day 4 and Public on day 10. Recorded matches on help, village and family exchanges often reduced regard. The policy kept seeking help and exhausting fresh lines after profitable exchanges; it did not reliably stop before those losses. Hugh's strong trust alone could not meet the two-person rule. This is a concrete weakness of the tested policy, not evidence that every informed human strategy would fail. No further policy tuning or replay was used to seek a success.

The baseline is an ordinary-help policy, not a guarantee of completed paid work. The completed-contact and resource evidence below shows what it actually managed. The event totals above are community observations. A slot returns only events the player knows. The raw logs keep those two sets separate. Differences below count event kinds and people, including repeated events. They exclude simple time and event-ID changes. Changes can spread through needs and meeting schedules, so a different event is not automatically the intended outcome.

| Day | Baseline choices | Learned choices | Different community records | Contact and task evidence (baseline → replay) | Chosen social result |
| --- | --- | --- | ---: | --- | --- |
| 1 | Ask about help with Hugh Jobari; Ask about help with Geoffrey Jobari; Ask about help with Andrew Jobari | Ask about help with Geoffrey Jobari; Ask about help with Hugh Jobari; Ask about help with Geoffrey Jobari | 40 | 3 completed conversations, 2 orders marked unfinished → 3 completed conversations, 2 orders marked unfinished | No intervention completed |
| 2 | Ask about help with Hugh Seesi; Ask about help with Simon Seesi; Ask about help with Agnes Friforrin | Ask about help with Hugh Jobari; Ask about help with Geoffrey Jobari; Ask about help with Hugh Seesi | 22 | 2 completed conversations → 1 completed conversation, 1 order marked unfinished | No intervention completed |
| 3 | Ask about help with Mabel Frifoblo; Ask about help with Hugh Jobari; Visit | Ask about help with Hugh Jobari; Visit; Visit | 0 | 2 completed conversations, 1 order marked unfinished → 1 completed conversation, 1 order marked unfinished | No intervention completed |
| 4 | Ask about help with Simon Seesi; Ask about help with Geoffrey Jobari; Ask about help with Simon Seesi | Ask about help with Geoffrey Jobari; Ask about help with Geoffrey Jobari; Ask about help with Hugh Jobari | 68 | 1 completed conversation, 2 orders marked unfinished → 2 completed conversations, 1 order marked unfinished | No intervention completed |
| 5 | Ask about help with Ralph Thuson; Ask about help with Aldith Thuson; Ask about help with Edwin Thuson | Ask about help with Geoffrey Jobari; Ask about help with Geoffrey Jobari; Ask about help with Hugh Jobari | 38 | 2 completed conversations, 1 order marked unfinished → 2 completed conversations, 1 order marked unfinished | No intervention completed |
| 6 | Ask about help with Margaret Seesi; Ask about help with Roger Friforrin; Ask about help with Edgar Thuson | Ask about help with Geoffrey Jobari; Ask about help with Geoffrey Jobari; Ask about help with Simon Seesi | 19 | 2 completed conversations, 1 order marked unfinished → 0 completed conversations, 1 order marked unfinished | No intervention completed |
| 7 | Ask about help with Matthew Frifoblo; Ask about help with Simon Frifoblo; Ask about help with Emmeline Frifoblo | Ask about help with Geoffrey Jobari; Ask about help with Geoffrey Jobari; Ask about help with Simon Frifoblo | 15 | 2 completed conversations, 3 orders marked unfinished → 0 completed conversations, 3 orders marked unfinished | No intervention completed |
| 8 | Ask about help with Felice Frifoblo; Ask about help with Alice Frifoblo; Ask about help with Christina Thuson | Ask about help with Geoffrey Jobari; Ask about help with Hugh Jobari; Ask about help with Hugh Jobari | 32 | 1 completed conversation, 3 orders marked unfinished → 1 completed conversation, 2 orders marked unfinished | No intervention completed |
| 9 | Ask about help with Alan Frifoblo; Ask about help with Ralph Frifoblo; Ask about help with Etheldreda Thuho | Ask about help with Geoffrey Jobari; Ask about help with Geoffrey Jobari; Ask about help with Hugh Jobari | 35 | 2 completed conversations, 2 orders marked unfinished → 1 completed conversation, 1 order marked unfinished | No intervention completed |
| 10 | Ask about help with William Frifoblo; Ask about help with Isabel Frifoblo; Ask about help with Henry Seesi | Ask about help with Geoffrey Jobari; Ask about help with Hugh Jobari; Ask about help with Emmeline Frifoblo | 31 | 1 completed conversation, 2 orders marked unfinished → 2 completed conversations, 2 orders marked unfinished | No intervention completed |
| 11 | Ask about help with Nicholas Thuho; Ask about help with Cecily Bobarin; Ask about help with Juliana Thuho | Ask about help with Geoffrey Jobari; Ask about help with Geoffrey Jobari; Ask about help with Margaret Seesi | 29 | 0 completed conversations, 3 orders marked unfinished → 2 completed conversations, 2 orders marked unfinished | No intervention completed |
| 12 | Ask about help with Isabel Bobarin; Ask about help with Luke Thuson; Ask about help with Margaret Seesi | Ask about help with Ralph Thuson; Ask about help with William Frifoblo; Ask about help with Matthew Frifoblo | 251 | 1 completed conversation, 1 order marked unfinished → 1 completed conversation, 3 orders marked unfinished | No intervention completed |
| 13 | Ask about help with Alan Thuson; Ask about help with Ralph Thuson; Ask about help with Matthew Frifoblo | Ask about help with Hugh Jobari; Give food to Geoffrey Jobari; Ask about help with Hugh Jobari | 91 | 2 completed conversations, 2 orders marked unfinished → 1 completed conversation, 1 real gift | No intervention completed |
| 14 | Ask about help with Edwin Thuson; Ask about help with Ralph Frifoblo; Ask about help with Alan Frifoblo | Ask about help with Hugh Jobari; Ask about help with Hugh Jobari; Ask about help with Geoffrey Jobari | 62 | 0 completed conversations, 4 orders marked unfinished → 2 completed conversations, 1 order marked unfinished | No intervention completed |
| 15 | Overnight events | Overnight events | 26 | 0 completed conversations → 0 completed conversations | No intervention completed |

The following are examples of changed community outcomes on each day. A plus means more in the replay; a minus means fewer. Up to three changed event-and-person combinations are shown per day. The full differences remain in the raw records.

| Day | Measured NPC changes in the replay |
| --- | --- |
| 1 | No change in these event kinds |
| 2 | No change in these event kinds |
| 3 | No change in these event kinds |
| 4 | +1 quarrel: Andrew Jobari / Hugh Jobari; +1 reconciliation: Sybil Bobarin / Alan Thuson; +1 quarrel: Mabel Frifoblo / Hugh Jobari; 3 further changed combinations in raw records |
| 5 | No change in these event kinds |
| 6 | No change in these event kinds |
| 7 | No change in these event kinds |
| 8 | +1 quarrel: Margaret Seesi / Edwin Thuson; +1 quarrel: Margaret Seesi / Aldith Thuson; +1 quarrel: Margaret Seesi / Richard Yaforlo; 18 further changed combinations in raw records |
| 9 | No change in these event kinds |
| 10 | -1 reconciliation: Roger Friforrin / Richard Yaforlo |
| 11 | -1 reconciliation: Geoffrey Jobari / Hugh Jobari; -1 move: Stephen Frifoblo; -1 marriage: Cecily Bobarin / Stephen Frifoblo |
| 12 | +1 reconciliation: Margaret Seesi / Richard Yaforlo; +1 reconciliation: Ralph Frifoblo / Luke Thuson |
| 13 | +1 reconciliation: Margaret Seesi / Andrew Seesi; +1 reconciliation: Edwin Thuson / Richard Yaforlo; +1 quarrel: Sybil Bobarin / Nicholas Thuho; 1 further changed combinations in raw records |
| 14 | +1 quarrel: Alice Frifoblo / Juliana Thuho; -1 quarrel: Edwin Thuson / Richard Yaforlo |
| 15 | +1 quarrel: Alan Frifoblo / Nicholas Thuho; +1 quarrel: Alan Frifoblo / William Frifoblo; +1 quarrel: Nicholas Thuho / Gunnilda Thuforrun; 21 further changed combinations in raw records |

The contact and task column records the immediate mechanism: the day layer reserved attention, walked the player, spoke the recorded lines and executed real orders. Completed chat can change regard; a completed gift or favour can change resources and trust. Unfinished approaches can still alter meeting schedules. The community-record differences are measured downstream changes, but this trace does not identify the exact causal chain for every NPC event. They are not counted as a chosen success.

No peace or introduction was selected in the replay because the policy did not reach an available choice. A changed schedule alone does not satisfy the chosen-outcome test.

## Seeds 1 to 10

Availability counts distinct pairs per slot, so one pair counts again if it remains available in another slot. The table also gives slots with any opportunity. Success requires real reconciliation for peace or completed contact for introduction during the requested slot. Later consequences remain in the event timeline. Starting a courtship and marrying are separate results. Every seed played 42 choices and ended at the next dawn after two seasons.

| Seed | Peace: pair opportunities / slots | Peace: requests / successes | Introduction: pair opportunities / slots | Introduction: requests / successes | What completed interventions changed |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 2 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 3 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 4 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 5 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 6 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 7 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 8 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 9 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |
| 10 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | No completed intervention |

Seed 1: player activity was 10 completed conversations, 24 orders marked unfinished. Community totals were 0 gifts, 0 completed favours, 18 quarrels and 7 reconciliations. Unfinished tasks: 8 × The slot ended before the task finished; 3 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour; 12 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 1 × Needs your wood · choose Chop wood.

Seed 2: player activity was 18 completed conversations, 3 real gifts, 3 real favours, 19 orders marked unfinished. Community totals were 3 gifts, 3 completed favours, 20 quarrels and 7 reconciliations. Unfinished tasks: 9 × The slot ended before the task finished; 1 × The fuel need is already met · no goodwill; 5 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour; 1 × They are still resting. Try again after they have rested, or choose another neighbour; 2 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 1 × They accepted your gift.

Seed 3: player activity was 18 completed conversations, 1 real gift, 1 real favour, 25 orders marked unfinished. Community totals were 1 gift, 1 completed favour, 33 quarrels and 22 reconciliations. Unfinished tasks: 10 × The slot ended before the task finished; 10 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 3 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour; 1 × They heard your knock and are coming to the door; 1 × They accepted your gift.

Seed 4: player activity was 16 completed conversations, 2 real gifts, 20 orders marked unfinished. Community totals were 2 gifts, 0 completed favours, 8 quarrels and 1 reconciliation. Unfinished tasks: 7 × The slot ended before the task finished; 9 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 4 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour.

Seed 5: player activity was 9 completed conversations, 19 orders marked unfinished. Community totals were 0 gifts, 0 completed favours, 44 quarrels and 8 reconciliations. Unfinished tasks: 14 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 5 × The slot ended before the task finished.

Seed 6: player activity was 23 completed conversations, 2 real gifts, 2 real favours, 25 orders marked unfinished. Community totals were 2 gifts, 2 completed favours, 1 quarrel and 1 reconciliation. Unfinished tasks: 19 × The slot ended before the task finished; 5 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 1 × They heard your knock and are coming to the door.

Seed 7: player activity was 13 completed conversations, 2 real gifts, 2 real favours, 28 orders marked unfinished. Community totals were 2 gifts, 2 completed favours, 12 quarrels and 10 reconciliations. Unfinished tasks: 9 × The slot ended before the task finished; 15 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 4 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour.

Seed 8: player activity was 15 completed conversations, 1 real gift, 1 real favour, 19 orders marked unfinished. Community totals were 1 gift, 1 completed favour, 22 quarrels and 15 reconciliations. Unfinished tasks: 5 × The slot ended before the task finished; 7 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 1 × They heard your knock and are coming to the door; 5 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour; 1 × They accepted your gift.

Seed 9: player activity was 15 completed conversations, 2 real gifts, 2 real favours, 17 orders marked unfinished. Community totals were 2 gifts, 2 completed favours, 68 quarrels and 50 reconciliations. Unfinished tasks: 9 × The slot ended before the task finished; 4 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour; 3 × You could not reach them within an hour. Move closer, then choose Chat again, or try another neighbour; 1 × They accepted your gift.

Seed 10: player activity was 28 completed conversations, 2 real gifts, 2 real favours, 9 orders marked unfinished. Community totals were 2 gifts, 2 completed favours, 32 quarrels and 16 reconciliations. Unfinished tasks: 6 × The slot ended before the task finished; 3 × They are still eating or looking for a meal. Try again after their meal, or choose another neighbour.

The controls check 504 completed slots in twelve games. Every game has a usable next-day menu. Elapsed time includes generation when a starting graph was not already cached.

| Seed | Policy | Slots | End day value | Available choices next morning | Elapsed seconds |
| --- | --- | ---: | ---: | ---: | ---: |
| 13 | baseline | 42 | 14.25 | 223 | 1704.7 |
| 13 | learned | 42 | 14.25 | 202 | 811.0 |
| 1 | helpful | 42 | 14.25 | 143 | 765.7 |
| 2 | helpful | 42 | 14.25 | 218 | 787.6 |
| 3 | helpful | 42 | 14.25 | 276 | 503.2 |
| 4 | helpful | 42 | 14.25 | 171 | 1028.5 |
| 5 | helpful | 42 | 14.25 | 229 | 318.7 |
| 6 | helpful | 42 | 14.25 | 145 | 580.7 |
| 7 | helpful | 42 | 14.25 | 221 | 1909.1 |
| 8 | helpful | 42 | 14.25 | 207 | 1087.1 |
| 9 | helpful | 42 | 14.25 | 149 | 807.7 |
| 10 | helpful | 42 | 14.25 | 119 | 1037.4 |

All twelve final games used source hash `3a71433df61d9ab3e29b6bfd5770d4d2baadeba74333d8db8c2ee8464806fd25`.

## Reproduce the proofs

Run from this worktree. Dependency writes and raw logs stay here. The second command prepares the production Node bundle using the same method as the supplied week-levers research. The two survey commands can run in the two permitted slots. Each script records its actual Node PID.

```sh
npm ci
flock -w 7200 /tmp/27agents-gate-2.lock npx webpack --config scripts/research/day-with-webpack.cjs
flock -w 7200 /tmp/27agents-gate.lock node .cache/day-with/play-bundle.cjs 13 1 2 3 4 5
flock -w 7200 /tmp/27agents-gate-2.lock node .cache/day-with/play-bundle.cjs 6 7 8 9 10
node scripts/research/day-with-report.cjs
```

The original source command also works: `node scripts/research/day-with-play.cjs 13`. The final twelve games used the production bundle. Each result records its start time and a hash of game source, data, policy and dependencies. The runner rejects source changes during a game. The report rejects old results and mixed source hashes. Starting graphs retain shared references through V8 serialisation. There are no invented people, goodwill grants, forced marriages, food grants or teleports.

## Gate receipts

Proof batch A: exit 0. Full stdout and stderr: `.cache/day-with/batch-a-final.log`.

Proof batch B: exit 0. Full stdout and stderr: `.cache/day-with/batch-b-final.log`.

Initial affected Jest (preserved): `flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=a2c0cba --maxWorkers=2`. Exit 1. Literal output, with trailing spaces removed (raw log retained):

```text
FAIL test/world_journeys.test.js (67.596 s)
  ● ordinary active seasons catch up off-screen residents exactly once and autonomous walking departures cross the edge

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      233 |   }
      234 |   expect(s.days).toBeGreaterThan(4*DAYS_IN_SEASON);
    > 235 |   expect(walked).toBe(true);
          |                  ^
      236 |   expect(s.travel.active).toBe("5,5");
      237 |   for (let season = 1; season <= 4; season++) expect(s.travel.historyCalls.filter(c => c.key === b.s.map.worldKey && c.season === season)).toHaveLength(1);
      238 |   expect(s.travel.maps[b.s.map.worldKey].events.some(e => e.type === "world_visit" && e.people[0] === id)).toBe(true);

      at Object.<anonymous> (test/world_journeys.test.js:235:18)

FAIL test/survival.test.js (13.211 s)
  ● winter pauses berries and crops until their growing season

    expect(received).toBe(expected) // Object.is equality

    Expected: "sown"
    Received: "harvestable"

      186 |   }]);
      187 |   advance(state, DAYS_IN_SEASON - .1);
    > 188 |   expect(state.ecs.farmable[field].slots[0].state).toBe("sown");
          |                                                    ^
      189 |   expect(state.ecs.farmable[field].slots[0].growth).toBe(10);
      190 |   expect(state.ecs.forageable[bush].amount).toBe(1);
      191 |   expect(state.ecs.personable[villager].hunger).toBeGreaterThan(4);

      at Object.<anonymous> (test/survival.test.js:188:52)

FAIL test/succession.test.js (8.404 s)
  ● Console

    console.log
      Hang on, we are completing a job marry but there is no job assigned to us in 7  controller jobs: [
        {
          id: 'task-1',
          job: { key: 'marry' },
          targetId: '8',
          progress: 1,
          waiting: null,
          assignedId: null,
          workRemaining: 0
        }
      ]

      at Object.complete_job (src/game/tasks.js:264:13)

    console.log
      Hang on, we are releasing a job marry but there is no job assigned to us in 7  controller jobs: [
        {
          id: 'task-1',
          job: { key: 'marry' },
          targetId: '8',
          progress: 1,
          waiting: null,
          assignedId: null,
          workRemaining: 0
        }
      ]

      at Object.release_job (src/game/tasks.js:248:13)

  ● continues after a shared lifecycle death as the actual spouse with their own identity and estate provenance

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 5

      Object {
    -   "dead": true,
    -   "deathCause": "old age",
    -   "heirId": "person-130",
    +   "age": 102,
    +   "energy": 86.16800000000006,
    +   "id": "person-129",
    +   "lifeYears": 12.75,
    +   "tiredness": 0.19444458333333337,
      }

      130 |   const point={...s.ecs.spatial[heir]};s.days=DAYS_IN_SEASON-.001;Object.assign(s.ecs.personable[player],{age: 102,lifeYears: 102 / 8});
      131 |   const sim=createSimulation(s);await sim.step(10*(60), 0);if(sim.pending)await sim.pending;
    > 132 |   expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:"old age",heirId:heir});
          |                                    ^
      133 |   expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
      134 |   expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
      135 |   expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);

      at test/succession.test.js:132:36

  ● continues after a shared lifecycle death as the actual minor with their own identity and estate provenance

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 5

      Object {
    -   "dead": true,
    -   "deathCause": "old age",
    -   "heirId": "person-130",
    +   "age": 102,
    +   "energy": 86.16800000000006,
    +   "id": "person-129",
    +   "lifeYears": 12.75,
    +   "tiredness": 0.19444458333333337,
      }

      130 |   const point={...s.ecs.spatial[heir]};s.days=DAYS_IN_SEASON-.001;Object.assign(s.ecs.personable[player],{age: 102,lifeYears: 102 / 8});
      131 |   const sim=createSimulation(s);await sim.step(10*(60), 0);if(sim.pending)await sim.pending;
    > 132 |   expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:"old age",heirId:heir});
          |                                    ^
      133 |   expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
      134 |   expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
      135 |   expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);

      at test/succession.test.js:132:36

FAIL test/people_feedback.test.js (9.399 s)
  ● explicit food, movement and rest complete as successive single orders

    expect(received).toBeLessThan(expected)

    Expected: < 0.6
    Received:   0.6

      90 |   step(12);
      91 |   expect(rest.progress).toBe(1);
    > 92 |   expect(s.ecs.personable[player].tiredness).toBeLessThan(.6);
         |                                              ^
      93 | });
      94 |
      95 | it("an idle player cannot eat a nearby stranger's stores", () => {

      at Object.<anonymous> (test/people_feedback.test.js:92:46)

FAIL test/travel_review.test.js (6.894 s)
  ● processes simultaneous real player and NPC edge completions on their departure map

    expect(received).toEqual(expected) // deep equality

    - Expected  -  1
    + Received  + 10

    - Array []
    + Array [
    +   Object {
    +     "id": "person-130",
    +     "intent": Object {
    +       "side": 0,
    +       "tileId": "124",
    +       "to": "6,5",
    +     },
    +   },
    + ]

      60 |   const sim = createSimulation(s);
      61 |   await sim.step(10*(0), 0); skipIntro(s); await sim.step(10*(0), 0);
    > 62 |   expect(s.pendingNpcDepartures).toEqual([]);
         |                                  ^
      63 |   expect(s.travel.transit.filter(t => t.bundle.id == npc).length).toBeLessThanOrEqual(1);
      64 |   s.days += DAYS_IN_SEASON; await advanceWorldClock(s);
      65 |   expect(s.travelError).toBeUndefined();

      at Object.<anonymous> (test/travel_review.test.js:62:34)

FAIL test/background_checkpoint.test.js (5.906 s)
  ● resumes the simulation on arrival and evicts only after acknowledgement

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: undefined

      44 |   await sim.step(0, 0);
      45 |   skipIntro(s);
    > 46 |   expect(s.worldBusy).toBe(false);
         |                       ^
      47 |   expect(s.transition).toBeNull();
      48 |   expect(s.travel.active).toBe("6,5");
      49 |   expect(f.client).not.toHaveBeenCalled();

      at Object.<anonymous> (test/background_checkpoint.test.js:46:23)

FAIL test/fireside.test.js
  ● keeps a journey walking after dusk and uses its camp fire only on exhaustion

    expect(received).toBe(expected) // Object.is equality

    Expected: "settle_fire"
    Received: undefined

      60 |   const camp=s.travel.journey.campId;expect(camp).toBeDefined();expect(s.ecs.camp[camp].journey).toBe(true);
      61 |   const sim=createSimulation(s);sim.step(1,0);
    > 62 |   expect(s.ecs.planner[p].task?.[0]).toBe('settle_fire');expect(s.nightSleep).toBeFalsy();
         |                                      ^
      63 | });
      64 |
      65 | it('keeps a daytime journey rest on its camp bedroll until the sleep is complete',()=>{

      at Object.<anonymous> (test/fireside.test.js:62:38)

FAIL test/first_run.test.js
  ● starts a new game from the menu, hands over an owned camp and resumes time

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      65 |   const sim = createSimulation(s);
      66 |   sim.step(1, INTRO_TIMING.duration + 1);
    > 67 |   expect(s.intro.active).toBe(false);
         |                          ^
      68 |   const camp = s.intro.campId, player = s.ui.playerId;
      69 |   expect(s.ecs.household[player].houseId).toBe(camp);
      70 |   expect(s.ecs.spatial[camp]).toMatchObject(s.intro.campPoint);

      at Object.<anonymous> (test/first_run.test.js:67:26)

{"childExtras":false,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
{"childExtras":true,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
FAIL test/fixed_simulation.test.js (31.977 s)
  ● keeps an explicit headless wall clock at zero without presentation sleep acceleration

    expect(received).toBeDefined()

    Received: undefined

      38 |   const sim=createSimulation(s),start=s.days;
      39 |   for(let n=0;n<30;n++)sim.step(10,0);
    > 40 |   expect(s.nightSleep).toBeDefined();
         |                        ^
      41 |   expect(s.days-start).toBeCloseTo(30/1440,10);
      42 | });
      43 |

      at Object.<anonymous> (test/fixed_simulation.test.js:40:24)

Summary of all failing tests
FAIL test/world_journeys.test.js (67.596 s)
  ● ordinary active seasons catch up off-screen residents exactly once and autonomous walking departures cross the edge

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      233 |   }
      234 |   expect(s.days).toBeGreaterThan(4*DAYS_IN_SEASON);
    > 235 |   expect(walked).toBe(true);
          |                  ^
      236 |   expect(s.travel.active).toBe("5,5");
      237 |   for (let season = 1; season <= 4; season++) expect(s.travel.historyCalls.filter(c => c.key === b.s.map.worldKey && c.season === season)).toHaveLength(1);
      238 |   expect(s.travel.maps[b.s.map.worldKey].events.some(e => e.type === "world_visit" && e.people[0] === id)).toBe(true);

      at Object.<anonymous> (test/world_journeys.test.js:235:18)

FAIL test/survival.test.js (13.211 s)
  ● winter pauses berries and crops until their growing season

    expect(received).toBe(expected) // Object.is equality

    Expected: "sown"
    Received: "harvestable"

      186 |   }]);
      187 |   advance(state, DAYS_IN_SEASON - .1);
    > 188 |   expect(state.ecs.farmable[field].slots[0].state).toBe("sown");
          |                                                    ^
      189 |   expect(state.ecs.farmable[field].slots[0].growth).toBe(10);
      190 |   expect(state.ecs.forageable[bush].amount).toBe(1);
      191 |   expect(state.ecs.personable[villager].hunger).toBeGreaterThan(4);

      at Object.<anonymous> (test/survival.test.js:188:52)

FAIL test/succession.test.js (8.404 s)
  ● continues after a shared lifecycle death as the actual spouse with their own identity and estate provenance

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 5

      Object {
    -   "dead": true,
    -   "deathCause": "old age",
    -   "heirId": "person-130",
    +   "age": 102,
    +   "energy": 86.16800000000006,
    +   "id": "person-129",
    +   "lifeYears": 12.75,
    +   "tiredness": 0.19444458333333337,
      }

      130 |   const point={...s.ecs.spatial[heir]};s.days=DAYS_IN_SEASON-.001;Object.assign(s.ecs.personable[player],{age: 102,lifeYears: 102 / 8});
      131 |   const sim=createSimulation(s);await sim.step(10*(60), 0);if(sim.pending)await sim.pending;
    > 132 |   expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:"old age",heirId:heir});
          |                                    ^
      133 |   expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
      134 |   expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
      135 |   expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);

      at test/succession.test.js:132:36

  ● continues after a shared lifecycle death as the actual minor with their own identity and estate provenance

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 5

      Object {
    -   "dead": true,
    -   "deathCause": "old age",
    -   "heirId": "person-130",
    +   "age": 102,
    +   "energy": 86.16800000000006,
    +   "id": "person-129",
    +   "lifeYears": 12.75,
    +   "tiredness": 0.19444458333333337,
      }

      130 |   const point={...s.ecs.spatial[heir]};s.days=DAYS_IN_SEASON-.001;Object.assign(s.ecs.personable[player],{age: 102,lifeYears: 102 / 8});
      131 |   const sim=createSimulation(s);await sim.step(10*(60), 0);if(sim.pending)await sim.pending;
    > 132 |   expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:"old age",heirId:heir});
          |                                    ^
      133 |   expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
      134 |   expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
      135 |   expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);

      at test/succession.test.js:132:36

FAIL test/people_feedback.test.js (9.399 s)
  ● explicit food, movement and rest complete as successive single orders

    expect(received).toBeLessThan(expected)

    Expected: < 0.6
    Received:   0.6

      90 |   step(12);
      91 |   expect(rest.progress).toBe(1);
    > 92 |   expect(s.ecs.personable[player].tiredness).toBeLessThan(.6);
         |                                              ^
      93 | });
      94 |
      95 | it("an idle player cannot eat a nearby stranger's stores", () => {

      at Object.<anonymous> (test/people_feedback.test.js:92:46)

FAIL test/travel_review.test.js (6.894 s)
  ● processes simultaneous real player and NPC edge completions on their departure map

    expect(received).toEqual(expected) // deep equality

    - Expected  -  1
    + Received  + 10

    - Array []
    + Array [
    +   Object {
    +     "id": "person-130",
    +     "intent": Object {
    +       "side": 0,
    +       "tileId": "124",
    +       "to": "6,5",
    +     },
    +   },
    + ]

      60 |   const sim = createSimulation(s);
      61 |   await sim.step(10*(0), 0); skipIntro(s); await sim.step(10*(0), 0);
    > 62 |   expect(s.pendingNpcDepartures).toEqual([]);
         |                                  ^
      63 |   expect(s.travel.transit.filter(t => t.bundle.id == npc).length).toBeLessThanOrEqual(1);
      64 |   s.days += DAYS_IN_SEASON; await advanceWorldClock(s);
      65 |   expect(s.travelError).toBeUndefined();

      at Object.<anonymous> (test/travel_review.test.js:62:34)

FAIL test/background_checkpoint.test.js (5.906 s)
  ● resumes the simulation on arrival and evicts only after acknowledgement

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: undefined

      44 |   await sim.step(0, 0);
      45 |   skipIntro(s);
    > 46 |   expect(s.worldBusy).toBe(false);
         |                       ^
      47 |   expect(s.transition).toBeNull();
      48 |   expect(s.travel.active).toBe("6,5");
      49 |   expect(f.client).not.toHaveBeenCalled();

      at Object.<anonymous> (test/background_checkpoint.test.js:46:23)

FAIL test/fireside.test.js
  ● keeps a journey walking after dusk and uses its camp fire only on exhaustion

    expect(received).toBe(expected) // Object.is equality

    Expected: "settle_fire"
    Received: undefined

      60 |   const camp=s.travel.journey.campId;expect(camp).toBeDefined();expect(s.ecs.camp[camp].journey).toBe(true);
      61 |   const sim=createSimulation(s);sim.step(1,0);
    > 62 |   expect(s.ecs.planner[p].task?.[0]).toBe('settle_fire');expect(s.nightSleep).toBeFalsy();
         |                                      ^
      63 | });
      64 |
      65 | it('keeps a daytime journey rest on its camp bedroll until the sleep is complete',()=>{

      at Object.<anonymous> (test/fireside.test.js:62:38)

FAIL test/first_run.test.js
  ● starts a new game from the menu, hands over an owned camp and resumes time

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: true

      65 |   const sim = createSimulation(s);
      66 |   sim.step(1, INTRO_TIMING.duration + 1);
    > 67 |   expect(s.intro.active).toBe(false);
         |                          ^
      68 |   const camp = s.intro.campId, player = s.ui.playerId;
      69 |   expect(s.ecs.household[player].houseId).toBe(camp);
      70 |   expect(s.ecs.spatial[camp]).toMatchObject(s.intro.campPoint);

      at Object.<anonymous> (test/first_run.test.js:67:26)

FAIL test/fixed_simulation.test.js (31.977 s)
  ● keeps an explicit headless wall clock at zero without presentation sleep acceleration

    expect(received).toBeDefined()

    Received: undefined

      38 |   const sim=createSimulation(s),start=s.days;
      39 |   for(let n=0;n<30;n++)sim.step(10,0);
    > 40 |   expect(s.nightSleep).toBeDefined();
         |                        ^
      41 |   expect(s.days-start).toBeCloseTo(30/1440,10);
      42 | });
      43 |

      at Object.<anonymous> (test/fixed_simulation.test.js:40:24)


Test Suites: 9 failed, 134 passed, 143 total
Tests:       10 failed, 1379 passed, 1389 total
Snapshots:   1 passed, 1 total
Time:        518.7 s
Ran all test suites related to changed files.
```

Targeted recheck (preserved): `flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/fixed_simulation.test.js test/simulation.test.js test/survival.test.js test/succession.test.js test/people_feedback.test.js test/travel_review.test.js test/background_checkpoint.test.js test/fireside.test.js test/first_run.test.js test/world_journeys.test.js test/player_day.test.js --maxWorkers=2`. Exit 1. Literal output, with trailing spaces removed (raw log retained):

```text
FAIL test/succession.test.js (7.909 s)
  ● Console

    console.log
      Hang on, we are completing a job marry but there is no job assigned to us in 7  controller jobs: [
        {
          id: 'task-1',
          job: { key: 'marry' },
          targetId: '8',
          progress: 1,
          waiting: null,
          assignedId: null,
          workRemaining: 0
        }
      ]

      at Object.complete_job (src/game/tasks.js:264:13)

    console.log
      Hang on, we are releasing a job marry but there is no job assigned to us in 7  controller jobs: [
        {
          id: 'task-1',
          job: { key: 'marry' },
          targetId: '8',
          progress: 1,
          waiting: null,
          assignedId: null,
          workRemaining: 0
        }
      ]

      at Object.release_job (src/game/tasks.js:248:13)

  ● continues after a shared lifecycle death as the actual spouse with their own identity and estate provenance

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 5

      Object {
    -   "dead": true,
    -   "deathCause": "old age",
    -   "heirId": "person-130",
    +   "age": 102,
    +   "energy": 86.16800000000006,
    +   "id": "person-129",
    +   "lifeYears": 12.75,
    +   "tiredness": 0.23611125000000002,
      }

      130 |   const point={...s.ecs.spatial[heir]};s.days=DAYS_IN_SEASON-.001;Object.assign(s.ecs.personable[player],{age: 102,lifeYears: 102 / 8});
      131 |   const sim=createSimulation(s);await sim.step(10*(60), 0);if(sim.pending)await sim.pending;
    > 132 |   expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:"old age",heirId:heir});
          |                                    ^
      133 |   expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
      134 |   expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
      135 |   expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);

      at test/succession.test.js:132:36

  ● continues after a shared lifecycle death as the actual minor with their own identity and estate provenance

    expect(received).toMatchObject(expected)

    - Expected  - 3
    + Received  + 5

      Object {
    -   "dead": true,
    -   "deathCause": "old age",
    -   "heirId": "person-130",
    +   "age": 102,
    +   "energy": 86.16800000000006,
    +   "id": "person-129",
    +   "lifeYears": 12.75,
    +   "tiredness": 0.23611125000000002,
      }

      130 |   const point={...s.ecs.spatial[heir]};s.days=DAYS_IN_SEASON-.001;Object.assign(s.ecs.personable[player],{age: 102,lifeYears: 102 / 8});
      131 |   const sim=createSimulation(s);await sim.step(10*(60), 0);if(sim.pending)await sim.pending;
    > 132 |   expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:"old age",heirId:heir});
          |                                    ^
      133 |   expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
      134 |   expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
      135 |   expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);

      at test/succession.test.js:132:36

FAIL test/travel_review.test.js (7.102 s)
  ● offscreen old age uses the live death rule and settles the estate

    expect(received).toBe(expected) // Object.is equality

    Expected: "old age"
    Received: undefined

      103 |   createSimulation(live).step(10*(60), 0);
      104 |   const away = historyStep(s, 1);
    > 105 |   expect(live.ecs.personable[actor].deathCause).toBe("old age");
          |                                                 ^
      106 |   expect(away.ecs.personable[actor]).toMatchObject({ dead: true, deathCause: "old age", heirId: heir });
      107 |   expect(away.ecs.possession[item].ownerId).toBe(heir);
      108 |   expect(s.ecs.personable[actor].dead).toBeUndefined();

      at Object.<anonymous> (test/travel_review.test.js:105:49)

A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them.

Test Suites: 2 failed, 9 passed, 11 total
Tests:       3 failed, 110 passed, 113 total
Snapshots:   0 total
Time:        97.991 s
Ran all test suites within paths "test/fixed_simulation.test.js", "test/simulation.test.js", "test/survival.test.js", "test/succession.test.js", "test/people_feedback.test.js", "test/travel_review.test.js", "test/background_checkpoint.test.js", "test/fireside.test.js", "test/first_run.test.js", "test/world_journeys.test.js", "test/player_day.test.js".
```

Exact season boundary recheck: `flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/simulation.test.js test/succession.test.js test/travel_review.test.js --runInBand`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text

Test Suites: 3 passed, 3 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        14.79 s, estimated 20 s
Ran all test suites within paths "test/simulation.test.js", "test/succession.test.js", "test/travel_review.test.js".
```

Final affected Jest: `flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=a2c0cba --maxWorkers=2`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text
{"childExtras":false,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
{"childExtras":true,"before":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]},"after":{"interest":3,"eligible":2,"knownChecks":21,"choices":[["visit","alice","fay"],["visit","ben","beth"],["play","child-a","child-b"],["play","child-c","child-d"]]}}
A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them.

Test Suites: 143 passed, 143 total
Tests:       1391 passed, 1391 total
Snapshots:   1 passed, 1 total
Time:        492.13 s, estimated 527 s
Ran all test suites related to changed files.
```

Production build: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.49 MiB
    asset app.3c5d82c15ddf9c2b0156.js 2.55 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.49 MiB (7.53 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.3c5d82c15ddf9c2b0156.js 2.55 MiB 3 auxiliary assets
  orphan modules 466 KiB [orphan] 134 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.22 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.39 MiB
      modules by path ./src/game/*.js 891 KiB 92 modules
      modules by path ./src/components/*.js 79.5 KiB 6 modules
      modules by path ./src/data/ 1.16 KiB 2 modules
      ./src/index.js + 65 modules 330 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 128 KiB [built] [code generated]
  json modules 1.74 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.73 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets:
    app.3c5d82c15ddf9c2b0156.js (2.55 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.73 MiB), ./src/index.js + 65 modules (330 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.49 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.3c5d82c15ddf9c2b0156.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 157096 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.5 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 4383 ms
```

Final picker and clock checks: `flock -w 7200 /tmp/27agents-gate.lock npx jest --runTestsByPath test/day.test.js test/fixed_simulation.test.js test/simulation.test.js test/day_policy.test.js --runInBand`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text

Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        91.007 s
Ran all test suites within paths "test/day.test.js", "test/fixed_simulation.test.js", "test/simulation.test.js", "test/day_policy.test.js".
```

Earlier research bundle (preserved): `flock -w 7200 /tmp/27agents-gate.lock npx webpack --config scripts/research/day-with-webpack.cjs`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text
asset play-bundle.cjs 2.26 MiB [emitted] [minimized] [big] (name: main) 1 related asset
orphan modules 214 KiB [orphan] 22 modules
runtime modules 1.35 KiB 5 modules
modules by path ./src/game/*.js 907 KiB
  ./src/game/world_history.js 18.2 KiB [built] [code generated]
  + 83 modules
modules by path ./src/data/ 1.74 MiB
  json modules 1.74 MiB 4 modules
  javascript modules 1.16 KiB 2 modules
modules by path ./scripts/research/*.cjs 12.3 KiB
  ./scripts/research/day-with-bundle.cjs 126 bytes [built] [code generated]
  + 2 modules
modules by path ./node_modules/ 23.7 KiB
  ./node_modules/mersenne-twister/src/mersenne-twister.js 7.18 KiB [built] [code generated]
  ./node_modules/simplex-noise/simplex-noise.js 16.6 KiB [built] [code generated]
+ 4 modules
webpack 5.112.2 compiled successfully in 38494 ms
```

Camper fix: affected marriage, travel and day checks: `flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/nearby_courtship.test.js test/arranged_marriage.test.js test/world_journeys.test.js test/world_travel.test.js test/day.test.js --maxWorkers=2`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text

Test Suites: 5 passed, 5 total
Tests:       98 passed, 98 total
Snapshots:   0 total
Time:        136.195 s
Ran all test suites within paths "test/nearby_courtship.test.js", "test/arranged_marriage.test.js", "test/world_journeys.test.js", "test/world_travel.test.js", "test/day.test.js".
```

Final production build: `flock -w 7200 /tmp/27agents-gate-2.lock npm run build`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text

> tinyking@1.0.0 build
> webpack --config webpack.prod.js

app:
  assets by path *.js 3.49 MiB
    asset app.bf5ec5e15885c0f59557.js 2.55 MiB [emitted] [immutable] [minimized] [big] (name: app) 1 related asset
    asset vendors.67f5ab9c200a0caba974.js 962 KiB [emitted] [immutable] [minimized] [big] (name: vendors) (id hint: vendor) 2 related assets
    asset runtime.42ef496b93112205a055.js 1.58 KiB [emitted] [immutable] [minimized] (name: runtime) 1 related asset
  asset index.html 479 bytes [emitted] [minimized]
  asset COMMITHASH 40 bytes [emitted]
  asset LASTCOMMITDATETIME 25 bytes [emitted]
  asset VERSION 19 bytes [emitted]
  Entrypoint app [big] 3.49 MiB (7.53 MiB) = runtime.42ef496b93112205a055.js 1.58 KiB vendors.67f5ab9c200a0caba974.js 962 KiB app.bf5ec5e15885c0f59557.js 2.55 MiB 3 auxiliary assets
  orphan modules 466 KiB [orphan] 134 modules
  runtime modules 3.9 KiB 9 modules
  javascript modules 5.22 MiB
    modules by path ./node_modules/ 3.82 MiB 123 modules
    modules by path ./src/ 1.4 MiB
      modules by path ./src/game/*.js 891 KiB 92 modules
      modules by path ./src/components/*.js 79.5 KiB 6 modules
      modules by path ./src/data/ 1.16 KiB 2 modules
      ./src/index.js + 65 modules 330 KiB [built] [code generated]
      ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss 128 KiB [built] [code generated]
  json modules 1.74 MiB
    ./src/data/event_types.json 16.4 KiB [built] [code generated]
    ./src/data/crops.json 80 bytes [built] [code generated]
    ./src/data/secret_activities.json 1.01 KiB [built] [code generated]
    ./src/data/conversation_lines.json 1.73 MiB [built] [code generated]

  WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
  This can impact web performance.
  Assets:
    app.bf5ec5e15885c0f59557.js (2.55 MiB)
      Largest modules: ./src/data/conversation_lines.json (1.73 MiB), ./src/index.js + 65 modules (330 KiB), ./node_modules/css-loader/dist/cjs.js!./node_modules/sass-loader/dist/cjs/index.js!./src/style.scss (128 KiB)
    vendors.67f5ab9c200a0caba974.js (962 KiB)
      Largest modules: ./node_modules/three/build/three.core.js (1.39 MiB), ./node_modules/@fortawesome/free-solid-svg-icons/index.es.js (696 KiB), ./node_modules/three/build/three.module.js (647 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
  Entrypoints:
    app (3.49 MiB)
        runtime.42ef496b93112205a055.js
        vendors.67f5ab9c200a0caba974.js
        app.bf5ec5e15885c0f59557.js

  WARNING in webpack performance recommendations:
  You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
  For more info visit https://webpack.js.org/guides/code-splitting/

  app (webpack 5.112.2) compiled with 3 warnings in 212596 ms

save-worker:
  asset save-worker.js 11.7 KiB [emitted] [minimized] (name: main) 1 related asset
  orphan modules 57.5 KiB [orphan] 13 modules
  ./src/game/save_worker.js + 11 modules 60 KiB [built] [code generated]
  save-worker (webpack 5.112.2) compiled successfully in 7985 ms
```

Final research bundle: `flock -w 7200 /tmp/27agents-gate.lock npx webpack --config scripts/research/day-with-webpack.cjs`. Exit 0. Literal output, with trailing spaces removed (raw log retained):

```text
asset play-bundle.cjs 2.26 MiB [emitted] [minimized] [big] (name: main) 1 related asset
orphan modules 214 KiB [orphan] 22 modules
runtime modules 1.35 KiB 5 modules
modules by path ./src/game/*.js 907 KiB
  ./src/game/world_history.js 18.2 KiB [built] [code generated]
  + 83 modules
modules by path ./src/data/ 1.74 MiB
  json modules 1.74 MiB 4 modules
  javascript modules 1.16 KiB 2 modules
modules by path ./scripts/research/*.cjs 12.9 KiB
  ./scripts/research/day-with-bundle.cjs 126 bytes [built] [code generated]
  + 2 modules
modules by path ./node_modules/ 23.7 KiB
  ./node_modules/mersenne-twister/src/mersenne-twister.js 7.18 KiB [built] [code generated]
  ./node_modules/simplex-noise/simplex-noise.js 16.6 KiB [built] [code generated]
+ 4 modules
webpack 5.112.2 compiled successfully in 78289 ms
```

The camping-player regression failed before its fix. The saved Jest output follows. Its separate shell-exit receipt was not saved; the output records one failed test.

```text
FAIL test/nearby_courtship.test.js (18.994 s)
  ● keeps an unrelated camping player in the live hex when neighbours marry across its boundary

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: undefined

      448 |   s.days=14;runNearbyCourtships(s,2);
      449 |   expect(s.travel.people[a].kinship.spouse).toBe(b);
    > 450 |   expect(s.residents[camper]).toBe(true);
          |                               ^
      451 |   expect(s.travel.maps[key].residents[camper]).toBeFalsy();
      452 |   expect(s.ecs.playable[camper].known).toEqual(known);
      453 |   expect(Object.values(s.travel.events).some(e=>e.type=="world_move"&&e.people.includes(camper))).toBe(false);

      at Object.<anonymous> (test/nearby_courtship.test.js:450:31)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 33 skipped, 34 total
Snapshots:   0 total
Time:        25.32 s, estimated 27 s
Ran all test suites within paths "test/nearby_courtship.test.js".

```

This JavaScript repository has no TypeScript configuration or typecheck script. ESLint, Node syntax checks and `git diff --check` cover the touched source and scripts. Their commands and exit receipts are below. No shared test configuration or fixture changed, and no whole-suite exception was used.

```text
$ npx eslint src/game/simulation.js src/game/day.js src/game/social_interventions.js src/game/social_visits.js src/game/tasks.js src/game/chat.js src/game/favours.js src/game/nearby_courtship.js scripts/research/day-with-webpack.cjs scripts/research/day-with-register.cjs scripts/research/day-with-policy.cjs scripts/research/day-with-bundle.cjs scripts/research/day-with-play.cjs scripts/research/day-with-report.cjs
Exit 0

$ node --check scripts/research/day-with-webpack.cjs
Exit 0

$ node --check scripts/research/day-with-register.cjs
Exit 0

$ node --check scripts/research/day-with-policy.cjs
Exit 0

$ node --check scripts/research/day-with-bundle.cjs
Exit 0

$ node --check scripts/research/day-with-play.cjs
Exit 0

$ node --check scripts/research/day-with-report.cjs
Exit 0

$ git diff --check
Exit 0


```

## Limits and process

The default player policy uses visible conversation matches and learned tastes. Some approaches fail before contact. Hungry or resting people cannot currently accept a gift until their existing need clears. Fixed hate still prevents Personal trust. An introduction starts a visit, while needs, consent, time and housing still control its outcome. These limits can make a seed resistant to the tested policy. The report does not claim that every possible policy fails where this one fails.

Two preliminary seed-13 runs were stopped by their saved PIDs. Two earlier complete seed-13 games are retained as pre-correction evidence after the affected gate found the midnight rounding error. One exposed repeated fallback selection, and an inspector sample in the second exposed repeated food inventory scans. Three preliminary seed-1 runs were stopped: after caching its initial graph, after finding the empty-target policy error, and after detecting a bundle built before its helper correction. Their partial logs remain under `.cache/day-with/` and supply no completed-game evidence. Other partial survey runs were stopped for the clock gate fixes. Their logs remain separate. The first canonical-clock survey then exposed the seed-7 camping-player transfer. Three completed cases and the partial failed case are retained under `before-camper-fix/`. The other batch was stopped by its saved PID. A read-only seed-7 diagnostic was also stopped by its saved PID after the small-world regression reproduced the defect. These cases supply no final acceptance counts. The final source and test changes were recorded before the final batch.

No sub-agent or other model ran. No branch comparison, vault or ledger write, push or stash occurred. No application server ran. Ports 8080–8082 were unused. A temporary inspector on port 9229 sampled only the owned seed-13 process. Only saved PIDs from this job were stopped. The changes remain on `day-with`.
