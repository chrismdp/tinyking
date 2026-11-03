TinyKing now keeps two core journeys in `happy_paths` and tests the other rules through domain functions and small fixtures. The work changes 53 test files, removes five files for views or presentation, and changes no source or shared fixture. All 48 retained affected files pass, with 611 tests.

The summed file time falls from 237.977s to 167.486s, a reduction of 70.491s (29.6%). The after total carries forward the measurements for unchanged files. It is not a second whole-suite run.

The supplied HEAD already used fixtures in all four named files. `first_run` used an ECS stub, `roads_tracks` used tile rows, `settlement_history` used a founding fixture, and `happy_paths` used declared communities. This work splits their remaining combined checks and reduces their setup further. The current `docs/design.md` contains the game design but no numbered step 8. I read it and followed this brief and `docs/verification.md` for scope and verification.

Timing and evidence

Each baseline file ran once, before edits, in nine explicit batches of at most 20 files. Every Jest invocation used:

```sh
flock -w 7200 /tmp/27agents-gate.lock env -u NODE_OPTIONS npx jest --runTestsByPath <explicit files> --maxWorkers=2 --workerIdleMemoryLimit=1GB --json --outputFile <path under .cache/step8/>
```

This baseline is the brief's explicit exception to the affected-only gate. It passed 161 files and 1,447 tests. The final affected pass used three explicit batches of 16 files. All three passed. A later change to the history-item fixture preserves a seasonal update after item creation. Its six tests passed in one affected rerun. The final audit also removed two fake-DOM readiness cases and added a foreign field to the one-household farming check. Both changed files passed their affected reruns.

File time means Jest's JSON `endTime - startTime`. The totals add file times, rather than parallel batch wall times. Lock waits and process startup are excluded. The baseline began with an empty local Jest cache. Later runs share compiled modules and differ in worker grouping and machine contention. These are single-run measurements, not a controlled speed benchmark.

| Contribution | Before (s) | After (s) |
| --- | ---: | ---: |
| 53 changed files, including five deletions | 128.398 | 57.907 |
| 108 unchanged files, baseline evidence retained | 109.579 | 109.579 |
| Total | 237.977 | 167.486 |

The final evidence covers 156 retained files and 1,422 tests when combined with the unchanged baseline results. No final source, package, Jest configuration or shared fixture change invalidates those results. Dependencies were already installed. Setup cost was zero, and dependency files stayed unchanged. This JavaScript project defines no typecheck. The verification policy permits affected checks for test-only changes, so no production build or browser pass ran.

ESLint passed on all retained changed files. A local configuration adds Jest and Node globals, accepts existing quote and indentation styles, and accepts existing `/* global */` declarations. It leaves the other project rules enabled. The 12 unused-variable warnings also occur in the base versions of these files. The comparison found no new warning. `git diff --check` passed.

All raw evidence stays outside git under `.cache/step8/`: baseline batches and receipts in `before/`, affected runs and failures in `after/`, final batches in `after/final-*`, and `after/history-items-final.*`. `before/times.json` records all 161 initial file times. `eslint-final.receipt.json` and `lint-comparison.json` record lint results. The failed runs remain available. They exposed fixture input errors and incorrect expectations about existing catalogue keys. No timeout, source rule or assertion threshold was raised.

Per-file times

A deleted file contributes zero to the after total. Each retained file uses its final passing result. The history-item, acceptance-helper and village rows use their later affected reruns.

| File | Before (s) | After (s) |
| --- | ---: | ---: |
| `test/acceptance_selection.test.js` | 1.703 | 1.212 |
| `test/arrival_tasks.test.js` | 7.540 | 0.501 |
| `test/biography.test.js` | 0.389 | 0.143 |
| `test/biome_field.test.js` | 4.039 | 0.073 |
| `test/chat.test.js` | 8.751 | 2.021 |
| `test/chat_acceptance.test.js` | 26.123 | 10.483 |
| `test/chat_guidance.test.js` | 0.295 | 0.134 |
| `test/chat_row_rules.test.js` | 1.202 | 0.449 |
| `test/chat_tell.test.js` | 1.406 | 0.780 |
| `test/chat_visits.test.js` | 0.550 | 0.375 |
| `test/core_loop.test.js` | 0.282 | 0.135 |
| `test/event_knowledge.test.js` | 0.165 | 0.124 |
| `test/family_history_integration.test.js` | 0.746 | 0.525 |
| `test/favours.test.js` | 2.089 | 0.691 |
| `test/fireside.test.js` | 0.375 | 0.189 |
| `test/first_run.test.js` | 0.153 | 0.981 |
| `test/geography_foundations.test.js` | 4.386 | 2.825 |
| `test/geography_refinement.test.js` | 3.376 | 0.719 |
| `test/gift_choices.test.js` | 0.135 | 0.101 |
| `test/gossip_bubbles.test.js` | 0.192 | 0.134 |
| `test/happy_paths.test.js` | 1.487 | 1.526 |
| `test/history_items.test.js` | 1.665 | 3.640 |
| `test/history_length.test.js` | 0.139 | 0.114 |
| `test/i18n.test.js` | 0.043 | 0.000 (removed) |
| `test/info_ownership.test.js` | 0.411 | 0.194 |
| `test/life_stages.test.js` | 0.342 | 0.173 |
| `test/manager.test.js` | 0.190 | 0.114 |
| `test/mother_family.test.js` | 1.807 | 0.888 |
| `test/orientation.test.js` | 0.706 | 0.590 |
| `test/overworld.test.js` | 13.999 | 0.511 |
| `test/people_feedback.test.js` | 0.702 | 0.861 |
| `test/people_orders.test.js` | 1.575 | 0.692 |
| `test/people_panel.test.js` | 1.505 | 0.000 (removed) |
| `test/person_activity.test.js` | 0.161 | 0.000 (removed) |
| `test/play_session_feedback.test.js` | 1.157 | 0.289 |
| `test/player_day.test.js` | 0.338 | 0.262 |
| `test/replay2_findings.test.js` | 0.764 | 0.546 |
| `test/replay_findings.test.js` | 0.564 | 0.442 |
| `test/roads_tracks.test.js` | 0.163 | 0.121 |
| `test/season_polish.test.js` | 0.218 | 0.118 |
| `test/seasons.test.js` | 0.280 | 0.138 |
| `test/settlement_details.test.js` | 0.153 | 0.099 |
| `test/settlement_history.test.js` | 0.507 | 0.598 |
| `test/social_mobility.test.js` | 2.525 | 1.487 |
| `test/space_pause.test.js` | 0.033 | 0.000 (removed) |
| `test/succession_controls.test.js` | 1.180 | 0.975 |
| `test/succession_knowledge.test.js` | 0.470 | 0.446 |
| `test/ticker.test.js` | 0.034 | 0.000 (removed) |
| `test/travel.test.js` | 1.988 | 1.912 |
| `test/village_customs.test.js` | 1.209 | 0.610 |
| `test/village_customs_readiness.test.js` | 0.442 | 0.274 |
| `test/village_generation.test.js` | 13.982 | 8.347 |
| `test/villages.test.js` | 13.762 | 9.345 |

Fixture choices and remaining costs

`first_run` now hands over a camp on three tiles with one player. The menu guards still use an ECS stub. `roads_tracks` separates through-road classification from wear on household and field spurs. Its largest fixture has eight tiles. `settlement_history` keeps one three-household founding sequence for dated homes and the persistent centre. A separate single-household fixture covers stores, field access and seasonal journeys. Wear and replay checks retain four-tile rows.

The two retained journeys in `happy_paths` use the real planner and simulation:

- Play a day through walking, spoken chat and rest. This proves that physical arrival, paused speech, contact and sleep connect correctly.
- Travel between two played communities, save, restore, then continue both simulations. This proves shared map references, actor state, ownership, knowledge and queued orders survive together.

The arrival handover moved to `first_run`. The season boundary moved to `seasons` and crosses dawn directly. The physical edge handover moved to `travel`. These checks retain their state assertions without repeating a whole day or generating another world.

The habitat fixture supplies a four-cell moisture grid and seeded temperature field. The highland-pad fixture uses 61 tiles. Border contracts use seven declared reaches and a flat field. The natural-height checks sample seed 13's recorded home `(5,3)` directly. The recorded coordinate comes from one diagnostic call on that existing seed, not a seed search. Home selection supplies an accepted siting result while it checks terrain fractions and biome independence. Actual siting remains covered by the geography and seed-64 regression tests.

The village tests now call crop and animal updates directly for dormancy and movement. Physical farm work uses one household and one foreign field. The foreign patch stays untouched throughout the crop cycle. The rejected-hamlet fixture uses rocky ground with three unbuilt opportunities and one unrelated inventory. It exercises real rejection without forcing every possible yard proposal to fail. Historical gift transfer uses a few people and two objects. Item retention uses a late founding date with a later seasonal update.

The remaining slow files test rules that require their scope:

| File | Time used after (s) | Reason to retain this scope |
| --- | ---: | --- |
| `test/chat_answers.test.js` | 18.997 | Every asking catalogue line must have a usable answer in five conversation states. These are small people fixtures, not histories. |
| `test/chat_acceptance.test.js` | 10.483 | Every authored player question must keep its answer topic across three knowledge/trust states and spent facts. The matrix is the rule. |
| `test/villages.test.js` | 9.345 | Trade thresholds, property access and separated gathering places require several households. Physical farming still runs a real crop cycle. |
| `test/arranged_marriage.test.js` | 8.521 | The tests cover consent, refusal, housing and cross-community household moves on declared communities. |
| `test/village_generation.test.js` | 8.347 | Three-to-eight household reservations and shared access must fit together. The costly blanket rejection search was removed. |
| `test/one_world.test.js` | 8.142 | Two compact communities share three seasons. Detailed arrival and repeatable reconstruction still call the real map builder. |
| `test/world_journeys.test.js` | 6.928 | Road fatigue, camping, hop boundaries and transfer rules use real movement on declared communities. |
| `test/nearby_courtship.test.js` | 5.663 | Consent, proximity, migration and courtship clocks use small local and compact fixtures. |
| `test/history.test.js` | 4.524 | Two hamlets run the configured history twice. Births, cross-village marriage, death, inheritance and deterministic replay need elapsed seasons. |
| `test/history_items.test.js` | 3.640 | Historical creation, a later seasonal update, provenance and physical gift transfer remain real. Its later one-file run measured slower than the batch. |
| `test/geography_foundations.test.js` | 2.825 | Reciprocal border surveys use the engine’s fixed local terrain grid. The mountain-pass test requires a continuous route across a ridge. |

Source boundaries and limits

No file under `src/` changed. The following boundaries need a source change for a smaller direct proof:

- `generateMap` and the border survey use the production map radius. Supported small-map inputs would shrink the real reconstruction checks in `one_world` and the fixed border surveys. Replacing their builders with mocks would stop proving physical reconstruction.
- `generateWorld` performs the terrain survey, home search and climate assignment together. `annual_moisture` retains two real generator checks of stored climate and weather immutability. `travel_generation_review` retains the seed-64 start-site regression. A source boundary for prepared survey inputs would separate that composition from repeated home selection. These generate coarse terrain worlds, not populated game worlds or whole-world histories.
- `PersonPanel` computes visible traits inline. The removed React test directly covered that projection. Trait knowledge still has logic coverage in `chat.test.js`, and disclosed kin links have coverage in `possession_disclosure.test.js`. A pure source function is needed to test the exact trait-to-card projection without rendering.
- `Info` computes the displayed asset village inline. Household ownership is now tested through `repairHouseholds` and the direct-head lookup. The exact displayed village selection needs extraction for a direct logic test. The markup assertion was UI only and was removed.
- Biography sentences carry dates, and season sentences carry aggregate quantities. The rule tests now prefer source event IDs and state. The overflow test extracts the numeric count without asserting prose. Structured date and aggregate fields would permit equally direct tests of those projected values.

No shared fixture or harness changed, so the exception for a whole-area rerun was not needed. Some files remain slower because they prove connected simulation rules. Further source work lies outside this ticket.

Rule map

Each row names an original test or parameterised group. Its title states the rule. Unchanged tests remain in place. Exact labels, messages and connecting prose were removed from mixed tests while their state, permission and knowledge checks remain. Person and place identities are still tested where they control disclosure. The table also records the moved journeys and the removed presentation tests.

| Original file | Original test or group | Coverage now |
| --- | --- | --- |
| `test/acceptance_selection.test.js` | closes an actual spoken Chat with End chat before returning to game-time waits | UI selector/label driver test removed. Paused chat, actual speech, contact and close/resume remain in `happy_paths` and `chat.test.js`. |
| `test/acceptance_selection.test.js` | waits through real delivery progress without extending a stalled favour's timeout | The same delivery-progress test keeps completion, stalls and expiry. Its fixed wall-clock timeout assertion was UI driver timing and was removed. |
| `test/acceptance_selection.test.js` | waits for NPC readiness without ordering player care, requiring visible slots: %s | UI only, removed. This tested fake-DOM availability in a browser helper. Real oath readiness, fatigue cancellation and person-scoped rights remain in `village_customs_readiness.test.js`. |
| `test/arrival_tasks.test.js` | waits for logs without chopping on its own and runs the next task | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | stores chopped logs at camp then builds on an explicit new order | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | cancels a waiting build without interrupting a later running task | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | explains a missing %s target until a new order replaces it | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | skips unreachable work then retries it when the route opens | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | keeps a depleted plant waiting and retries when food grows back | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | delivers partial stores, waits with the delivered count, then wakes when more logs arrive | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | retains a target removed during a walk and completes the next task | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | yields a runtime failure and retries after the character finishes another task | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | skips a chop delivery that cannot pick up its logs and runs later work | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/arrival_tasks.test.js` | explains the occupied camp tile and names a usable shelter tile | The same test checks queue progress, materials, delivery, reachability or task replacement. Waiting-message wording was UI only and was removed. |
| `test/biography.test.js` | does not disclose a private quarrel at acquaintance trust, and learns it at friendship without granting contact with the subject | The same test checks disclosed event IDs, inheritance provenance, custody, stable results and hidden records. Sentence wording was UI only and was removed. |
| `test/biography.test.js` | uses learned parent loss without claiming care; keeps the exact date after kin move or die | The same test checks disclosed event IDs, inheritance provenance, custody, stable results and hidden records. Sentence wording was UI only and was removed. |
| `test/biography.test.js` | requires the actual learned inheritance event and current custody; a gift chain cannot become inherited from the maker | The same test checks disclosed event IDs, inheritance provenance, custody, stable results and hidden records. Sentence wording was UI only and was removed. |
| `test/biography.test.js` | returns two stable distinctive facts from learned evidence and does not use unlearned world events | The same test checks disclosed event IDs, inheritance provenance, custody, stable results and hidden records. Sentence wording was UI only and was removed. |
| `test/biography.test.js` | does not turn a learned remote ring inheritance into a household when its item component is missing | The same test checks disclosed event IDs, inheritance provenance, custody, stable results and hidden records. Sentence wording was UI only and was removed. |
| `test/biome_field.test.js` | samples finite normalised varied habitats without world mutation, seed %s | The same test calls the habitat function with a four-cell climate fixture. Normalisation, continuity, altitude, snowline and ecology assertions remain. |
| `test/biome_field.test.js` | agrees at the same physical edge point from either active reach and changes smoothly across it | The same test calls the habitat function with a four-cell climate fixture. Normalisation, continuity, altitude, snowline and ecology assertions remain. |
| `test/biome_field.test.js` | uses continuous sea-level temperature for a shared seasonal snowline, with alpine habitat at altitude | The same test calls the habitat function with a four-cell climate fixture. Normalisation, continuity, altitude, snowline and ecology assertions remain. |
| `test/biome_field.test.js` | refreshes physical habitat and regrowth habitat when a real building pad changes altitude | The same test calls the habitat function with a four-cell climate fixture. Normalisation, continuity, altitude, snowline and ecology assertions remain. |
| `test/chat.test.js` | costs two goodwill and refuses premature help for a %s stranger, then accepts an introduction | The same test checks goodwill, selected response family or kin situation. Connecting prose was UI only and was removed. |
| `test/chat.test.js` | never offers or speaks fair-season lines in %s | UI only, removed. This asserted fair-weather sentence wording, with no simulation effect. |
| `test/chat.test.js` | does not describe close kin as passing acquaintances even with a public bond | The same test checks goodwill, selected response family or kin situation. Connecting prose was UI only and was removed. |
| `test/chat_acceptance.test.js` | answers a children question about children even when the only undisclosed story is a dead sibling | The same catalogue test checks response family and children/workplace situations. Child answers no longer depend on matching sentence wording. |
| `test/chat_acceptance.test.js` | keeps every authored player question on topic: %s | The same catalogue test checks response family and children/workplace situations. Child answers no longer depend on matching sentence wording. |
| `test/chat_guidance.test.js` | keeps one concrete conversation hint after the first contact and after opening progress is dismissed | The same test checks guidance keys, targets, jobs and shelter eligibility. Instruction wording was UI only and was removed. |
| `test/chat_guidance.test.js` | names the real meal that delays a queued conversation | The same test checks guidance keys, targets, jobs and shelter eligibility. Instruction wording was UI only and was removed. |
| `test/chat_guidance.test.js` | guides two actual conversations, shelter supplies and building, then sleep, and returns to people after the first night | The same test checks guidance keys, targets, jobs and shelter eligibility. Instruction wording was UI only and was removed. |
| `test/chat_guidance.test.js` | gives chat guidance while the world is paused for chat | The same test checks guidance keys, targets, jobs and shelter eligibility. Instruction wording was UI only and was removed. |
| `test/chat_guidance.test.js` | points to an eligible explored shelter tile and explains how to select it | The same test checks guidance keys, targets, jobs and shelter eligibility. Instruction wording was UI only and was removed. |
| `test/chat_row_rules.test.js` | marks woodland defiance, charges extra bad will, and records only the real participants' account | The same test selects the refusal by situation and checks defiance, goodwill, participants, learned event IDs and spoken sources. |
| `test/chat_row_rules.test.js` | can speak the recorded defiance account to a later listener through existing event disclosure | The same test selects the refusal by situation and checks defiance, goodwill, participants, learned event IDs and spoken sources. |
| `test/chat_tell.test.js` | speaks the stage label instead of the exact age %i | Life-stage facts and age boundaries remain in `life_stages.test.js`. Exact dialogue labels were UI only, removed. |
| `test/chat_visits.test.js` | knocks at a sleeping resident's door at night, gets no answer and grants no contact | The same test checks refusal before movement, absent chat/contact and the real sleeping resident. Refusal wording was UI only and was removed. |
| `test/chat_visits.test.js` | refuses an unfriendly visit before setting off: %s | The same test checks refusal before movement, absent chat/contact and the real sleeping resident. Refusal wording was UI only and was removed. |
| `test/core_loop.test.js` | spends energy on actual physical effort and slows low energy work | The same test checks energy, physical effort, work eligibility and fire return. Waiting-message wording was UI only and was removed. |
| `test/core_loop.test.js` | keeps work available at dusk and returns to the owned fire only when exhausted | The same test checks energy, physical effort, work eligibility and fire return. Waiting-message wording was UI only and was removed. |
| `test/event_knowledge.test.js` | describes a dated learned wedding with known participants | The same test checks learned events and permitted person/place identities. Connecting sentence wording was UI only and was removed. |
| `test/event_knowledge.test.js` | requires spoken evidence for a visit and real disclosure for a distant historical move | The same test checks learned events and permitted person/place identities. Connecting sentence wording was UI only and was removed. |
| `test/family_history_integration.test.js` | adds beds to a real inline home only after supported paid growth and leaves the other estate and an unfunded workshop alone | The same test checks paid growth, beds, real stores, ownership and the unfunded workshop. Waiting-message wording was UI only and was removed. |
| `test/favours.test.js` | resolves a %s accepted target with explicit text and no reward | The same test checks the accepted target’s resolution and absence of reward. Waiting-message wording was UI only and was removed. |
| `test/fireside.test.js` | defers automatic bedtime while attention is held, then sleeps and skips to dawn | The same test checks sleep, dawn, camp selection or evening guidance state. Morning and instruction wording was UI only and was removed. |
| `test/fireside.test.js` | uses the camp bedroll when Rest replaces a journey order | The same test checks sleep, dawn, camp selection or evening guidance state. Morning and instruction wording was UI only and was removed. |
| `test/fireside.test.js` | explains that work remains available after dark | The same test checks sleep, dawn, camp selection or evening guidance state. Morning and instruction wording was UI only and was removed. |
| `test/first_run.test.js` | closing character creation cancels to the menu without arrival | The same ECS-stub test checks cancellation or generation ownership. A new missing-player guard and three-tile camp handover add focused state coverage. |
| `test/first_run.test.js` | only the explicit Start game action begins arrival | The same ECS-stub test checks cancellation or generation ownership. A new missing-player guard and three-tile camp handover add focused state coverage. |
| `test/first_run.test.js` | ignores start and close actions while generation owns an incomplete ECS | The same ECS-stub test checks cancellation or generation ownership. A new missing-player guard and three-tile camp handover add focused state coverage. |
| `test/geography_foundations.test.js` | keeps a cached border survey private from edits to either arrival's entrance | The same test uses declared adjacent reaches and real reciprocal route contracts. Cache isolation, saved coordinates and terrain clearings remain checked. |
| `test/geography_foundations.test.js` | reconstructs identical border contracts and clearings from both saved pass coordinates | The same test uses declared adjacent reaches and real reciprocal route contracts. Cache isolation, saved coordinates and terrain clearings remain checked. |
| `test/geography_refinement.test.js` | normal terrain includes broad raised gentle land as well as valleys and peaks | The same test samples the original field directly or uses a 61-tile highland pad. Height thresholds and shared corner equality remain checked. |
| `test/geography_refinement.test.js` | house, road and camp pads retain their local highland altitude | The same test samples the original field directly or uses a 61-tile highland pad. Height thresholds and shared corner equality remain checked. |
| `test/geography_refinement.test.js` | normal neighbouring regions keep the same raised shared corner heights | The same test samples the original field directly or uses a 61-tile highland pad. Height thresholds and shared corner equality remain checked. |
| `test/gift_choices.test.js` | distinguishes held, loose, stockpiled and home goods, grouping only equivalent portions at a location | The same test checks amounts, source IDs, grouping, foreign-goods exclusion and purity. Source-label wording was UI only and was removed. |
| `test/gossip_bubbles.test.js` | describes the catalogue's actual spoken event without teaching it on a read | The same test checks the actual spoken event/line IDs, read purity, learning and source attribution. Bubble wording was UI only and was removed. |
| `test/gossip_bubbles.test.js` | hears a traveller's spoken account from the world catalogue without importing its event body | The same test checks the actual spoken event/line IDs, read purity, learning and source attribution. Bubble wording was UI only and was removed. |
| `test/happy_paths.test.js` | starts a new game from the menu, hands over an owned camp and resumes time | Moved to `first_run.test.js`, same title. Three tiles and one player cover owned camp, bed, frozen state and resumed time. |
| `test/happy_paths.test.js` | finishes a festival night, pauses at the season turn and begins the next season | Moved to `seasons.test.js`, same title. A direct dawn crossing covers festival record, season pause, frozen clock and resumption. |
| `test/happy_paths.test.js` | walks to an edge, travels to another hex and hands over the same living player | Moved to `travel.test.js`, same title. The real queued walk and handover retain identity, age, intro and residency assertions. |
| `test/history_items.test.js` | retains complete personal objects and unrelated owned loose goods through physical history | The same test uses later founding or a small family. Creation, later seasonal retention, accounts, physical transfer and distinct same-type objects remain checked. |
| `test/history_items.test.js` | hands over a genuinely inherited object without duplicating or merging same-type heirlooms | The same test uses later founding or a small family. Creation, later seasonal retention, accounts, physical transfer and distinct same-type objects remain checked. |
| `test/history_length.test.js` | derives founding dates and progress text from the history length | The same test keeps founding dates. Progress-label wording was UI only and was removed. The separate 48-transition test remains. |
| `test/i18n.test.js` | allows null | UI only, removed. This tested localisation formatting, not a game rule. |
| `test/i18n.test.js` | is working with multiple depths | UI only, removed. This tested localisation formatting, not a game rule. |
| `test/i18n.test.js` | allows number values | UI only, removed. This tested localisation formatting, not a game rule. |
| `test/info_ownership.test.js` | identifies an animal's household and its house's village without an animal controller or the household's liege | `info_ownership` now tests household repair for animals and the direct head before/after inheritance. Displayed village selection was inline UI logic. See the source boundary above. |
| `test/info_ownership.test.js` | uses the same live household owner for fields and workshops | `info_ownership` now tests household repair for fields/workshops and the direct head before/after inheritance. |
| `test/info_ownership.test.js` | handles an unknown household without inventing a person or a village | `info_ownership` now checks that a missing household controller returns no owner. Unknown-label markup was UI only, removed. |
| `test/info_ownership.test.js` | keeps an unintroduced household owner and assigned worker anonymous without changing knowledge | `info_ownership` now calls the identity resolver only after the current actor learns the owner. The read remains pure. |
| `test/info_ownership.test.js` | keeps an unknown controller anonymous while preserving observable asset names and current heirs | `info_ownership` now checks observable asset identities, current-actor names and an undisclosed heir through the real identity and inheritance functions. |
| `test/life_stages.test.js` | labels age %i as %s | The same test checks stage identity or adult work, marriage and household eligibility. Stage wording and visual body size were UI only and were removed. |
| `test/life_stages.test.js` | starts adult work and deliberate marriage at Young adult (%i) | The same test checks stage identity or adult work, marriage and household eligibility. Stage wording and visual body size were UI only and were removed. |
| `test/manager.test.js` | explains a deferred %s task with a concrete next step | The same test checks deferred task state. Message formatting and its exact next-step sentence were UI only and were removed. |
| `test/mother_family.test.js` | stores named off-map royal history and reciprocal kin, giving only maternal names and kinship at arrival | The same test checks family totals, named backstory records, recognition, goodwill, reciprocal knowledge or guidance state. Authored prose was removed. |
| `test/mother_family.test.js` | offers named searches in chat and recognises the player with a real first-meeting favour, reciprocal knowledge and Personal kin warmth only once | The same test checks family totals, named backstory records, recognition, goodwill, reciprocal knowledge or guidance state. Authored prose was removed. |
| `test/mother_family.test.js` | keeps the named family goal in the first chat hint, followed by the existing shelter and sleep priorities | The same test checks family totals, named backstory records, recognition, goodwill, reciprocal knowledge or guidance state. Authored prose was removed. |
| `test/orientation.test.js` | rejects deliberate courtship and explains incompatible marriage | The same test rejects incompatible courtship and keeps a marriage refusal. Refusal wording was UI only and was removed. |
| `test/overworld.test.js` | skips ocean and unsuitable nearer candidates before accepting the nearest farmable home | The same test calls home selection or survey with an explicit accepted siting result. Land thresholds, terrain clearings, axes and biome independence remain checked. |
| `test/overworld.test.js` | classifies seven surveyed regions from their actual land samples and retains their axes | The same test calls home selection or survey with an explicit accepted siting result. Land thresholds, terrain clearings, axes and biome independence remain checked. |
| `test/overworld.test.js` | requires 60 percent dry land and two grassland rings at the chosen boundary start | The same test calls home selection or survey with an explicit accepted siting result. Land thresholds, terrain clearings, axes and biome independence remain checked. |
| `test/overworld.test.js` | accepts a farmable home of every declared biome and morality | The same test calls home selection or survey with an explicit accepted siting result. Land thresholds, terrain clearings, axes and biome independence remain checked. |
| `test/people_feedback.test.js` | builds a concise disclosed life from real events and item provenance, including remote/dead kin, with an honest unknown state | The same test checks unknown facts, disclosed item/event IDs, provenance, purity and removal of carried-item claims after death. |
| `test/people_orders.test.js` | leaves a collected choice in hand on cancellation and waits if the chosen source disappears | The same test checks real cargo, cancellation, delayed chat, doorstep approach and absence of premature contact. Message wording was removed. |
| `test/people_orders.test.js` | stops waiting for a hungry chat target within one game hour and gives a next step | The same test checks real cargo, cancellation, delayed chat, doorstep approach and absence of premature contact. Message wording was removed. |
| `test/people_orders.test.js` | knocks for an indoor target and opens at the doorstep without premature contact | The same test checks real cargo, cancellation, delayed chat, doorstep approach and absence of premature contact. Message wording was removed. |
| `test/people_panel.test.js` | never labels independently known people as kin or grants traits merely for trust | Kin disclosure: `possession_disclosure.test.js`, “requires a disclosed kin link…”. Heir anonymity: the new direct `heirFor`/`displayName` test in `info_ownership`. Trait knowledge: `chat.test.js`. Card projection is UI only, removed. See the source boundary above. |
| `test/person_activity.test.js` | uses player knowledge for social partner names shared by world and panel labels | Identity permission is tested through `displayName` in `info_ownership.test.js`. Activity-label formatting was UI only, removed. |
| `test/play_session_feedback.test.js` | keeps concrete actor-specific guidance after conversations and dismissal | The same test checks actor-specific guidance keys, request targets and dismissal state. Instruction wording was UI only and was removed. |
| `test/player_day.test.js` | runs the real night in small steps, fades and wakes at dawn (collapse=%s) | The same test checks physical sleep, dawn and restored energy. The morning greeting was UI only and was removed. |
| `test/replay2_findings.test.js` | checks oath eligibility again at enqueue instead of starting an ineligible approach | The same test checks oath eligibility, queue rejection, one game-hour expiry and released attention. Refusal wording was removed. |
| `test/replay2_findings.test.js` | ends an oath approach within the same one hour bound as Chat, releasing attention | The same test checks oath eligibility, queue rejection, one game-hour expiry and released attention. Refusal wording was removed. |
| `test/replay_findings.test.js` | knocks on a sleeping neighbour's real door at night and returns without contact | The same test checks contact, field-work guidance keys or failed harvest state. Instructions and failure-message wording were removed. |
| `test/replay_findings.test.js` | turns owned seed into Create Field, Plough and Sow instructions using existing mechanics | The same test checks contact, field-work guidance keys or failed harvest state. Instructions and failure-message wording were removed. |
| `test/replay_findings.test.js` | retains the actual failed harvest stage instead of a generic supply failure | The same test checks contact, field-work guidance keys or failed harvest state. Instructions and failure-message wording were removed. |
| `test/roads_tracks.test.js` | connects surveyed crossings and village approaches while keeping house and field spurs local | The original test keeps reciprocal through-road classification and excludes private spurs. A separate eight-tile test now checks home/field wear. |
| `test/season_polish.test.js` | groups repeated known life events while preserving every source event and separate reasons | The same test keeps source event IDs and separates departure reasons. Repeated-event summary wording was removed. |
| `test/season_polish.test.js` | %s uses readable places in shared event sentences and news | UI only, removed. This tested readable place or appearance wording. Identity-disclosure rules remain in `event_knowledge`, `seasons` and `realm_map`. |
| `test/season_polish.test.js` | uses visible appearance instead of an indistinct generated cottage label | UI only, removed. This tested readable place or appearance wording. Identity-disclosure rules remain in `event_knowledge`, `seasons` and `realm_map`. |
| `test/seasons.test.js` | puts life news first, groups thirteen harvests and ends with the player season | The same test checks source event groups, ordering, the numeric overflow count and actor-scoped identities. Fixed news prose was removed. |
| `test/seasons.test.js` | caps busy news, preserves work and personal news, and counts only omitted known records | The same test checks source event groups, ordering, the numeric overflow count and actor-scoped identities. Fixed news prose was removed. |
| `test/seasons.test.js` | uses a family-goal name only when it was already given to this actor | The same test checks source event groups, ordering, the numeric overflow count and actor-scoped identities. Fixed news prose was removed. |
| `test/seasons.test.js` | describes witnessed strangers by a visible house without naming or introducing them | The same test checks source event groups, ordering, the numeric overflow count and actor-scoped identities. Fixed news prose was removed. |
| `test/settlement_details.test.js` | shows the actual inherited centre household without disclosing an unknown person | The same test checks the live owner and permitted name, or learned construction event ID/date. Date and biography wording was removed. |
| `test/settlement_details.test.js` | only puts learned construction events in a biography and reports their real date | The same test checks the live owner and permitted name, or learned construction event ID/date. Date and biography wording was removed. |
| `test/settlement_history.test.js` | constructs the village from one actual household, with later dated homes and a persistent centre | The original founding test keeps dated homes, real founders, clearance and centre continuity. New single-household tests cover account balance, reachable fields, meeting trips and return crossings. |
| `test/social_mobility.test.js` | walks to a real friend in another community, chats there and walks home | The same test checks real social plans, movement, meal interruption and visits. Activity-label wording was UI only and was removed. |
| `test/social_mobility.test.js` | interrupts a visit for a real meal and returns instead of retaining a stale courting label | The same test checks real social plans, movement, meal interruption and visits. Activity-label wording was UI only and was removed. |
| `test/space_pause.test.js` | pauses a running game and resumes at normal speed | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/space_pause.test.js` | resumes at normal speed when nothing was running before | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/space_pause.test.js` | leaves typing, held keys and other keys alone | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/space_pause.test.js` | stops space from also pressing a focused button | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/succession_controls.test.js` | reports a new stranger truthfully when the recorded heir also died before handover | The same test checks the new actor, succession state and unclaimed estate. The announcement wording was UI only and was removed. |
| `test/succession_knowledge.test.js` | uses only the heir's own genuine spoken contact for biography and trust (own contact=%s) | The same test checks the heir’s own contact, trust goal, feelings and travel retention. Biography greeting wording was UI only and was removed. |
| `test/ticker.test.js` | passes each listener a frame multiplier of 1 per 60th of a second | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/ticker.test.js` | caps a long frame at a tenth of a second, like the old PIXI ticker | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/ticker.test.js` | stops asking for frames once destroyed | UI only, removed. Game-time progression and paused simulation remain covered by `simulation.test.js`. |
| `test/travel.test.js` | offers all six sides consistently at corners and blocks ocean and world rim |  |
| `test/village_customs.test.js` | gives honest elder progress and Chat routes without promising a stocked household favour | The threshold test keeps oath rejection below ten goodwill. The warning test keeps answer situations, defiance, goodwill and hidden tastes. Progress wording was removed. |
| `test/village_customs.test.js` | keeps goodwill below the oath threshold visibly below 10 | The threshold test keeps oath rejection below ten goodwill. The warning test keeps answer situations, defiance, goodwill and hidden tastes. Progress wording was removed. |
| `test/village_customs.test.js` | still opens an answerable warning with spent patience and changes no hidden tastes | The threshold test keeps oath rejection below ten goodwill. The warning test keeps answer situations, defiance, goodwill and hidden tastes. Progress wording was removed. |
| `test/village_customs_readiness.test.js` | returns a clear refusal when a real queued approach reaches an elder who became tired | The same test checks fatigue cancellation, released attention, offer/answer families, rights and membership. Refusal and rights prose was removed. |
| `test/village_customs_readiness.test.js` | explains native fatigue cancellation via %s without awarding an oath or contact | The same test checks fatigue cancellation, released attention, offer/answer families, rights and membership. Refusal and rights prose was removed. |
| `test/village_customs_readiness.test.js` | offers the eligible oath in ordinary chat and explains all rights before acceptance | The same test checks fatigue cancellation, released attention, offer/answer families, rights and membership. Refusal and rights prose was removed. |
| `test/village_customs_readiness.test.js` | acknowledges declining a customs offer without repeating old warning news: member %s | The same test checks fatigue cancellation, released attention, offer/answer families, rights and membership. Refusal and rights prose was removed. |
| `test/village_generation.test.js` | rejects an unestablished infeasible hamlet without dropping a person or consuming unrelated stock | The same test rejects three rocky unbuilt opportunities and preserves the unrelated person, stock and event list. It uses real reservation failure. |
| `test/villages.test.js` | keeps winter crops dormant and deterministically varies growing-season progress | The same test uses direct crop/animal updates or one farming household with a foreign field. Dormancy, movement bounds, paused state, replay and physical crop/haul outcomes remain checked. |
| `test/villages.test.js` | lets the family plough, sow, harvest and haul only its own fields into its household store | The same test uses direct crop/animal updates or one farming household with a foreign field. Dormancy, movement bounds, paused state, replay and physical crop/haul outcomes remain checked. |
| `test/villages.test.js` | keeps household animals inside fenced pens and pastures throughout movement, with paused time still | The same test uses direct crop/animal updates or one farming household with a foreign field. Dormancy, movement bounds, paused state, replay and physical crop/haul outcomes remain checked. |
| `test/villages.test.js` | replays generation and moving animals exactly for the same seed | The same test uses direct crop/animal updates or one farming household with a foreign field. Dormancy, movement bounds, paused state, replay and physical crop/haul outcomes remain checked. |

The new tests also reject starting without a player, separate local spur wear from through roads, and test anonymous heir identities without React. No business assertion from the two retained journeys was deleted. The item-retention fixture includes an actual later seasonal step.

Commits

- `2e1a87b`: Split arrival, route and settlement rules into focused fixtures.
- `ac168c3`: Keep rule and disclosure checks outside rendered views.
- `2005322`: Use component fixtures for climate, siting, history and village work.
- `b141a6c`: Remove the remaining fake-DOM readiness cases and keep a foreign field in the small farming fixture.

The report is committed separately. Nothing was pushed.
