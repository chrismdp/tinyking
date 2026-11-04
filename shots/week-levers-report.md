# Where the player can change the week

Research against `a2c0cba3b4c5d64e2ea6e66aed5cdd4a78efaced`, on `research/week-levers`, 4 November 2026. No gameplay code changed.

The player can change when people meet by walking, giving food and seeking attention. The question is how much control that gives over an intended outcome. The experiments below distinguish completed gifts and conversations from approaches that never reach their target. A changed schedule is evidence of influence; it is weaker evidence that learning a family's troubles lets the player resolve them.

Much of seed 13's apparent drama happens before the player arrives. Its two deaths, four inheritances, two weddings, their moves and one departure all occur at midnight on day 1. The player arrives at 09:00. Learning about those events in a first game gives no opportunity to prevent them in the second.

The ten-seed survey below counts ordinary visits separately from quarrels, reconciliation, courtship and household changes. Recurring meals and many visits do not, by themselves, establish enough distinct choices for every weekly seed.

The highest-value additions use existing trust, contacts, avoidance, courtship and food. Give a trusted third person a way to bring an argument forward to reconciliation. Let the player arrange a willing pair's existing visit. Make a completed courting visit start the existing courtship clock. These make knowledge useful for a chosen outcome.

The live export and the headless week do not have identical timelines. Sixty-one shared person records agree on age, death and household. Of the 198 supplied historical events, 196 match exactly apart from news awareness. Two use different newly assigned family identities. The export's player and newly created uncle also have different entity IDs. Exact reproduction of that recorded week remains unproved.

<!-- BEGIN RESULTS -->
## Comparison with the played week

The comparison reads `/home/cp/code/tinyking-research/spikes/scenes/seed13-week.json` without changing it.

| Observation | Played export | Headless control |
| --- | --- | --- |
| Shared person records checked for age, death and household | 61 | 0 differences |
| Historical events compared, excluding changing news awareness | 198 | 196 exact matches |
| Visits after arrival | 164 | 84 |
| Quarrels after arrival | 5 | 5 |
| Reconciliations after arrival | 3 | 1 |

The two historical differences are `terrain5_3-event-1161` (Hugh's household arrival) and `terrain5_3-event-1168` (the sealed backstory death). Their new family IDs differ. The generated player is `terrain5_3-person-3904`; the export's player is `terrain5_3-person-3901`. Hugh is `terrain5_3-person-4147` here and `terrain5_3-person-4143` there. All 24 midnight events on day 1 match before news awareness changes.

The control contains 46 of the export's 118 distinct event-kind/person-pair combinations. Their times can still differ. The export stops at D7 21:40, before the control's end. It also includes Maren's four conversations and partial food deliveries. The export does not contain the original frame and input stream. These differences limit claims about preventing a particular event in that recorded session.

The 12 separately run controls have the same SHA-256 observation hash, `e1d803eafb406bb2404027d8d80415e9b606cd59f2d94e45a9c2ac319a564a06`. This covers events, hourly hunger spells, hourly visit observations, courtship changes and final sampled residents. The independently compiled production Node bundle produces the same hash.

Two courtships already exist at arrival: Maud Thuson / Laurence Yaforlo (w5_3-social-92 / w6_3-social-101); Cecily Bobarin / Edwin Thuforrun (w5_3-social-94 / w6_3-social-113). Both start at season 0. Their ledger does not change during the control or any treatment. They are distinct from the two Cecily–Stephen visits labelled as courting in the export.

The finer replay uses 36 game seconds per call. It produces 156 / 3 / 4 visits / quarrels / reconciliations. Its hash is `c6d1dc4ab8b5128fe83d662cc4cdeccc56ce644a773a9fdc7c4101563d7a84ad`. The same seed at different frame intervals therefore changes the observed week. The pairs use the fixed six-minute interval throughout.

<!-- END RESULTS -->

## What was measured

`scripts/research/week-levers.cjs` calls the real `generateWorldGame` for seed 13. That calls `generateWorldHistory`, builds the starting terrain and prepares its neighbours. The survey calls `generateWorldHistory` and `ensureMap` for the starting hex. Neighbouring communities keep their normal summary simulation. Their unopened terrain is unnecessary while the player stays here. Seed 1's initial cache also came from the complete generation path.

Every run restores the same generated object graph, through `gameData`, Node's `v8` serialisation and the game's `replaceGame`. This preserves shared references and planner values such as `undefined`. There are no invented people, altered stores, goodwill grants, forced marriages or teleports. The player uses the generated character, William Clebasi, with the same traits as the export's Maren. The headless driver skips the arrival animation through the game's own `startGame` option.

The observed season runs from day value `0.375` to `6.9999884259`: day 1 at 09:00 through day 7 at 23:59:59. Midnight at `7` starts the next season's ageing, deaths and births. Those events do not belong in this count. The primary runs use `frameMod = 6` and `realSeconds = 0.1`. This advances 36 game seconds per normal call: the maximum allowed by [`ticker.js`](../src/game/ticker.js), `createTicker` and its 100 ms cap. The supplied real-time value models a fixed 100 ms browser frame. Node runs the batch as fast as possible. This value enables the simulation's normal sleep fade and 120-fold night-time acceleration, which slices its own work into steps of at most one game minute. The driver bounds the last call before the next season. Printed times round down to the minute. These runs use one fixed, valid browser cadence; they do not reproduce the export's unknown rendering cadence.

`createSimulation` runs the actual hourly needs, task planners, walks, conversations, food collection, gifts and world arrivals. When an unsolicited conversation panel opens, the observer closes it without choosing a line. Scripted conversations choose actual available lines through `chatChoices` and `chooseLine`. Panels pause the simulation in the live game too. The driver never grants itself a missing answer, offer or piece of news.

The interaction orders use the same `enqueueTask` path as [`world.js`](../src/components/world.js), `talk_to`. [`person_panel.js`](../src/components/person_panel.js) offers Chat and Give a gift for a living present person, including an unidentified person. The five discovery probes also enforce the renderer's discovered-tile and outdoor-body conditions from [`world_view.js`](../src/render/world_view.js). Walking discovers real tiles. The scripts do not reveal the map or grant the protagonist the observer's knowledge.

The starting hex contains Reedbrook and Reedford. The seed survey uses the village nearest the arrival camp, separately from the whole starting hex. The distance uses the village centres and the saved camp point, matching the approach in `seedMotherFamily`. A visit belongs to the destination village, as `recordEvent` defines it. Hunger counts living starting residents, rather than visitors' host villages. Courting visits are a subset of visits. They are not extra courtship events.

## Why these things happen

NPC means a person controlled by the simulation. Goodwill is their directional regard for another person. The existing Public, Social, Personal and Intimate rings describe relationship closeness.

These cause keys apply to the event inventory below. The inventory includes every exported event dated within the calendar week. It distinguishes events already complete at arrival from the events during play.

| Key | Cause and code path | What the player can reach |
| --- | --- | --- |
| A: Old age | [`social.js`](../src/game/social.js), `advanceSeasonRules`, adds two life years and samples `hashUnit(peopleSeed + ":social:death:" + id + ":" + season)`. [`life_stages.js`](../src/game/life_stages.js), `oldAgeDeathChance`, supplies the age risk. `die` records the result. | Food, conversation and goodwill do not enter this calculation. Both seed-13 deaths occur before arrival. |
| B: Inheritance | [`possessions.js`](../src/game/possessions.js), `die` → `heirFor` → `transferPossession`, chooses a living spouse, then the eldest living child, then the nearest living kin layer. House ownership and unique objects transfer separately. | The four records already exist at arrival. Giving the heir food cannot change their legal cause. |
| C: Reconciliation | [`social_actions.json`](../src/data/social_actions.json), `reconcile`, runs at a completed contact or household season after avoidance expires, if its seasonal attempt remains available. [`social_actions.js`](../src/game/social_actions.js), `runSocialActions`, restores six goodwill each way. [`event_types.json`](../src/data/event_types.json) clears avoidance and restores three goodwill for listeners whose kin were involved. | Needs, walking and available time can delay the next contact. Chatting to each party does not presently satisfy a mediation rule. Hearing the reconciliation can repair a kin listener's regard. |
| D: Quarrel | [`social.js`](../src/game/social.js), `chatTogether`, calls `runSocialActions("contact")`. Household pairs also run through `runSeasonSocialActions`. Negative goodwill in either direction enables `quarrel`. Otherwise a hate disposition enables `quarrel_friction`. A fixed sample uses the pair, action and season. | A completed conversation is an opportunity, not a guaranteed quarrel. Food and attention can change whether that opportunity occurs. Gifts and chat principally change regard towards the player. They do not directly repair this NPC pair. |
| E: Marriage | [`social.js`](../src/game/social.js), `courtTogether` → `marry` → `coupleHouse`, requires age, kin, orientation, consent, the courtship wait and a suitable household. Ordinary automatic courtship also requires recent completed contact. | Both exported weddings precede arrival. Future meetings can earn goodwill, but the player has no existing command to introduce two NPCs to each other. |
| F: Move | `marry` calls `moveHouse`, which changes household membership, records both villages, clears stale work and sends the mover home. [`travel.js`](../src/game/travel.js), `advanceWorldClock`, converts a married visitor's temporary residence into `world_move`. | These seed-13 moves already happened. Moving the player or helping an heir does not undo them. |
| G: Departure | [`travel.js`](../src/game/travel.js), `journeyIntent` → `departNpc`, considers an adult without a living spouse or commitment. A resident needs the fixed traveller trait and no viable local romantic prospect. A visitor can return after three seasons without a prospect. Routes and destinations must exist. | Maud's departure is already in the generated history. A future invitation to stay must enter this rule explicitly. |
| V: Visit | [`social_visits.js`](../src/game/social_visits.js), `runSocialHour`, selects idle residents, prioritises compatible partners, then regard, possible news and distance. Avoidance, a visit earlier that day, routes, hunger, fatigue and work restrict the candidates. [`tasks.js`](../src/game/tasks.js), `socialise`, requires proximity and half an hour before `chatTogether`. It records the first completed contact. `visit_other_village` records cross-village contacts. | A food gift or conversation can change a participant's work, needs and available time. The experiments prove particular changes, not that every listed visit can be cancelled on demand. |
| H: Hunger | [`needs.js`](../src/game/needs.js), `updateNeeds`, adds time since the last NPC meal. [`simulation.js`](../src/game/simulation.js), `updatePlannerFrame`, requests food above `0.9`. [`compound.js`](../src/game/compound.js), `person` and `find_food`, and [`tasks.js`](../src/game/tasks.js), `eat`, use real household, carried and gathered food. | Food gifts and food favours are real supplies. A gift does not itself reset hunger. [`hunger.js`](../src/game/hunger.js), `hungerSpeed`, sets speed to 0.8 above 0.9 days and 0.6 above 2.5. Missed meals cause neither sickness nor death. |

A normal quarrel chance is `1 - 0.92^4 = 28.360704%` per eligible contact attempt. The hate-only friction chance is about `0.59865%`. Each action gets one attempt per pair per season, including a failed sample. Six summary household conversations combine these chances. A quarrel costs six goodwill each way and creates `7 / 4 = 1.75` days of avoidance. The next eligible contact can reconcile after that time. Each pair can use reconciliation once per season. The conversion comes from [`social_clock.js`](../src/game/social_clock.js), `lifeClockChance` and `lifeClockSeasons`. Retelling the same news does not repeat its effects: [`events.js`](../src/game/events.js), `learnEvent`, checks existing knowledge first.

Gillian Thubaho dies aged 92, with an old-age risk of about 45.25% for that boundary. Her living child Andrew Jobari receives her brooch and house. The older Agnes Friforrin dies aged 62, with a risk of about 3.36%. Her living husband Hugh Seesi receives her brooch and house. A younger living Agnes Friforrin also appears in the week. Event and person IDs distinguish the namesakes.

The two opening-midnight weddings join Henry Seesi with Gunnilda Frifoblo, and Isabel Frifoblo with Luke Thuson. Henry and Luke move into their partners' existing households. Luke also changes his world residence from visiting to settled. These are consequences of the generated relationships and housing, not authored scenes.

The live export's consequential social events have these individual causes. Regard is directional: liking someone does not mean they like you. The numbers below are the generated starting bonds. The source rules and event order identify the later changes. The raw headless runs retain each observed pair's bonds before and after the frame that records its event.

| Exported time | People and event | Individual cause | Player's reach |
| --- | --- | --- | --- |
| D1 10:55 | Margaret Seesi / Andrew Seesi quarrel | Andrew hates Margaret and starts at −1 regard. Margaret loves him and starts at 32. The regular quarrel sample is `0.17218`, below `0.28360704`. | Can change encounter timing through a real gift order; the primary pair below gives the measured outcome. Preventing this particular exported 10:55 event is unproved because the recorded input stream is unavailable. A trusted mediation hook adds intentional healing. |
| D1 17:02 | Margaret Seesi / Gunnilda Thuforrun quarrel | Gunnilda hates Margaret. They start without a bond. Their first visit contact is at 16:32. A hated conversation loses one goodwill, enabling the regular quarrel at the next contact. Its sample is `0.20585`. | Can interfere with the meeting's timing. This specific exported quarrel is absent from the headless control, so prevention is unproved. A trusted mediation hook targets the cause. |
| D1 20:33 | Sybil Bobarin / Alice Frifoblo quarrel | Alice hates Sybil and starts at −3. Her father Nicholas quarrels with Sybil at the opening midnight. Learning that family news explains the −3 through `onLearn`. Sybil loves Alice and starts at 16. The regular sample is `0.20562`. | A coarse diagnostic Chat probe was refused because Sybil hates William. Food orders change contact schedules in the primary experiments below. Prevention of this particular exported event remains unproved. |
| D2 20:59 | Sybil Bobarin / Alan Thuson quarrel | Alan hates Sybil and starts at zero. Sybil starts at 24.8 towards Alan. Their first recorded contact is at 20:29. Its negative goodwill enables the next contact's regular sample, `0.20517`. | Food and attention can change when they meet. A purposeful repair of this pair's regard is not demonstrated. |
| D4 17:45 | Margaret Seesi / Andrew Seesi reconcile | Their D1 quarrel's avoidance ends at D3 04:55. Their next eligible completed contact records peace and restores six goodwill each way. | Can change the contact schedule. Direct third-person reconciliation needs the proposed hook. |
| D4 20:16 | Elias Bobarin / Alice Frifoblo quarrel | Elias starts at zero towards Alice and has a like disposition. Alice loves him. Elias is Sybil's father: hearing her quarrel with Alice can cost him three goodwill towards Alice. This supplies the cold relationship for sample `0.25495`. | News has an existing path into this cause. Preventing or resolving Sybil's quarrel before its news spreads avoids the family penalty. No direct command currently makes that peace. |
| D4 20:31 | Margaret Seesi / Gunnilda Thuforrun reconcile | Avoidance from their D1 quarrel expires at D3 11:02. The next eligible contact heals six goodwill each way. Gunnilda's fixed hate disposition remains. | Contact timing is reachable. Deliberate mediation needs the small change. |
| D5 15:05 | Edgar Thuson / Christina Thuson reconcile | They quarrel at the opening midnight. Edgar starts live play at −12 towards Christina. Their avoidance expires at D2 18:00, but peace waits for contact on D5. | A coarse diagnostic Chat probe was refused because Edgar hates William. A trusted helper can add a purposeful path to the same existing reconciliation rule. |
| D4 11:49; D5 14:07 | Cecily Bobarin / Stephen Frifoblo have courting visits | They start at Social with 26.4 goodwill each and like each other. Later completed contacts earn mutual Personal consent. `canCourt` is true at the two recorded courting visits. The live contact hook does not start a new local courtship. | Can change their free time and thus the meetings. A consenting introduction and the existing courtship clock add a deliberate lever. No wedding for them occurs in the export. |

## The player's current reach

| Action | Existing effect | Limit for changing someone else's story |
| --- | --- | --- |
| Give food | `enqueueTask` → `collect_gift` → `get_attention` → `talk("give_gift")` transfers one real portion. `giftGoodwill` considers tastes, hunger and disposition. A held edible item can become a later meal. | It changes the recipient's regard for the giver. It does not directly improve regard for another NPC. `get_attention` reserves the target before the player walks there. It also waits while the target's hungry or tired flag is set. |
| Chat | `approach_chat` → `openChat` → `chooseLine` → `speakLine` records contact, discloses stated facts and awards regard for matched icons. | There is no flat chat reward. The conversation panel pauses everyone. The approach and release can displace a meeting, but time does not advance while the player stays in the panel. |
| Complete a favour | [`favours.js`](../src/game/favours.js), `acceptFavour`, needs a real spoken offer. `tasks.js`, `do_favour`, delivers real cargo or harvest. `finishFavour` records a favour and rewards the requester’s regard. | The player cannot grant themselves an offer, deliver another household's food as their own, or collect a reward for an unfinished request. Food requests change stores, not an NPC pair's feelings. |
| Work beside someone | The player can help through real harvest and fuel requests. [`friend_help.js`](../src/game/friend_help.js), `friendEligible` and `friendWork`, lets a Personal or Intimate friend help the player's building or field. | There is no general order to spend a work session with any chosen pair. `help_friend_work` and `tend_garden` do not themselves call `chatTogether` or award mutual NPC goodwill. Work changes supply and schedules. |
| Tell news | [`chat.js`](../src/game/chat.js), `effects`, discloses a permitted known event through `learnEvent`. Quarrel news costs a close-kin listener three goodwill towards their relative's opponent. Reconciliation news restores three. | The speaker must know and be allowed to disclose the event. A listener who already knows it receives no second effect. Gossip about an argument can spread hostility rather than heal it. |
| Court or marry | [`family.js`](../src/game/family.js), `familyConversation`, uses deliberate `eligiblePartner` and orientation checks. Court completes a timed conversation through `chatTogether`. Ask to marry requires mutual Personal regard, willingness and room in a family home. | This can make the player a spouse and change future heirs or housing. It does not alter the two weddings already complete at arrival. This route is source-confirmed and untested in this batch. |
| Invite someone home | `canInviteHome`, `householdRoom` and `familyConversation("invite_home")` require an owned completed house, a single adult, mutual Personal regard and a spare place. They call `moveHouse` and record `household_join`. | A real existing route to a new move. It needs a house and consent, so a fresh camp does not supply it. This route is untested in this batch. |

The seed survey measures autonomous community events. It does not exhaust the player's own marriage, house-building or settlement goals. Its finding is about the variety of observed social situations and the tested ways to change them.

<!-- BEGIN EXPERIMENTS -->
## Controlled experiments

Each row is two separate week runs from the same cached seed-13 state. The treatment changes only the stated public player orders and available conversation choices. The three counts are visits / quarrels / reconciliations for the whole starting hex. Refused actions remain negative results.

The six original API probes select their target by identity without a visibility prerequisite. They establish engine behaviour and expose early attention reservation. The five `visible-` probes first walk to the remembered household through ordinary orders. They only select an NPC on a discovered tile, outside a building, as the map permits. They grant no acquaintance, trust or map visibility. These five pairs test reach through normal discovery.

A final pair answers Hugh Seesi's naturally opened campfire conversation. Its control closes the same invitation immediately. This tests an actual conversation response without relying on an approach completing.

| Pair | Scripted intention | Without action | With action | Observed result |
| --- | --- | --- | --- | --- |
| visible-food-juliana | Juliana Thuho, from D1 09:00 | 84 / 5 / 1 | 76 / 5 / 0 | Gift completed D1 15:24. 0 player lines chosen. 0 favours completed. Quarrels absent: Roger Friforrin / Luke Thuson. |
| visible-chat-mabel | Mabel Frifoblo, from D1 09:00 | 84 / 5 / 1 | 86 / 4 / 0 | No gift completed. 0 player lines chosen. 0 favours completed. Quarrels absent: Agnes Friforrin / Hugh Jobari, Sybil Bobarin / Alice Frifoblo, Roger Friforrin / Luke Thuson. |
| visible-news-hugh | Hugh Jobari, from D4 09:00 | 84 / 5 / 1 | 83 / 5 / 1 | No gift completed. 0 player lines chosen. 0 favours completed. All control quarrel pairs remain. |
| visible-food-margaret | Margaret Seesi, from D1 09:00 | 84 / 5 / 1 | 92 / 4 / 1 | Gift completed D1 13:48. 0 player lines chosen. 0 favours completed. Quarrels absent: Sybil Bobarin / Alice Frifoblo, Roger Friforrin / Luke Thuson. |
| visible-favour-mabel | Mabel Frifoblo, from D1 09:00 | 84 / 5 / 1 | 86 / 4 / 0 | No gift completed. 0 player lines chosen. 0 favours completed. Quarrels absent: Agnes Friforrin / Hugh Jobari, Sybil Bobarin / Alice Frifoblo, Roger Friforrin / Luke Thuson. |
| food-juliana | Juliana Thuho, from D1 09:00 | 84 / 5 / 1 | 84 / 4 / 0 | One berry portion arrives at D1 14:06. Sybil–Alice's quarrel and later reconciliation disappear. Sybil–Alan and Elias–Cecily quarrel instead. Juliana's first hunger spell has the same peak, 2.25 days, in both runs. |
| food-margaret | Margaret Seesi, from D1 09:00 | 84 / 5 / 1 | 84 / 3 / 1 | One berry portion arrives at D1 13:18. Margaret–Andrew's quarrel moves from D1 11:24 to D4 13:24. Alan–Christina reconcile at D5 16:00. Margaret's first hunger peak rises from 1.375 to 2.417 days. |
| chat-sybil | Sybil Bobarin, from D1 09:00 | 84 / 5 / 1 | 84 / 5 / 1 | The game refuses the order because Sybil hates the player. Every recorded event, hunger spell, visit, courtship and final sampled state is identical. |
| chat-edgar | Edgar Thuson, from D2 09:00 | 84 / 5 / 1 | 84 / 5 / 1 | The game refuses the order because Edgar hates the player. The same full observation hash is unchanged. |
| favour-mabel | Mabel Frifoblo, from D1 09:00 | 84 / 5 / 1 | 86 / 4 / 0 | The player approaches Mabel to ask about help. No conversation panel with Mabel opens, no request is accepted and no favour is completed. The approach still changes meetings. This is a failed favour attempt, not proof of a favour reward. |
| news-hugh | Hugh Jobari, from D4 09:00 | 84 / 5 / 1 | 83 / 5 / 1 | The player approaches Hugh to tell news at D4 09:00. No news line is spoken. One visit disappears and several contact times move. The causal effect of actually telling news remains unproved by this pair. |
| respond-hughseesi | Hugh Seesi, from D1 09:00 | 84 / 5 / 1 | 84 / 5 / 1 | The player answers Hugh Seesi's actual campfire conversation instead of closing it immediately. This uses the naturally opened panel, with no remote selection or invented acquaintance. 11 player lines chosen. Hugh's final goodwill towards the player: 0 → -3.4357142857143046. |

The Hugh news attempt records 0 chosen lines. No news line is spoken.

The gift experiments include an early attention reservation. [`player.js`](../src/game/player.js), `player_jobs`, runs `get_attention` before walking to the recipient, and `get_attention` has no proximity check. A distant gift order can therefore remove someone from another meeting before the food arrives. That code path explains why Margaret's 13:18 delivery can change an 11:24 quarrel. The measured effect includes this behaviour. It does not prove that eating the gift heals a feud.

Neither early gift reliably improves the recipient's first hunger spell. Feeding and mediation need separate evidence. A future physical attention check will require these particular results to be measured again.

<!-- END EXPERIMENTS -->

## Missing levers, in order

These are proposals, not implemented or tested changes. They reuse existing state. The ranking favours a choice of intended outcome over another way to disturb a schedule.

The measurements establish repeatability at one fixed browser cadence. They do not test all rendering schedules. A fixed simulation step offers one way to support shared tips, but the earlier oversized-step diagnostic is not proof that normal devices currently diverge. Test two valid browser schedules before treating this as a required fix.

| Rank | Small change | Distinct choice added | Events it addresses |
| --- | --- | --- | --- |
| 1 | After a third person both parties trust at Personal or closer completes a recent conversation with each, let their existing avoidance expire early. Reuse `social.contacts` and directional rings. Let the next actual contact run the available existing `reconcile` action. Keep its once-per-season rule. | Spend the morning earning trust and hearing both sides, then choose which feud to help. The NPCs still need to meet. | Quarrels whose parties can trust the helper, and their later reconciliations. The helper cannot undo opening-midnight arguments. |
| 2 | Let a consenting introduction request use the existing visit planners and routes. Require the introducer's existing trust with both people. Keep `eligiblePartner`, avoidance, needs and housing rules. | Bring a compatible pair together, encourage an estranged family to meet, or leave them alone. Learning who likes whom becomes useful. | Visits, reconciliation opportunities and the Cecily–Stephen courting visits. |
| 3 | Call `courtTogether` with fractional season time after a real completed courting contact in `tasks.socialise`. Keep the existing wait, orientation, kin and housing checks. | Helping a pair meet starts actual progress during the played week. | Courting visits can display `courting: true` without creating a new local courtship. Love waits 3.5 days. Practical courtship waits seven, so a new Cecily–Stephen courtship cannot marry within this calendar season. |
| 4 | Permit a food gift's physical handoff while the recipient is hungry. Replan their existing meal task after receipt, instead of waiting in `get_attention` for hunger to clear. | Bring a meal before a neighbour misses work or a meeting. Choose a household and a time, not just a gift recipient. | Hunger and the visits that hunger interrupts. It does not add sickness or make food prevent old age. |
| 5 | Let a resident's existing Personal bond and a recent accepted `invite_home` contact count as a reason to postpone a future `journeyIntent` departure. Reuse the invitation event, home and relationship. | Help someone stay, or accept that they want to leave. | Future departures and visits. Maud has already left in this seed. |
| 6 | Extend the existing wood favour to a consenting couple's funding household. Deliver timber to its real store and use the existing `coupleHouse` or `constructHome` check. Today wood requests only cover workplace fuel. | Support one household's establishment when a wedding lacks a home. | Future weddings and moves. This does not alter either opening-midnight wedding. |

The pre-arrival deaths, inheritances, moves, weddings and departure have a calendar boundary, rather than a missing social hook. There is no honest small goodwill change that lets an action at 09:00 prevent an event at midnight. To make those particular events choices, start play before that boundary or spread the seasonal transitions through live time. Both are larger scheduling changes. An early inheritance conversation can instead use the existing `transferPossession` gift path for a voluntary bequest before a future death. That still cannot rewrite an inherited estate already recorded at arrival.

Fixed hate also caps a relationship at the Public ring in [`people.js`](../src/game/people.js), `relationshipCap`. William cannot earn Personal trust from someone who hates him by repeating gifts. A mediation rule that requires trust must keep that limit. Some families need a different helper, or remain reachable only through meeting schedules. The source alone does not prove that the player can recruit such a helper today.

The Thuson reconciliation is a useful first target for mediation. The exported week shows Edgar and Christina make peace after opening-midnight quarrels. Restoring their bond through a trusted helper gives the player a reason to learn the family. Letting the quarrel continue is then a different choice, rather than a failure to find the same food delivery.

<!-- BEGIN SURVEY -->
## Seeds 1 to 10

These are post-arrival events before the next seasonal boundary. The extra-kinds column counts deaths, sickness, births, inheritances, marriages, moves and departures whenever they occur. An omitted kind has a count of zero. Old age and most family transitions run at season boundaries. Existing mature courtships can still marry after fresh contact.

| Seed | Starting village | Residents | Visits | Quarrels | Reconciliations | Courting visits | Courtship changes | Hungry people | Hunger above 2.5 days | Homes asking for food | Extra event kinds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thornbrook | 25 | 22 | 0 | 0 | 0 | 0 | 25 | 21 | 3 | None |
| 2 | Reedford | 16 | 36 | 3 | 2 | 1 | 0 | 16 | 7 | 2 | None |
| 3 | Thornbrook | 12 | 15 | 2 | 1 | 0 | 0 | 12 | 2 | 2 | None |
| 4 | Thornbrook | 11 | 22 | 1 | 0 | 0 | 0 | 11 | 5 | 1 | None |
| 5 | Thornbrook | 18 | 27 | 1 | 0 | 0 | 0 | 18 | 17 | 3 | None |
| 6 | Hazelbrook | 12 | 35 | 0 | 0 | 0 | 0 | 12 | 2 | 3 | None |
| 7 | Ashbrook | 29 | 33 | 3 | 0 | 0 | 0 | 29 | 20 | 5 | None |
| 8 | Reedbrook | 28 | 38 | 1 | 0 | 1 | 1 | 28 | 18 | 4 | move: 1, marriage: 1 |
| 9 | Thornbrook | 26 | 32 | 3 | 0 | 0 | 0 | 26 | 22 | 5 | None |
| 10 | Ashbrook | 20 | 30 | 1 | 1 | 0 | 0 | 20 | 13 | 2 | affair_meeting: 1 |

The whole starting hex, including the other villages, produces:

| Seed | Visits | Quarrels | Reconciliations | Courting visits | Hungry people | Hunger above 2.5 days | Extra event kinds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 68 | 2 | 0 | 0 | 64 | 51 | None |
| 2 | 71 | 4 | 3 | 4 | 37 | 22 | None |
| 3 | 52 | 4 | 1 | 0 | 31 | 7 | None |
| 4 | 63 | 3 | 0 | 0 | 37 | 23 | None |
| 5 | 86 | 5 | 1 | 0 | 69 | 55 | None |
| 6 | 36 | 0 | 0 | 0 | 14 | 2 | None |
| 7 | 82 | 5 | 0 | 0 | 60 | 43 | None |
| 8 | 105 | 6 | 3 | 1 | 69 | 54 | move: 1, marriage: 1 |
| 9 | 74 | 7 | 3 | 0 | 59 | 42 | None |
| 10 | 59 | 2 | 1 | 0 | 35 | 26 | affair_meeting: 1 |

Hunger is a sampled need, not a recorded story event. Each person counts once even when they need several meals. Above 2.5 days, `hungerSpeed` drops to 0.6. A courting visit can repeat the same pair; it does not prove a new courtship or a wedding.

Quarrels occur in 8/10 starting villages. Reconciliation occurs in 3/10. Courting visits occur in 2/10. A courtship ledger changes in 1/10. These are ten specified seeds, not a population estimate.

Across the whole starting hex, weddings occur in 1/10 seeds, deaths in 0/10, and departures in 0/10. The tables retain the rare kinds instead of treating all activity as visits.

I do not count this as evidence that every seed supplies enough distinct choices. Visits and recurring meals provide activity. The tested gifts prove that intervention can change a week. They also expose broad scheduling effects and refused approaches. A player still needs a way to choose an intended social outcome from what they learned. Trusted mediation and a consenting introduction add that distinction to the existing rules.

Rare kinds across the whole starting hex: marriage: 1/10 seeds (8); move: 1/10 seeds (8); affair meeting: 1/10 seeds (10); birth: 0/10 seeds; death: 0/10 seeds; inheritance: 0/10 seeds; departure: 0/10 seeds.

<!-- END SURVEY -->

<!-- BEGIN INVENTORY -->
## Complete exported event inventory

D1 00:00 is before arrival. Event numbers preserve the export's IDs. Cause keys refer to the rules above. All visits are listed, including ordinary family contacts and repeat visits. Their presence is not a claim of a separate strategic choice for every contact.

Each live visit includes its fixed directional dispositions and the headless arrival bonds, in participant order. These are starting conditions, not reconstructed scores at the exported contact. The export lacks the full intermediate candidate lists and need states. A precise choice between competing visitors in that session remains unproved.

| When | Event | People | Cause | Reach |
| --- | --- | --- | --- | --- |
| D1 00:00 | death · 1137 | Gillian Thubaho | A | Out of reach: before arrival |
| D1 00:00 | inheritance · 1138 · w5_3-item-25 | Gillian Thubaho / Andrew Jobari | B | Out of reach: before arrival |
| D1 00:00 | inheritance · 1139 · w5_3-home-21 | Gillian Thubaho / Andrew Jobari | B | Out of reach: before arrival |
| D1 00:00 | death · 1140 | Agnes Friforrin | A | Out of reach: before arrival |
| D1 00:00 | inheritance · 1141 · w5_3-item-5 | Agnes Friforrin / Hugh Seesi | B | Out of reach: before arrival |
| D1 00:00 | inheritance · 1142 · w5_3-home-1 | Agnes Friforrin / Hugh Seesi | B | Out of reach: before arrival |
| D1 00:00 | reconciliation · 1143 | Sybil Bobarin / Alan Frifoblo | C | Out of reach: before arrival |
| D1 00:00 | quarrel · 1144 | Sybil Bobarin / Nicholas Thuho | D | Out of reach: before arrival |
| D1 00:00 | reconciliation · 1145 | Sybil Bobarin / Gunnilda Thuforrun | C | Out of reach: before arrival |
| D1 00:00 | quarrel · 1146 | Alan Frifoblo / William Frifoblo | D | Out of reach: before arrival |
| D1 00:00 | reconciliation · 1147 | William Frifoblo / Gunnilda Thuforrun | C | Out of reach: before arrival |
| D1 00:00 | quarrel · 1148 | Isabel Bobarin / Christina Thuson | D | Out of reach: before arrival |
| D1 00:00 | quarrel · 1149 | Edgar Thuson / Christina Thuson | D | Out of reach: before arrival |
| D1 00:00 | quarrel · 1150 | Alan Thuson / Christina Thuson | D | Out of reach: before arrival |
| D1 00:00 | reconciliation · 1151 | Andrew Seesi / Gunnilda Frifoblo | C | Out of reach: before arrival |
| D1 00:00 | visit · 1152 | Simon Seesi / Cecily Bobarin | V. Summary contact before arrival | Out of reach: before arrival |
| D1 00:00 | visit · 1153 | Henry Seesi / Gunnilda Frifoblo | V. Summary contact before arrival | Out of reach: before arrival |
| D1 00:00 | move · 1154 · w5_3-home-1 → w5_3-home-16 | Henry Seesi | F | Out of reach: before arrival |
| D1 00:00 | marriage · 1155 | Henry Seesi / Gunnilda Frifoblo | E | Out of reach: before arrival |
| D1 00:00 | visit · 1156 | Isabel Frifoblo / Luke Thuson | V. Summary contact before arrival | Out of reach: before arrival |
| D1 00:00 | move · 1157 · w6_3-home-1 → w5_3-social-99 | Luke Thuson | F | Out of reach: before arrival |
| D1 00:00 | marriage · 1158 | Isabel Frifoblo / Luke Thuson | E | Out of reach: before arrival |
| D1 00:00 | world_move · 1159 | Luke Thuson | F | Out of reach: before arrival |
| D1 00:00 | departure · 1160 · 5,3 → 6,3 | Maud Thuson | G | Out of reach: before arrival |
| D1 10:32 | visit · 1169 | Ralph Thuson / Gunnilda Thuforrun | V. Fixed dispositions love / love; arrival bonds intimate / 810.40 ↔ intimate / 810.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:32 | visit · 1170 | Mabel Frifoblo / Agnes Friforrin | V. Fixed dispositions hate / hate; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:32 | visit · 1171 | Isabel Frifoblo / Luke Thuson | V. Fixed dispositions like / like; arrival bonds personal / 57.60 ↔ personal / 57.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:32 | visit · 1172 | Alan Frifoblo / Etheldreda Thuho | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:35 | visit · 1173 | Edwin Thuson / Roger Friforrin | V. Fixed dispositions like / love; arrival bonds personal / 86.40 ↔ intimate / 534.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:40 | visit · 1174 | Felice Frifoblo / Nicholas Thuho | V. Fixed dispositions love / love; arrival bonds intimate / 973.60 ↔ intimate / 973.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:40 | visit · 1175 | Richard Bobarin / Juliana Thuho | V. Fixed dispositions love / love; arrival bonds intimate / 1873.60 ↔ intimate / 1873.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:55 | quarrel · 1176 | Margaret Seesi / Andrew Seesi | D | Could with a small change: trusted mediation. Indirect timing only today. |
| D1 10:55 | visit · 1177 | Margaret Seesi / Andrew Seesi | V. Fixed dispositions love / hate; arrival bonds personal / 32.00 ↔ public / -1.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:56 | visit · 1178 | Alan Thuson / Aldith Thuson | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 10:58 | visit · 1179 | Hugh Jobari / Geoffrey Jobari | V. Fixed dispositions love / hate; arrival bonds unavailable ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 11:01 | visit · 1180 | Alice Frifoblo / Ralph Frifoblo | V. Fixed dispositions love / like; arrival bonds intimate / 263.20 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 11:08 | visit · 1181 | Henry Seesi / Andrew Jobari | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 11:14 | visit · 1182 | Stephen Frifoblo / William Frifoblo | V. Fixed dispositions love / love; arrival bonds intimate / 342.40 ↔ intimate / 342.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 11:42 | visit · 1183 | Sybil Bobarin / Humphrey Friforrin | V. Fixed dispositions love / love; arrival bonds intimate / 97.60 ↔ intimate / 97.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 12:00 | visit · 1184 | Christina Thuson / Gunnilda Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 12:32 | visit · 1185 | Nicholas Thuho / Gunnilda Thuforrun | V. Fixed dispositions like / like; arrival bonds public / 3.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 12:32 | visit · 1186 | Juliana Thuho / Etheldreda Thuho | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 12:34 | visit · 1187 | Margaret Seesi / Isabel Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 12:37 | visit · 1188 | Felice Frifoblo / Edwin Thuson | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 12:39 | visit · 1189 | Aldith Thuson / Richard Yaforlo | V. Fixed dispositions like / love; arrival bonds personal / 108.00 ↔ intimate / 556.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 13:07 | visit · 1190 | Geoffrey Jobari / Agnes Friforrin | V. Fixed dispositions like / like; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 13:57 | visit · 1191 | Edgar Thuson / Alan Frifoblo | V. Fixed dispositions love / like; arrival bonds intimate / 104.80 ↔ social / 16.80 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 13:58 | visit · 1192 | Alice Frifoblo / Humphrey Friforrin | V. Fixed dispositions like / love; arrival bonds personal / 160.80 ↔ intimate / 896.80 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 13:58 | visit · 1193 | Ralph Thuson / Roger Friforrin | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:02 | visit · 1194 | Andrew Jobari / Hugh Jobari | V. Fixed dispositions like / like; arrival bonds unmet ↔ unavailable | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:21 | visit · 1195 | William Frifoblo / Ralph Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:30 | visit · 1196 | Mabel Frifoblo / Andrew Seesi | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:33 | visit · 1197 | Sybil Bobarin / Gunnilda Thuforrun | V. Fixed dispositions like / like; arrival bonds personal / 31.20 ↔ personal / 31.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:33 | visit · 1198 | Richard Bobarin / Alan Thuson | V. Fixed dispositions love / like; arrival bonds personal / 116.80 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:35 | visit · 1199 | Felice Frifoblo / Stephen Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:36 | visit · 1200 | Margaret Seesi / Aldith Thuson | V. Fixed dispositions like / like; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 14:42 | visit · 1201 | Henry Seesi / Gunnilda Frifoblo | V. Fixed dispositions like / love; arrival bonds personal / 67.20 ↔ intimate / 371.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 15:32 | visit · 1202 | Edwin Thuson / Isabel Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 15:48 | visit · 1203 | Etheldreda Thuho / Luke Thuson | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 16:18 | visit · 1204 | Juliana Thuho / Cecily Bobarin | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 16:32 | visit · 1205 | Margaret Seesi / Gunnilda Thuforrun | V. Fixed dispositions like / hate; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 16:37 | visit · 1206 | Geoffrey Jobari / Andrew Jobari | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 16:38 | visit · 1207 | Edgar Thuson / Alan Thuson | V. Fixed dispositions like / love; arrival bonds personal / 33.60 ↔ intimate / 565.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 16:38 | visit · 1208 | Andrew Seesi / Alice Frifoblo | V. Fixed dispositions love / like; arrival bonds personal / 203.20 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 16:43 | visit · 1209 | Alan Frifoblo / Stephen Frifoblo | V. Fixed dispositions love / like; arrival bonds personal / 68.80 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 17:00 | visit · 1210 | Simon Seesi / Christina Thuson | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 17:02 | quarrel · 1211 | Margaret Seesi / Gunnilda Thuforrun | D | Could with a small change: trusted mediation. Indirect timing only today. |
| D1 17:02 | visit · 1212 | Sybil Bobarin / William Frifoblo | V. Fixed dispositions love / like; arrival bonds intimate / 587.20 ↔ personal / 64.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 17:26 | visit · 1213 | Ralph Thuson / Aldith Thuson | V. Fixed dispositions love / like; arrival bonds personal / 246.40 ↔ social / 14.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 17:26 | visit · 1214 | Nicholas Thuho / Ralph Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 17:32 | visit · 1215 | Felice Frifoblo / Henry Seesi | V. Fixed dispositions like / love; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 18:02 | visit · 1216 | Richard Bobarin / Humphrey Friforrin | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 18:19 | visit · 1217 | Roger Friforrin / Richard Yaforlo | V. Fixed dispositions like / hate; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 18:32 | visit · 1218 | Geoffrey Jobari / Mabel Frifoblo | V. Fixed dispositions like / like; arrival bonds personal / 216.00 ↔ personal / 216.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 18:35 | visit · 1219 | Alice Frifoblo / Juliana Thuho | V. Fixed dispositions like / hate; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:05 | visit · 1220 | Cecily Bobarin / Stephen Frifoblo | V. Fixed dispositions like / like; arrival bonds social / 26.40 ↔ social / 26.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:17 | visit · 1221 | Alan Thuson / Gunnilda Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:18 | visit · 1222 | Margaret Seesi / Edwin Thuson | V. Fixed dispositions hate / like; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:28 | visit · 1223 | Edgar Thuson / Isabel Frifoblo | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:31 | visit · 1224 | Andrew Jobari / Andrew Seesi | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:33 | visit · 1225 | Isabel Bobarin / Matthew Frifoblo | V. Fixed dispositions like / like; arrival bonds personal / 57.60 ↔ personal / 57.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:38 | visit · 1226 | Simon Frifoblo / Ralph Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:42 | visit · 1227 | Felice Frifoblo / Emmeline Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:48 | visit · 1228 | Nicholas Thuho / William Frifoblo | V. Fixed dispositions like / love; arrival bonds personal / 79.20 ↔ intimate / 740.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 19:56 | visit · 1229 | Hugh Seesi / Simon Seesi | V. Fixed dispositions like / love; arrival bonds personal / 60.00 ↔ intimate / 364.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 20:20 | visit · 1230 | Ralph Thuson / Christina Thuson | V. Fixed dispositions like / love; arrival bonds personal / 41.40 ↔ intimate / 282.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 20:32 | visit · 1231 | Elias Bobarin / Aldith Thuson | V. Fixed dispositions love / like; arrival bonds personal / 47.20 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 20:32 | visit · 1232 | Richard Bobarin / Henry Seesi | V. Fixed dispositions like / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 20:32 | visit · 1233 | Juliana Thuho / Luke Thuson | V. Fixed dispositions like / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 20:33 | quarrel · 1234 | Sybil Bobarin / Alice Frifoblo | D | Could with a small change: trusted mediation. Indirect timing only today. |
| D1 20:33 | visit · 1235 | Sybil Bobarin / Alice Frifoblo | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / -3.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D1 20:44 | visit · 1236 | Alan Frifoblo / Humphrey Friforrin | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / 3.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 16:37 | visit · 1237 | Isabel Frifoblo / Luke Thuson | V. Fixed dispositions like / like; arrival bonds personal / 57.60 ↔ personal / 57.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 16:59 | visit · 1238 | Agnes Friforrin / Hugh Jobari | V. Fixed dispositions like / love; arrival bonds unmet ↔ unavailable | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 17:08 | visit · 1239 | Ralph Frifoblo / Etheldreda Thuho | V. Fixed dispositions love / love; arrival bonds intimate / 1081.60 ↔ intimate / 1081.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 17:48 | visit · 1240 | Simon Seesi / Christina Thuson | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 18:32 | visit · 1241 | Geoffrey Jobari / Henry Seesi | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 18:46 | visit · 1242 | Isabel Bobarin / Edgar Thuson | V. Fixed dispositions love / like; arrival bonds intimate / 167.20 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 19:03 | visit · 1243 | Elias Bobarin / Gunnilda Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 19:03 | visit · 1244 | Richard Bobarin / Mabel Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 19:27 | visit · 1245 | Matthew Frifoblo / Isabel Frifoblo | V. Fixed dispositions love / hate; arrival bonds social / 28.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 19:32 | visit · 1246 | Hugh Seesi / Hugh Jobari | V. Fixed dispositions like / love; arrival bonds unmet ↔ unavailable | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 19:35 | visit · 1247 | Etheldreda Thuho / Luke Thuson | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 19:54 | visit · 1248 | Andrew Jobari / Agnes Friforrin | V. Fixed dispositions like / love; arrival bonds personal / 223.20 ↔ intimate / 1319.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 20:03 | visit · 1249 | Simon Frifoblo / Ralph Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 20:16 | visit · 1250 | Alice Frifoblo / Stephen Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 20:29 | visit · 1251 | Sybil Bobarin / Alan Thuson | V. Fixed dispositions love / hate; arrival bonds social / 24.80 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 20:32 | visit · 1252 | Isabel Bobarin / Henry Seesi | V. Fixed dispositions like / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D2 20:59 | quarrel · 1253 | Sybil Bobarin / Alan Thuson | D | Could with a small change: trusted mediation. Indirect timing only today. |
| D3 09:32 | visit · 1254 | Etheldreda Thuho / Luke Thuson | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 09:32 | visit · 1255 | Aldith Thuson / Richard Yaforlo | V. Fixed dispositions like / love; arrival bonds personal / 108.00 ↔ intimate / 556.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 09:33 | visit · 1256 | Ralph Frifoblo / Luke Thuson | V. Fixed dispositions hate / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 09:36 | visit · 1257 | Andrew Seesi / Henry Seesi | V. Fixed dispositions love / like; arrival bonds personal / 57.40 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 09:56 | visit · 1258 | Andrew Jobari / Agnes Friforrin | V. Fixed dispositions like / love; arrival bonds personal / 223.20 ↔ intimate / 1319.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 10:01 | visit · 1259 | Geoffrey Jobari / Mabel Frifoblo | V. Fixed dispositions like / like; arrival bonds personal / 216.00 ↔ personal / 216.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 10:39 | visit · 1260 | Edgar Thuson / Alan Thuson | V. Fixed dispositions like / love; arrival bonds personal / 33.60 ↔ intimate / 565.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 10:49 | visit · 1261 | Simon Seesi / Christina Thuson | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 11:02 | visit · 1262 | Richard Bobarin / Humphrey Friforrin | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 11:14 | visit · 1263 | Gunnilda Frifoblo / William Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 11:32 | visit · 1264 | Hugh Jobari / Agnes Friforrin | V. Fixed dispositions love / like; arrival bonds unavailable ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 11:47 | visit · 1265 | Ralph Frifoblo / Etheldreda Thuho | V. Fixed dispositions love / love; arrival bonds intimate / 1081.60 ↔ intimate / 1081.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 11:47 | visit · 1266 | Isabel Frifoblo / Luke Thuson | V. Fixed dispositions like / like; arrival bonds personal / 57.60 ↔ personal / 57.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 11:49 | visit (courting) · 1267 | Cecily Bobarin / Stephen Frifoblo | V. Fixed dispositions like / like; arrival bonds social / 26.40 ↔ social / 26.40; canCourt true at contact | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 13:08 | visit · 1268 | Mabel Frifoblo / Andrew Jobari | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 13:18 | visit · 1269 | Alan Thuson / Gunnilda Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 13:30 | visit · 1270 | Geoffrey Jobari / Henry Seesi | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 13:42 | visit · 1271 | Richard Bobarin / Alice Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 13:54 | visit · 1272 | Felice Frifoblo / Nicholas Thuho | V. Fixed dispositions love / love; arrival bonds intimate / 973.60 ↔ intimate / 973.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 14:32 | visit · 1273 | Sybil Bobarin / Humphrey Friforrin | V. Fixed dispositions love / love; arrival bonds intimate / 97.60 ↔ intimate / 97.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 15:01 | visit · 1274 | Alan Thuson / Gunnilda Thuforrun | V. Fixed dispositions love / like; arrival bonds personal / 145.60 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 15:06 | visit · 1275 | Stephen Frifoblo / Hugh Jobari | V. Fixed dispositions like / love; arrival bonds unmet ↔ unavailable | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 15:47 | visit · 1276 | Ralph Thuson / Margaret Seesi | V. Fixed dispositions like / like; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 15:48 | visit · 1277 | Edgar Thuson / Alan Frifoblo | V. Fixed dispositions love / like; arrival bonds intimate / 104.80 ↔ social / 16.80 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 16:17 | visit · 1278 | Alice Frifoblo / Nicholas Thuho | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 16:33 | visit · 1279 | Simon Seesi / Cecily Bobarin | V. Fixed dispositions like / like; arrival bonds social / 24.00 ↔ social / 24.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 17:12 | visit · 1280 | Felice Frifoblo / Aldith Thuson | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 17:45 | reconciliation · 1281 | Margaret Seesi / Andrew Seesi | C | Could with a small change: trusted mediation. Indirect timing only today. |
| D4 17:45 | visit · 1282 | Margaret Seesi / Andrew Seesi | V. Fixed dispositions love / hate; arrival bonds personal / 32.00 ↔ public / -1.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 18:48 | visit · 1283 | Gunnilda Frifoblo / Gunnilda Thuforrun | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 19:02 | visit · 1284 | Sybil Bobarin / William Frifoblo | V. Fixed dispositions love / like; arrival bonds intimate / 587.20 ↔ personal / 64.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 19:03 | visit · 1285 | Agnes Friforrin / Etheldreda Thuho | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 19:26 | visit · 1286 | Ralph Frifoblo / Edwin Thuson | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 19:38 | visit · 1287 | Roger Friforrin / Richard Yaforlo | V. Fixed dispositions like / hate; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 19:39 | visit · 1288 | Emmeline Frifoblo / Andrew Seesi | V. Fixed dispositions love / love; arrival bonds intimate / 388.00 ↔ intimate / 388.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 19:57 | visit · 1289 | Isabel Bobarin / Matthew Frifoblo | V. Fixed dispositions like / like; arrival bonds personal / 57.60 ↔ personal / 57.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 20:06 | visit · 1290 | Aldith Thuson / Isabel Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 20:16 | quarrel · 1291 | Elias Bobarin / Alice Frifoblo | D | Could with a small change: trusted mediation. Indirect timing only today. |
| D4 20:16 | visit · 1292 | Elias Bobarin / Alice Frifoblo | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ public / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 20:31 | reconciliation · 1293 | Margaret Seesi / Gunnilda Thuforrun | C | Could with a small change: trusted mediation. Indirect timing only today. |
| D4 20:31 | visit · 1294 | Margaret Seesi / Gunnilda Thuforrun | V. Fixed dispositions like / hate; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D4 20:37 | visit · 1295 | Felice Frifoblo / Christina Thuson | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 10:54 | visit · 1296 | Andrew Seesi / Henry Seesi | V. Fixed dispositions love / like; arrival bonds personal / 57.40 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 11:06 | visit · 1297 | Andrew Jobari / Agnes Friforrin | V. Fixed dispositions like / love; arrival bonds personal / 223.20 ↔ intimate / 1319.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 11:35 | visit · 1298 | Ralph Frifoblo / Isabel Frifoblo | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 11:58 | visit · 1299 | Geoffrey Jobari / Hugh Jobari | V. Fixed dispositions hate / love; arrival bonds unmet ↔ unavailable | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 12:32 | visit · 1300 | Richard Bobarin / Humphrey Friforrin | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 12:32 | visit · 1301 | William Frifoblo / Henry Seesi | V. Fixed dispositions like / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 12:42 | visit · 1302 | Edgar Thuson / Alan Thuson | V. Fixed dispositions like / love; arrival bonds personal / 33.60 ↔ intimate / 565.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 13:33 | visit · 1303 | Hugh Jobari / Agnes Friforrin | V. Fixed dispositions love / like; arrival bonds unavailable ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 14:07 | visit (courting) · 1304 | Cecily Bobarin / Stephen Frifoblo | V. Fixed dispositions like / like; arrival bonds social / 26.40 ↔ social / 26.40; canCourt true at contact | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 14:09 | visit · 1305 | Isabel Frifoblo / Luke Thuson | V. Fixed dispositions like / like; arrival bonds personal / 57.60 ↔ personal / 57.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 14:14 | visit · 1306 | Ralph Thuson / Roger Friforrin | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 15:01 | visit · 1307 | Geoffrey Jobari / Henry Seesi | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 15:05 | reconciliation · 1308 | Edgar Thuson / Christina Thuson | C | Could with a small change: trusted mediation. Indirect timing only today. |
| D5 15:05 | visit · 1309 | Edgar Thuson / Christina Thuson | V. Fixed dispositions like / love; arrival bonds public / -12.00 ↔ social / 10.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 16:31 | visit · 1310 | Alan Frifoblo / Humphrey Friforrin | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / 3.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 17:05 | visit · 1311 | Sybil Bobarin / Richard Bobarin | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 17:11 | visit · 1312 | Felice Frifoblo / Nicholas Thuho | V. Fixed dispositions love / love; arrival bonds intimate / 973.60 ↔ intimate / 973.60 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 17:52 | visit · 1313 | Simon Seesi / Andrew Jobari | V. Fixed dispositions love / like; arrival bonds personal / 90.40 ↔ public / 2.40 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 18:03 | visit · 1314 | Gunnilda Thuforrun / Cecily Bobarin | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 18:34 | visit · 1315 | Ralph Thuson / Richard Yaforlo | V. Fixed dispositions love / love; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 18:45 | visit · 1316 | Mabel Frifoblo / Hugh Jobari | V. Fixed dispositions like / hate; arrival bonds unmet ↔ unavailable | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 19:07 | visit · 1317 | Etheldreda Thuho / Luke Thuson | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 19:08 | visit · 1318 | Gunnilda Frifoblo / Aldith Thuson | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 19:41 | visit · 1319 | Margaret Seesi / Andrew Seesi | V. Fixed dispositions love / hate; arrival bonds personal / 32.00 ↔ public / -1.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 19:52 | visit · 1320 | Felice Frifoblo / Emmeline Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D5 20:32 | visit · 1321 | Hugh Seesi / Mabel Frifoblo | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 11:34 | visit · 1322 | Gunnilda Frifoblo / Alice Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 12:45 | visit · 1323 | Andrew Jobari / Agnes Friforrin | V. Fixed dispositions like / love; arrival bonds personal / 223.20 ↔ intimate / 1319.20 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 13:04 | visit · 1324 | Andrew Seesi / Henry Seesi | V. Fixed dispositions love / like; arrival bonds personal / 57.40 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 13:32 | visit · 1325 | Ralph Frifoblo / Luke Thuson | V. Fixed dispositions hate / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 14:32 | visit · 1326 | Edgar Thuson / Isabel Frifoblo | V. Fixed dispositions love / hate; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 14:46 | visit · 1327 | Geoffrey Jobari / Andrew Jobari | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 15:13 | visit · 1328 | Richard Bobarin / Humphrey Friforrin | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 15:36 | visit · 1329 | William Frifoblo / Ralph Frifoblo | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 16:49 | visit · 1330 | Henry Seesi / Agnes Friforrin | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 17:37 | visit · 1331 | Edwin Thuson / Isabel Frifoblo | V. Fixed dispositions love / like; arrival bonds social / 16.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 17:44 | visit · 1332 | Ralph Thuson / Roger Friforrin | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 18:54 | visit · 1333 | Hugh Jobari / Mabel Frifoblo | V. Fixed dispositions hate / like; arrival bonds unavailable ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 19:00 | visit · 1334 | Cecily Bobarin / Richard Bobarin | V. Fixed dispositions love / love; arrival bonds social / 16.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 19:31 | visit · 1335 | Hugh Seesi / Andrew Jobari | V. Fixed dispositions like / like; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 19:32 | visit · 1336 | Simon Frifoblo / Matthew Frifoblo | V. Fixed dispositions like / hate; arrival bonds public / 0.00 ↔ public / 0.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D6 20:28 | visit · 1337 | Henry Seesi / Felice Frifoblo | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D7 16:47 | visit · 1338 | Ralph Frifoblo / Isabel Frifoblo | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |
| D7 17:17 | visit · 1339 | Simon Seesi / Christina Thuson | V. Fixed dispositions love / like; arrival bonds unmet ↔ unmet | Can change today: timing/food. Each row untested unless named in a pair. |
| D7 18:30 | visit · 1340 | Etheldreda Thuho / Luke Thuson | V. Fixed dispositions like / love; arrival bonds public / 0.00 ↔ social / 16.00 | Can change today: timing/food. Each row untested unless named in a pair. |


## Complete headless control event inventory

These are the control's actual records at the fixed six-minute step. They have different event identities and times from some exported records. Cause keys have the same meaning. The experiments compare against this week. Bonds are from the preceding frame. Hunger and tiredness are sampled after the event's frame, in participant order.

| When | Event | People | Cause | Player's reach |
| --- | --- | --- | --- | --- |
| D1 10:42 | visit · 1169 | Ralph Thuson / Gunnilda Thuforrun | V. Before: love / intimate / 810.36 ↔ love / intimate / 810.36; after-frame hunger / tiredness: 0.042 / 0.042 ↔ 0.042 / 0.042 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 10:42 | visit · 1170 | Richard Bobarin / Juliana Thuho | V. Before: love / intimate / 1873.56 ↔ love / intimate / 1873.56; after-frame hunger / tiredness: 0.042 / 0.042 ↔ 0.042 / 0.042 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 10:42 | visit · 1171 | Mabel Frifoblo / Agnes Friforrin | V. Before: hate / public / 0.00 ↔ hate / public / 0.00; after-frame hunger / tiredness: 0.042 / 0.042 ↔ 0.042 / 0.042 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 10:54 | visit · 1172 | Felice Frifoblo / Nicholas Thuho | V. Before: love / intimate / 973.56 ↔ love / intimate / 973.56; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 10:54 | visit · 1173 | Stephen Frifoblo / William Frifoblo | V. Before: love / intimate / 342.36 ↔ love / intimate / 342.36; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 10:54 | visit · 1174 | Roger Friforrin / Richard Yaforlo | V. Before: like / unmet / unmet ↔ hate / unmet / unmet; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:00 | visit · 1175 | Alan Frifoblo / Edwin Thuson | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:12 | visit · 1176 | Sybil Bobarin / Humphrey Friforrin | V. Before: love / intimate / 97.51 ↔ love / intimate / 97.51; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:18 | visit · 1177 | Hugh Jobari / Geoffrey Jobari | V. Before: love / personal / 36.00 ↔ hate / public / 0.00; after-frame hunger / tiredness: 0.673 / 0.620 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:24 | quarrel · 1178 | Margaret Seesi / Andrew Seesi | D. Before: love / personal / 31.91 ↔ hate / public / -0.91; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Meeting timing today; deliberate mediation needs a small change |
| D1 11:24 | visit · 1179 | Margaret Seesi / Andrew Seesi | V. Before: love / personal / 31.91 ↔ hate / public / -0.91; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:24 | visit · 1180 | Etheldreda Thuho / Isabel Frifoblo | V. Before: love / social / 16.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:36 | visit · 1181 | Christina Thuson / Gunnilda Frifoblo | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.083 / 0.083 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 11:48 | quarrel · 1182 | Geoffrey Jobari / Hugh Jobari | D. Before: hate / public / -1.00 ↔ love / personal / 52.00; after-frame hunger / tiredness: 0.083 / 0.083 ↔ 0.673 / 0.620 | Meeting timing today; deliberate mediation needs a small change |
| D1 12:24 | visit · 1183 | Alan Thuson / Aldith Thuson | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.125 / 0.125 ↔ 0.125 / 0.125 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 12:24 | visit · 1184 | Alice Frifoblo / Ralph Frifoblo | V. Before: love / intimate / 263.07 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.125 / 0.125 ↔ 0.125 / 0.125 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 12:54 | visit · 1185 | Henry Seesi / Andrew Jobari | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.167 / 0.167 ↔ 0.167 / 0.167 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 13:42 | visit · 1186 | Felice Frifoblo / Edwin Thuson | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.167 / 0.167 ↔ 0.167 / 0.167 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 13:48 | visit · 1187 | Ralph Thuson / Alan Frifoblo | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.167 / 0.167 ↔ 0.167 / 0.167 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 13:48 | visit · 1188 | Andrew Seesi / Gunnilda Frifoblo | V. Before: love / social / 21.83 ↔ hate / public / 5.83; after-frame hunger / tiredness: 0.167 / 0.167 ↔ 0.167 / 0.167 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 13:48 | visit · 1189 | Nicholas Thuho / William Frifoblo | V. Before: like / personal / 79.03 ↔ love / intimate / 740.03; after-frame hunger / tiredness: 0.167 / 0.167 ↔ 0.167 / 0.167 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 13:48 | visit · 1190 | Agnes Friforrin / Hugh Jobari | V. Before: hate / public / 0.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.167 / 0.167 ↔ 0.757 / 0.703 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 14:12 | visit · 1191 | Geoffrey Jobari / Mabel Frifoblo | V. Before: like / personal / 215.79 ↔ like / personal / 215.79; after-frame hunger / tiredness: 0.208 / 0.208 ↔ 0.208 / 0.208 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 14:18 | visit · 1192 | Richard Bobarin / Humphrey Friforrin | V. Before: love / social / 16.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.208 / 0.208 ↔ 0.208 / 0.208 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 14:18 | quarrel · 1193 | Agnes Friforrin / Hugh Jobari | D. Before: hate / public / -0.96 ↔ love / personal / 31.96; after-frame hunger / tiredness: 0.208 / 0.208 ↔ 0.798 / 0.745 | Meeting timing today; deliberate mediation needs a small change |
| D1 14:42 | visit · 1194 | Roger Friforrin / Stephen Frifoblo | V. Before: love / personal / 82.99 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.208 / 0.208 ↔ 0.208 / 0.208 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 15:24 | visit · 1195 | Sybil Bobarin / Gunnilda Thuforrun | V. Before: like / personal / 30.94 ↔ like / personal / 30.94; after-frame hunger / tiredness: 0.250 / 0.250 ↔ 0.250 / 0.250 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 15:36 | visit · 1196 | Margaret Seesi / Richard Yaforlo | V. Before: like / unmet / unmet ↔ like / unmet / unmet; after-frame hunger / tiredness: 0.250 / 0.250 ↔ 0.250 / 0.250 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 15:42 | visit · 1197 | Ralph Frifoblo / Luke Thuson | V. Before: hate / unmet / unmet ↔ like / unmet / unmet; after-frame hunger / tiredness: 0.250 / 0.250 ↔ 0.250 / 0.250 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 16:00 | visit · 1198 | Juliana Thuho / Etheldreda Thuho | V. Before: love / social / 16.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.292 / 0.292 ↔ 0.292 / 0.292 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 16:12 | visit · 1199 | Edgar Thuson / Isabel Frifoblo | V. Before: love / social / 16.00 ↔ hate / public / 0.00; after-frame hunger / tiredness: 0.292 / 0.292 ↔ 0.292 / 0.292 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 16:42 | visit · 1200 | William Frifoblo / Edwin Thuson | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.292 / 0.292 ↔ 0.292 / 0.292 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 16:42 | visit · 1201 | Alice Frifoblo / Humphrey Friforrin | V. Before: like / personal / 160.50 ↔ love / intimate / 896.50; after-frame hunger / tiredness: 0.292 / 0.292 ↔ 0.292 / 0.292 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 17:24 | visit · 1202 | Felice Frifoblo / Aldith Thuson | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.333 / 0.333 ↔ 0.333 / 0.333 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 17:48 | visit · 1203 | Alan Thuson / Alan Frifoblo | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.333 / 0.333 ↔ 0.333 / 0.333 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 18:00 | visit · 1204 | Andrew Jobari / Agnes Friforrin | V. Before: like / personal / 222.81 ↔ love / intimate / 1318.81; after-frame hunger / tiredness: 0.375 / 0.375 ↔ 0.375 / 0.375 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 18:06 | visit · 1205 | Ralph Thuson / Christina Thuson | V. Before: like / personal / 41.01 ↔ love / intimate / 282.01; after-frame hunger / tiredness: 0.375 / 0.375 ↔ 0.375 / 0.375 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 18:12 | visit · 1206 | Mabel Frifoblo / Andrew Seesi | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.375 / 0.375 ↔ 0.375 / 0.375 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 18:42 | visit · 1207 | Humphrey Friforrin / Luke Thuson | V. Before: like / unmet / unmet ↔ love / unmet / unmet; after-frame hunger / tiredness: 0.375 / 0.375 ↔ 0.375 / 0.375 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 18:42 | visit · 1208 | Edwin Thuson / Roger Friforrin | V. Before: like / personal / 86.01 ↔ love / personal / 534.01; after-frame hunger / tiredness: 0.375 / 0.375 ↔ 0.375 / 0.375 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 19:00 | visit · 1209 | Cecily Bobarin / Stephen Frifoblo | V. Before: like / social / 25.97 ↔ like / social / 25.97; after-frame hunger / tiredness: 0.417 / 0.417 ↔ 0.417 / 0.417 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 19:48 | visit · 1210 | Matthew Frifoblo / Emmeline Frifoblo | V. Before: like / public / 0.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.417 / 0.417 ↔ 0.417 / 0.417 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 19:54 | visit · 1211 | Geoffrey Jobari / Henry Seesi | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 19:54 | visit · 1212 | Nicholas Thuho / Gunnilda Thuforrun | V. Before: like / public / 2.57 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 20:00 | visit · 1213 | Elias Bobarin / Isabel Frifoblo | V. Before: love / social / 16.00 ↔ love / public / 16.00; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 20:24 | quarrel · 1214 | Sybil Bobarin / Alice Frifoblo | D. Before: love / social / 16.00 ↔ hate / public / -2.53; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Meeting timing today; deliberate mediation needs a small change |
| D1 20:24 | visit · 1215 | Sybil Bobarin / Alice Frifoblo | V. Before: love / social / 16.00 ↔ hate / public / -2.53; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 20:30 | visit · 1216 | Isabel Bobarin / Edgar Thuson | V. Before: love / intimate / 166.73 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 20:42 | visit · 1217 | Margaret Seesi / Alan Frifoblo | V. Before: like / unmet / unmet ↔ like / unmet / unmet; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D1 20:48 | visit · 1218 | Hugh Seesi / Simon Seesi | V. Before: like / personal / 59.53 ↔ love / intimate / 363.53; after-frame hunger / tiredness: 0.458 / 0.458 ↔ 0.458 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D2 18:36 | visit · 1219 | Simon Seesi / Hugh Jobari | V. Before: hate / public / 0.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.083 / 0.292 ↔ 0.875 / 0.495 | Timing through attention, food and work; individual row untested unless named in a pair |
| D2 19:00 | visit · 1220 | Ralph Frifoblo / Etheldreda Thuho | V. Before: love / intimate / 1080.14 ↔ love / intimate / 1080.14; after-frame hunger / tiredness: 0.083 / 0.300 ↔ 0.083 / 0.300 | Timing through attention, food and work; individual row untested unless named in a pair |
| D2 19:48 | visit · 1221 | Isabel Frifoblo / Luke Thuson | V. Before: like / personal / 56.14 ↔ like / personal / 56.14; after-frame hunger / tiredness: 0.083 / 0.300 ↔ 0.125 / 0.300 | Timing through attention, food and work; individual row untested unless named in a pair |
| D2 20:48 | visit · 1222 | Isabel Bobarin / Edgar Thuson | V. Before: love / intimate / 197.70 ↔ like / public / 6.97; after-frame hunger / tiredness: 0.083 / 0.342 ↔ 0.042 / 0.342 | Timing through attention, food and work; individual row untested unless named in a pair |
| D3 09:36 | visit · 1223 | Alan Thuson / Etheldreda Thuho | V. Before: like / unmet / unmet ↔ like / unmet / unmet; after-frame hunger / tiredness: 0.542 / 0.883 ↔ 0.667 / 0.883 | Timing through attention, food and work; individual row untested unless named in a pair |
| D3 09:48 | visit · 1224 | Geoffrey Jobari / Agnes Friforrin | V. Before: like / public / -1.16 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.542 / 0.883 ↔ 0.625 / 0.883 | Timing through attention, food and work; individual row untested unless named in a pair |
| D3 09:54 | visit · 1225 | Elias Bobarin / Isabel Frifoblo | V. Before: love / intimate / 62.41 ↔ love / intimate / 62.41; after-frame hunger / tiredness: 0.417 / 0.925 ↔ 0.708 / 0.925 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 10:36 | visit · 1226 | Ralph Frifoblo / Isabel Frifoblo | V. Before: like / public / 0.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.625 / 0.175 ↔ 0.625 / 0.175 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 10:54 | visit · 1227 | Richard Bobarin / Alice Frifoblo | V. Before: love / social / 15.66 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.667 / 0.167 ↔ 0.917 / 0.217 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 11:06 | visit · 1228 | Juliana Thuho / Etheldreda Thuho | V. Before: love / intimate / 61.13 ↔ love / intimate / 61.13; after-frame hunger / tiredness: 0.833 / 0.250 ↔ 0.583 / 0.250 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 11:36 | visit · 1229 | Roger Friforrin / Luke Thuson | V. Before: like / unmet / unmet ↔ hate / unmet / unmet; after-frame hunger / tiredness: 0.833 / 0.133 ↔ 0.750 / 0.167 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 12:06 | quarrel · 1230 | Roger Friforrin / Luke Thuson | D. Before: like / public / 3.96 ↔ hate / public / -0.96; after-frame hunger / tiredness: 0.875 / 0.175 ↔ 0.792 / 0.208 | Meeting timing today; deliberate mediation needs a small change |
| D4 13:54 | visit · 1231 | Ralph Frifoblo / Etheldreda Thuho | V. Before: love / intimate / 1126.34 ↔ love / intimate / 1126.34; after-frame hunger / tiredness: 0.792 / 0.342 ↔ 0.708 / 0.375 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 15:48 | visit · 1232 | Margaret Seesi / Isabel Frifoblo | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.792 / 0.250 ↔ 0.833 / 0.383 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 16:12 | visit · 1233 | Edwin Thuson / Richard Yaforlo | V. Before: like / unmet / unmet ↔ hate / public / 0.00; after-frame hunger / tiredness: 0.750 / 0.208 ↔ 0.917 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 16:54 | visit · 1234 | Nicholas Thuho / Ralph Frifoblo | V. Before: love / social / 16.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.833 / 0.167 ↔ 0.917 / 0.467 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 17:18 | visit · 1235 | Richard Bobarin / Alan Thuson | V. Before: love / personal / 113.37 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.917 / 0.417 ↔ 0.167 / 0.500 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 19:06 | visit · 1236 | Geoffrey Jobari / Mabel Frifoblo | V. Before: like / personal / 224.49 ↔ like / personal / 224.49; after-frame hunger / tiredness: 0.333 / 0.633 ↔ 0.167 / 0.467 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 19:36 | visit · 1237 | Simon Frifoblo / Edwin Thuson | V. Before: love / intimate / 960.49 ↔ like / personal / 152.49; after-frame hunger / tiredness: 0.208 / 0.583 ↔ 0.875 / 0.333 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 19:42 | visit · 1238 | Humphrey Friforrin / Cecily Bobarin | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.875 / 0.333 ↔ 0.292 / 0.633 | Timing through attention, food and work; individual row untested unless named in a pair |
| D4 19:54 | visit · 1239 | Elias Bobarin / Alice Frifoblo | V. Before: like / public / 0.00 ↔ love / public / 16.00; after-frame hunger / tiredness: 0.208 / 0.625 ↔ 0.125 / 0.592 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 14:18 | visit · 1240 | Edgar Thuson / Isabel Frifoblo | V. Before: love / personal / 43.97 ↔ hate / public / 0.00; after-frame hunger / tiredness: 0.792 / 0.258 ↔ 0.667 / 0.258 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 14:54 | visit · 1241 | Simon Seesi / Agnes Friforrin | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.750 / 0.333 ↔ 0.958 / 0.217 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 15:00 | reconciliation · 1242 | Sybil Bobarin / Alice Frifoblo | C. Before: love / social / 13.90 ↔ hate / public / -4.63; after-frame hunger / tiredness: 0.792 / 0.217 ↔ 0.917 / 0.300 | Meeting timing today; deliberate mediation needs a small change |
| D5 15:00 | visit · 1243 | Sybil Bobarin / Alice Frifoblo | V. Before: love / social / 13.90 ↔ hate / public / -4.63; after-frame hunger / tiredness: 0.792 / 0.217 ↔ 0.917 / 0.300 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 15:06 | visit · 1244 | Andrew Jobari / Andrew Seesi | V. Before: love / social / 16.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.875 / 0.300 ↔ 0.833 / 0.300 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 15:42 | visit · 1245 | Richard Bobarin / Juliana Thuho | V. Before: love / intimate / 1917.23 ↔ love / intimate / 1917.23; after-frame hunger / tiredness: 0.750 / 0.250 ↔ 0.875 / 0.333 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 18:06 | visit · 1246 | Margaret Seesi / Isabel Frifoblo | V. Before: love / personal / 46.84 ↔ like / public / 6.84; after-frame hunger / tiredness: 0.750 / 0.258 ↔ 0.833 / 0.425 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 19:42 | visit · 1247 | Hugh Seesi / Geoffrey Jobari | V. Before: like / public / 0.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.125 / 0.500 ↔ 0.167 / 0.550 | Timing through attention, food and work; individual row untested unless named in a pair |
| D5 20:48 | visit · 1248 | Etheldreda Thuho / Isabel Frifoblo | V. Before: love / personal / 59.50 ↔ love / personal / 59.50; after-frame hunger / tiredness: 0.125 / 0.542 ↔ 0.917 / 0.508 | Timing through attention, food and work; individual row untested unless named in a pair |
| D6 14:36 | visit · 1249 | Juliana Thuho / Etheldreda Thuho | V. Before: love / intimate / 106.94 ↔ love / personal / 106.94; after-frame hunger / tiredness: 0.708 / 0.208 ↔ 0.875 / 0.208 | Timing through attention, food and work; individual row untested unless named in a pair |
| D6 15:24 | visit · 1250 | Andrew Seesi / Alice Frifoblo | V. Before: love / personal / 197.80 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.625 / 0.217 ↔ 0.708 / 0.217 | Timing through attention, food and work; individual row untested unless named in a pair |
| D6 18:00 | visit · 1251 | Alice Frifoblo / Ralph Frifoblo | V. Before: love / intimate / 289.67 ↔ like / public / 2.60; after-frame hunger / tiredness: 0.833 / 0.342 ↔ 0.875 / 0.342 | Timing through attention, food and work; individual row untested unless named in a pair |
| D6 19:42 | visit · 1252 | Simon Frifoblo / Andrew Seesi | V. Before: love / unmet / unmet ↔ like / unmet / unmet; after-frame hunger / tiredness: 0.625 / 0.217 ↔ 0.792 / 0.383 | Timing through attention, food and work; individual row untested unless named in a pair |
| D6 19:42 | visit · 1253 | Elias Bobarin / Matthew Frifoblo | V. Before: like / public / 0.00 ↔ like / public / 0.00; after-frame hunger / tiredness: 0.833 / 0.417 ↔ 0.083 / 0.417 | Timing through attention, food and work; individual row untested unless named in a pair |
| D6 20:48 | visit · 1254 | Hugh Seesi / Simon Seesi | V. Before: like / personal / 58.39 ↔ love / intimate / 374.39; after-frame hunger / tiredness: 0.167 / 0.458 ↔ 0.833 / 0.458 | Timing through attention, food and work; individual row untested unless named in a pair |
| D7 12:48 | visit · 1255 | Ralph Thuson / Gunnilda Frifoblo | V. Before: love / social / 16.00 ↔ love / public / 16.00; after-frame hunger / tiredness: 0.875 / 0.208 ↔ 0.542 / 0.175 | Timing through attention, food and work; individual row untested unless named in a pair |
| D7 14:42 | visit · 1256 | Humphrey Friforrin / Cecily Bobarin | V. Before: love / personal / 45.13 ↔ like / public / 5.13; after-frame hunger / tiredness: 0.917 / 0.258 ↔ 0.625 / 0.175 | Timing through attention, food and work; individual row untested unless named in a pair |
| D7 16:54 | visit · 1257 | Alan Thuson / Gunnilda Frifoblo | V. Before: love / social / 16.00 ↔ love / social / 16.00; after-frame hunger / tiredness: 0.917 / 0.217 ↔ 0.750 / 0.383 | Timing through attention, food and work; individual row untested unless named in a pair |
| D7 18:36 | visit · 1258 | Edwin Thuson / Richard Yaforlo | V. Before: like / public / 4.83 ↔ hate / public / 0.00; after-frame hunger / tiredness: 0.875 / 0.425 ↔ 0.708 / 0.258 | Timing through attention, food and work; individual row untested unless named in a pair |

## Hunger during the headless control

The played export has only final hunger values, so it cannot date every meal or hunger onset. This table supplies every hourly sampled hunger spell in the control. The threshold is greater than 0.9 days since a meal. The end is the first hourly sample back below the threshold. An open spell runs to the season's end. The figures are needs, not sickness or death predictions.

| Person | Hunger spells: start → end (peak days since meal) | Cause and reach |
| --- | --- | --- |
| Hugh Jobari · terrain5_3-person-4147 | D1 17:00 → D1 22:00 (1.090); D2 19:00 → D3 01:00 (1.125); D3 22:00 → D6 16:00 (3.625); D7 13:00 → season end (1.333) | H. w5_3-home-11; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Simon Frifoblo · w5_3-social-49 | D2 07:00 → D2 22:00 (1.500); D3 19:00 → D4 15:00 (1.708); D5 12:00 → D6 05:00 (1.583); D7 02:00 → D7 17:00 (1.500) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Isabel Bobarin · w5_3-social-55 | D2 07:00 → D2 19:00 (1.375); D3 16:00 → D3 22:00 (1.125); D4 19:00 → season end (4.083) | H. w5_3-home-26; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Elias Bobarin · w5_3-social-58 | D2 07:00 → D3 01:00 (1.625); D3 22:00 → D4 16:00 (1.625); D5 13:00 → D6 00:00 (1.333); D6 21:00 → season end (2.000) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Felice Frifoblo · w5_3-social-60 | D2 07:00 → season end (6.583) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Matthew Frifoblo · w5_3-social-61 | D2 07:00 → D2 18:00 (1.333); D3 15:00 → D3 18:00 (1.000); D4 15:00 → D4 18:00 (1.000); D5 15:00 → D5 18:00 (1.000); D6 15:00 → D6 18:00 (1.000); D7 15:00 → D7 18:00 (1.000) | H. w5_3-home-21; 27 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Ralph Thuson · w5_3-social-65 | D2 07:00 → D2 19:54 (1.417); D3 17:00 → D4 22:00 (2.083); D5 19:00 → D6 16:00 (1.750); D7 13:00 → season end (1.333) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Hugh Seesi · w5_3-social-66 | D2 07:00 → D2 17:00 (1.292); D3 14:00 → D3 17:00 (1.000); D4 14:00 → D4 17:00 (1.000); D5 14:00 → D5 17:00 (1.000); D6 14:00 → D6 17:00 (1.000); D7 14:00 → D7 19:00 (1.083) | H. w5_3-home-6; 9 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Edgar Thuson · w5_3-social-68 | D2 07:00 → D2 19:54 (1.417); D3 17:00 → D4 20:00 (2.000); D5 17:00 → season end (3.167) | H. w5_3-home-26; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Margaret Seesi · w5_3-social-69 | D2 07:00 → D2 19:00 (1.375); D3 16:00 → D3 21:00 (1.083); D4 18:00 → D5 01:00 (1.167); D5 22:00 → D6 14:00 (1.542); D7 11:00 → season end (1.417) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Sybil Bobarin · w5_3-social-70 | D2 07:00 → D2 19:00 (1.375); D3 16:00 → D4 21:00 (2.083); D5 18:00 → season end (3.125) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Alan Thuson · w5_3-social-72 | D2 07:00 → D2 21:00 (1.458); D3 18:00 → D4 14:00 (1.708); D5 11:00 → D6 20:00 (2.250); D7 17:00 → season end (1.167) | H. w5_3-home-26; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Richard Bobarin · w5_3-social-73 | D2 07:00 → D3 20:00 (2.417); D4 17:00 → D4 22:00 (1.083); D5 19:00 → D6 21:00 (1.958); D7 18:00 → season end (1.125) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Geoffrey Jobari · w5_3-social-74 | D2 07:00 → D2 21:00 (1.458); D3 18:00 → D4 12:00 (1.625); D5 09:00 → D5 16:00 (1.167); D6 13:00 → D6 22:00 (1.250); D7 19:00 → season end (1.083) | H. w5_3-home-11; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Mabel Frifoblo · w5_3-social-76 | D2 07:00 → D2 23:00 (1.542); D3 20:00 → D4 16:00 (1.708); D5 13:00 → D5 19:00 (1.125); D6 16:00 → season end (2.208) | H. w5_3-home-11; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Alan Frifoblo · w5_3-social-77 | D2 07:00 → D2 19:54 (1.417); D3 17:00 → D5 15:00 (2.792); D6 12:00 → season end (2.375) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Emmeline Frifoblo · w5_3-social-78 | D2 07:00 → D3 15:00 (2.208); D4 12:00 → D5 00:00 (1.375); D5 21:00 → D6 23:00 (1.958); D7 20:00 → season end (1.042) | H. w5_3-home-16; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Andrew Jobari · w5_3-social-79 | D2 07:00 → D3 15:00 (2.208); D4 12:00 → D4 19:00 (1.167); D5 16:00 → season end (3.208) | H. w5_3-home-11; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Andrew Seesi · w5_3-social-80 | D2 07:00 → D3 17:00 (2.292); D4 14:00 → D4 20:00 (1.125); D5 17:00 → D6 01:00 (1.208); D6 22:00 → season end (1.958) | H. w5_3-home-16; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Nicholas Thuho · w6_3-social-71 | D2 07:00 → D3 22:00 (2.500); D4 19:00 → D5 18:00 (1.833); D6 15:00 → season end (2.250) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| William Frifoblo · w5_3-social-81 | D2 07:00 → D5 22:00 (4.500); D6 19:00 → D7 17:00 (1.792) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Alice Frifoblo · w5_3-social-85 | D2 07:00 → D3 14:00 (2.167); D4 11:00 → D4 18:00 (1.167); D5 15:00 → D5 23:00 (1.208); D6 20:00 → season end (2.042) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Juliana Thuho · w6_3-social-82 | D2 07:00 → D3 16:00 (2.250); D4 13:00 → D4 19:00 (1.125); D5 16:00 → D5 22:00 (1.125); D6 19:00 → season end (2.083) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Ralph Frifoblo · w5_3-social-86 | D2 07:00 → D2 18:00 (1.333); D3 15:00 → D3 20:00 (1.083); D4 17:00 → D5 22:00 (2.083); D6 19:00 → season end (2.083) | H. w5_3-social-99; 9 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Humphrey Friforrin · w5_3-social-88 | D2 07:00 → D2 19:54 (1.417); D3 17:00 → D3 23:00 (1.125); D4 20:00 → D5 12:00 (1.542); D6 09:00 → D6 17:00 (1.208); D7 14:00 → season end (1.292) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Agnes Friforrin · w6_3-social-89 | D2 07:00 → D2 19:00 (1.375); D3 16:00 → D4 17:00 (1.917); D5 14:00 → D5 21:00 (1.167); D6 18:00 → D7 19:00 (1.917) | H. w5_3-home-11; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Edwin Thuson · w5_3-social-90 | D2 07:00 → D3 23:00 (2.542); D4 20:00 → D5 13:00 (1.583); D6 10:00 → D6 22:00 (1.375); D7 19:00 → season end (1.083) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Gunnilda Thuforrun · w6_3-social-81 | D2 07:00 → season end (6.583) | H. w5_3-home-31; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Simon Seesi · w5_3-social-91 | D2 07:00 → D2 17:00 (1.292); D3 14:00 → D3 18:00 (1.042); D4 15:00 → D4 22:00 (1.167); D5 19:00 → D6 01:00 (1.125); D6 22:00 → season end (1.958) | H. w5_3-home-6; 9 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Christina Thuson · w5_3-social-93 | D2 07:00 → D3 01:00 (1.625); D3 22:00 → D4 22:00 (1.875); D5 19:00 → season end (3.083) | H. w5_3-home-26; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Cecily Bobarin · w5_3-social-94 | D2 07:00 → D2 21:00 (1.458); D3 18:00 → D4 13:00 (1.667); D5 10:00 → D5 16:00 (1.125); D6 13:00 → D6 24:00 (1.333); D7 21:00 → season end (1.000) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Aldith Thuson · w5_3-social-95 | D2 07:00 → D3 14:00 (2.167); D4 11:00 → D4 19:00 (1.208); D5 16:00 → season end (3.208) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Henry Seesi · w5_3-social-96 | D2 07:00 → D5 16:00 (4.250); D6 13:00 → season end (2.333) | H. w5_3-home-16; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Gunnilda Frifoblo · w5_3-social-97 | D2 07:00 → D5 17:00 (4.292); D6 14:00 → D6 24:00 (1.292); D7 21:00 → season end (1.000) | H. w5_3-home-16; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Stephen Frifoblo · w5_3-social-98 | D2 07:00 → D5 20:00 (4.417); D6 17:00 → season end (2.167) | H. w5_3-home-16; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Etheldreda Thuho · w6_3-social-87 | D2 07:00 → D2 18:00 (1.333); D3 15:00 → D3 22:00 (1.167); D4 19:00 → D5 18:00 (1.833); D6 15:00 → season end (2.250) | H. w5_3-social-99; 9 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Isabel Frifoblo · w5_3-social-102 | D2 07:00 → D2 18:00 (1.333); D3 15:00 → D3 20:00 (1.083); D4 17:00 → D4 23:00 (1.125); D5 20:00 → D7 01:00 (2.083); D7 22:00 → season end (0.958) | H. w5_3-social-99; 9 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Roger Friforrin · w6_3-social-107 | D2 07:00 → D3 16:00 (2.250); D4 13:00 → D6 23:00 (3.292); D7 20:00 → season end (1.042) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Petronilla Frifoblo · w5_3-social-103 | D2 07:00 → D2 19:00 (1.375); D3 16:00 → D3 22:00 (1.125); D4 19:00 → D5 20:00 (1.917); D6 17:00 → D7 15:00 (1.792) | H. w5_3-social-62; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Richard Yaforlo · w6_3-social-108 | D2 07:00 → D3 19:00 (2.375); D4 16:00 → D5 21:00 (2.083); D6 18:00 → D7 02:00 (1.208); D7 23:00 → season end (0.917) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Beatrice Thuson · w5_3-social-104 | D2 07:00 → D2 18:00 (1.333); D3 15:00 → D3 23:00 (1.208); D4 20:00 → D6 18:00 (2.792); D7 15:00 → season end (1.250) | H. w5_3-social-82; 0 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
| Luke Thuson · w6_3-social-116 | D2 07:00 → D2 17:00 (1.292); D3 14:00 → D3 18:00 (1.042); D4 15:00 → D4 18:00 (1.000); D5 15:00 → D6 23:00 (2.208); D7 20:00 → season end (1.042) | H. w5_3-social-99; 9 portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |
<!-- END INVENTORY -->

## Checks, evidence and limits

`npm ci` ran first in this worktree. It installed 1,056 packages and audited 1,057 in two minutes. Project dependencies are private to this checkout. The game source, package files and existing tests are unchanged. This is a report and standalone research-driver change. The relevant-check policy in [`docs/verification.md`](../docs/verification.md) applies. No whole test suite ran.

| Check | Command or receipt | Exit | Literal standard output |
| --- | --- | --- | --- |
| JavaScript syntax | `for file in scripts/research/*.cjs; do node --check "$file" || exit; done` | 0 | Empty |
| Shell syntax | `bash -n scripts/research/week-levers-survey.sh` | 0 | Empty |
| Research lint | `npx eslint scripts/research/*.cjs` | 0 | Empty |
| Whitespace | `git diff --check HEAD` | 0 | Empty |
| Seed survey | `survey-live-1.exit` through `survey-live-10.exit`, under `.cache/week-levers/` | All 0 | Individual full timelines are in the matching seed logs |
| Matched-pair analysis | `.cache/week-levers/analysis.exit` | 0 | Summary below. Full structured output is in `analysis.log` |

This JavaScript repository has no TypeScript configuration or typecheck script. The parser and lint checks cover the new Node scripts. No test configuration, shared test harness or fixture changed, so no whole-area exception applies.

The AFFECTED command was:

```sh
flock -w 7200 /tmp/27agents-gate-2.lock env -u NODE_OPTIONS npx jest --changedSince=a2c0cba --passWithNoTests --maxWorkers=2
```

It exited 0 with this literal output:

```text
No tests found related to files changed since "a2c0cba".
```

The standalone production build command was:

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npx webpack --config scripts/research/week-levers-webpack.cjs
```

It exited 0 with this literal output:

```text
asset survey-bundle.cjs 2.24 MiB [emitted] [minimized] [big] (name: main) 1 related asset
orphan modules 195 KiB [orphan] 20 modules
runtime modules 1.35 KiB 5 modules
modules by path ./src/game/*.js 890 KiB
  ./src/game/world_history.js 18.2 KiB [built] [code generated]
  + 83 modules
modules by path ./src/data/ 1.74 MiB
  json modules 1.74 MiB 4 modules
  javascript modules 1.16 KiB 2 modules
modules by path ./scripts/research/*.cjs 8.31 KiB
  ./scripts/research/week-levers-bundle.cjs 314 bytes [built] [code generated]
  ./scripts/research/week-levers.cjs 8 KiB [built] [code generated]
modules by path ./node_modules/ 23.7 KiB
  ./node_modules/mersenne-twister/src/mersenne-twister.js 7.18 KiB [built] [code generated]
  ./node_modules/simplex-noise/simplex-noise.js 16.6 KiB [built] [code generated]
+ 4 modules
webpack 5.112.2 compiled successfully in 37389 ms
```

The complete analysis and report commands are `node scripts/research/week-levers-analyse.cjs` and `node scripts/research/week-levers-report.cjs`. Their literal summary lines are:

```text
PASS analysis: 10 seeds, 12 matched pairs, 196/198 historical records match; exact live-export replay differs
PASS report: 10 seeds, 12 pairs, 157 hunger spells, complete exported inventory
```

The analysis requires ten successful seed receipts, identical control hashes, consistent paired frame intervals and season ends, five discovery-constrained pairs, the browser frame cap and a supplied wall clock. It checks the discovery and outdoor-body evidence at targeted interaction orders. The report generator refuses a partial analysis.

The raw object graphs, actions, event lists, frame traces, requests, chat transcripts, failure logs and process receipts are under `.cache/week-levers/`. They are ignored by git. Each experiment has separate `13-<case>-control.json` and `13-<case>.json` observations. `analysis.json` and `experiments-all.json` collect the checks and comparisons. No screenshots or browser-click acceptance were part of this headless job.

The initial probe failed because it called the private `foodReserve` helper. The corrected driver reads the exported `householdFood` result. Two early bundle builds failed on production substitution of an environment assignment. A report-generator syntax check failed on a closing bracket. The first per-visit annotation pass lacked the map-level opinion context for newly created Hugh. Each failure remains in its `.cache/week-levers/*failed*` log or `baseline.log`, with its exit receipt. Corrected checks pass. Preliminary runs interrupted to correct the season boundary or reschedule work retain their logs and saved PIDs. They supply no claimed completed outcome.

Exact reproduction of the played export remains unproved. The tested scripts do not establish that every exported event can be prevented, or that a food gift heals an argument. Mabel's scripted approaches and Hugh Jobari's news approaches did not reach their intended panels. No favour was completed and no player news-telling effect was demonstrated. Hugh Seesi's real campfire conversation did complete, and it changed his regard without changing the measured community events. Player marriage, household invitations and working with friends are source-confirmed routes, not measured successes here.

All created project files belong to this worktree. No other worker branch, vault, delegation log or bench ledger was read for comparison or written. No sub-agent or other model ran. No push or stash occurred. The job used no application server and left ports 8080–8082 alone. A temporary inspector on port 9229 observed only an owned Node process. Only processes recorded as started by this job were stopped.

## Reproducing the research

Run these commands from the worktree root at the recorded base. They write data under `.cache/week-levers/`. A fresh run generates each seed's world history once and restores that cached graph for its pairs. The actual run used the two shared locks and split the survey across disjoint seed batches. The `survey-live-*.exit` receipts are authoritative for the completed survey. The `live-` label selects the real wall-clock driver; the explicit frame value selects the browser cap.

```sh
npm ci
flock -w 7200 /tmp/27agents-gate.lock env WEEK_LEVERS_FRAME=6 WEEK_LEVERS_LABEL=live bash scripts/research/week-levers-survey.sh 1 3 5 7 9
flock -w 7200 /tmp/27agents-gate-2.lock env WEEK_LEVERS_FRAME=6 WEEK_LEVERS_LABEL=live bash scripts/research/week-levers-survey.sh 2 4 6 8 10
flock -w 7200 /tmp/27agents-gate.lock node scripts/research/week-levers-experiments.cjs --frame=6 --prefix=live- --receipt=experiments-live-a.json visible-food-juliana visible-chat-mabel visible-news-hugh
flock -w 7200 /tmp/27agents-gate-2.lock node scripts/research/week-levers-experiments.cjs --frame=6 --prefix=live- --receipt=experiments-live-b.json visible-food-margaret visible-favour-mabel
flock -w 7200 /tmp/27agents-gate.lock node scripts/research/week-levers-analyse.cjs
node scripts/research/week-levers-report.cjs
```
