# Social life and history

The social simulation runs without a renderer. `historyStep(worldHexState, season)` returns a new world state for one dated season. The input stays unchanged. Old events and geography stay shared because the step never edits them.

Generation starts with founding households and advances 180 seasons, or 45 game years. Founding households start with adults. Seasonal births produce their children. The founders include unrelated families so that villagers can find partners outside their close kin. Dead people remain ECS records. Their `historical` flag keeps their bodies off the map. Family trees and provenance still refer to their original identities.

## Records

Each event contains `id`, `type`, `people`, `day`, `season`, `villageId`, `place` and `items`. Moves add `fromHouse` and `toHouse`. Deaths add `cause`. The event list lives at `state.events`. New worlds store knowledge on events, with private knowers and village or hex scopes. `knownEvents` reads that state. Earlier saves keep their per-person event lists. Ask about copies permitted events from the speaker’s knowledge and records the spoken source. Completed-contact bookkeeping itself copies no events or possessions. Warnings, reports, oaths, gifts, courtship, play and household invitations therefore disclose no family history. A spoken family answer grants only its stated facts; a disclosed possession event can identify that item.

A personal item has an ECS identity and a `possession` component. It contains `name`, `kind`, `ownerId`, `maker`, `originalOwner` and `owners`. Each entry in `owners` contains `personId`, `day` and `reason`. `carried` separates personal belongings from the two working hands. Personal items never enter commodity totals. A gift transfers the same unique item and appends its new owner. Splitting an ordinary stack preserves its good metadata.

Households own their house, rooms, stores, fields, workshops and animals through their house references and controller chain. People keep household membership in `household[personId].houseId`. A death or move repairs resident controllers and selects a living adult trade holder. A living owner keeps a house even when they move out. Residence and working access are separate from legal ownership. Residents farm, eat and sleep at their own household; a remote heir does not merge estates or take the residents into their controller chain. Only an ownerless home can be claimed outright. A close relative can use an available family home without taking ownership. A vacant workshop retains its trade and building.

## Rules

In new worlds, ordinary summary events inform participants, local close kin
and selected villagers. Live hearing checks use people within 300 world units.
Romance and affairs inform participants and actual witnesses within 85 units.
Summary history invents no witnesses. Remote family do not hear an event merely
because their components are available in the directory. Existing moved kin
and travellers retain their real links. Learning news about a remote stranger
can change anonymous regard, without creating acquaintance.

Every event starts private, with explicit knowers. When half a village knows
it, with a minimum of three knowers, it becomes generally known there. A village
smaller than three needs all its people. Covered individual entries are removed.
When two villages in one hex know it and at least 60% of that hex is covered,
with at least four people, the event becomes public in that hex. Public status
does not inform another hex. Travellers must carry relevant news there.

The event catalogue declares relevance to affected people, kin, its village or
its hex. Work and harvest news usually stay in their village. Travel and major
community events can matter throughout their hex. Gossip carries only relevant
news and still passes `canDiscloseEvent`. On departure, a person remembers the
knowledge scopes they visited, up to that date. They do not learn later news
from a place they left. Private exceptions retain explicit knowledge outside a
promoted scope. Sealed backstory remains hidden.

Promotion gives the scope its learning effects once. Later hearing does not
repeat them. NPC source and reaction rows covered by promotion are removed.
Player spoken sources and private discoveries retain their evidence. The feed
and activity labels continue to hide unknown identities. Earlier saves retain
the former initial audiences and learned-event lists.

Event definitions declare `onOccurrence` and `onLearn` effects. Effects change directional goodwill, set avoidance, record a reaction, or record a consequential event. Learning about a quarrel with close kin costs three goodwill towards their opponent. A gift adds one goodwill towards the first participant when the second participant is close kin. Reconciliation restores three goodwill towards each participant whose opponent is close kin, matching the family loss from a quarrel. Each person receives learning effects once per event. Repeated hearing and travel knowledge merges keep the same event identity and do not replay these effects.

An autonomous NPC conversation lasts half a game hour. Player Chat uses the paused matching panel in [Conversations](conversations.md), with no flat goodwill reward. A visit can include three conversations, with each effect earned after actual time together. They add four goodwill towards someone loved, one towards someone liked, or subtract 0.25 towards someone hated. Authored quarrels distinguish an unhappy relationship from personality friction. Negative goodwill in either direction permits regular quarrels at 8% per conversation. Otherwise, hate disposition permits rare friction at 0.15% per conversation. A quarrel costs six goodwill in both directions and starts one season of avoidance. Spouses and housemates receive six seasonal opportunities, with one attempt per action per season across household and contact hooks. The negative-goodwill action and the friction action have separate, mutually exclusive conditions. A quarrel also blocks either action for a full season through avoidance. Poor relationships can therefore cause quarrels without a chosen visit. After avoidance expires, the next household season or conversation records reconciliation before any quarrel attempt. It restores six goodwill in each direction, so quarrels alone cannot accumulate permanent losses. For villagers, meals and sleep run before storage, social visits and work. The player uses deliberate meals and rest with an energy budget. A full store cannot block a hungry person from eating carried grain. A person eats held food where they stand. An old gathering destination cannot delay a meal. Meals try household containers before stockpiles and loose harvest. Work retains its original resource order. Path wear discounts at most half a grassland edge, and starts at zero on an unworn path. The old unbounded reward created negative costs and long detours. These are functional food-use and routing corrections. Player orders retain their existing priority.

Unmarried adults can meet and court across villages on the current local map. Eligibility excludes the player, living spouses, children and close kin. Mutual attraction guides partner seeking; that intent takes priority over even a very old family friendship, whose goodwill remains unbounded. Available seekers choose before casual companions; an existing friendship can also motivate a visit without romance. Courtship requires mutual Intimate rings. Parents, siblings and people who share grandparents cannot court. Mutual closeness must last two seasons before marriage. Starting live courtship and marrying need a conversation within the last seven days. Once courtship starts, its time remains while both people stay Intimate. A missed season of contact does not erase that closeness. Losing mutual Intimate still clears progress. A distant historical bond alone cannot trigger a wedding. Automatic courtship and marriage still exclude the player. After arrival, the player takes part in shared ageing, births and death. [Family and succession](design.md#marriage-ownership-and-succession) describes deliberate courtship and control transfer.

A couple and their dependent children use a family house with room for six residents, then a genuinely available home in either community or an inherited estate they own. An empty home with a living unrelated owner is unavailable. Personal IDs, kin links and possessions survive a move. Move events preserve both home and village identities. A move resets stale plans, farming claims and trade assignments, then sends live movers home through the planner. If neither exists, a rendered world can build a cottage on nearby unused grassland. A summary world can supply plain `houseSites[villageId]` coordinates. The village retains its eight-house limit. If there is no suitable site, marriage waits. Marriage and moves retain both partners' personal belongings.

Birth probability is 55% per eligible couple per season. Population relative to three people per house scales it by 0.2 to 2. Couples wait one game year between births. Parents must be adult and at most 55. A household with six residents waits for room before another birth. Grown children can leave crowded households for ownerless homes or available close-family homes, including a family home in another village. A living owner keeps the estate. Couples take their dependent children with them. A child inherits one parent's trait and the other parent's tastes. Opposed traits stay excluded.

Children reach developmental age 18 in two game years. Adults then gain two displayed years per game year. `lifeYears` stores elapsed game years on that scale. A newborn therefore reaches old-age eligibility after 23 game years. This keeps fast childhood separate from adult ageing.

From displayed age 60, death probability is 2% per season, multiplied by `1 + (age - 60) / 12`. Age 88 is the final old-age boundary. Inheritance chooses a living spouse, then the eldest living child, then the oldest person in the nearest kinship layer. With no heir, a personal item becomes an unclaimed estate and retains its provenance. A living player can inherit under the same rule. Pre-arrival history excludes the newly created stranger entirely.

Seasonal history uses the same birth, courtship, death and inheritance functions. It summarises six half-hour conversations with a seasonal companion. Hostile companions have one accidental encounter because they avoid each other. Live visits begin only while idle after needs and work. From 14:00 to 21:00, people can choose a reachable friend or an eligible partner. A route must leave time for a half-hour conversation. The guest uses real `walk_to` tasks, the host waits, and the guest walks home after the visit. Hunger, sleep and ordered work interrupt the visit. Current activities distinguish travelling, waiting, chatting/courting, returning and moving home. Hourly play requires real proximity and a running social task. Seasonal history applies the same 168 hours of relationship drift as live play. Neglected goodwill moves towards its starting value at `0.025 * 3 / 7` per hour, or 1.8 per season.  One three-conversation visit earns 12 goodwill between mutually attracted people. With one visit per season, the new net gain is 10.2 rather than three. Rings, thresholds, conversation rewards and the two-season courtship wait stay unchanged. The same rate applies to live play and generated history, so generation can produce different starting families.

## Review tools

`npm run storyboard -- <url> <outdir>` runs one ordinary session at 1440 by 900. It watches the opening, selects a villager, queues Chat, chopping and a lean-to, and runs one day at Fast. It opens news and a family tree, then selects the player. It records each frame's clock, tasks, hunger, ring, hint and latest events in `story.json`.

`node scripts/social-check.js 20 1234 98765 --determinism` runs the real planner for five years. It measures two-year survival, five-year population and meals, and compares a repeated final ECS. It saves real evening and wedding snapshots for `scripts/social-shots.js`. Those screenshots use diagnostic terrain discovery and camera selection. The heard-news fixture grants the speaker Social trust, then calls the real Ask about function. The storyboard does not use this setup.

## Local-map travel boundary

All references are existing ECS people and household IDs. Social visits and home moves stay inside this world hex’s state. No person is copied or invented to satisfy a marriage. World travel carries these same people and event identities between hexes. `historyStep` has no renderer or pathfinding dependency; summary encounters use the same eligibility, relationship effects, kin exclusions, consent, demographic and ownership rules. Live navigation is isolated in `social_visits.js`.

Generation runs the same seasonal transition on its owned summary rather than making 180 unnecessary snapshots. The exported seasonal step still copies caller state. Candidate pools and event-membership caches avoid repeated scans without changing outcomes.

`node scripts/social-mobility-probe.js` reports initial, five-year and twenty-year seasonal population, age cohorts, events and eligible local/distant partners for seeds 20, 1234 and 98765. Eligibility is an opportunity, not attraction or consent. Finite communities can lose people or have no mutually attracted partner. These rules do not promise a marriage for every adult or survival forever.

`SOCIAL_OUT=<dir> node scripts/social-check.js 20 1234 98765 --determinism` also records live cross-village journeys, visits, weddings and remembered moves for diagnostic UI review. `node scripts/social-mobility-shots.js <url>` uses those real snapshots with disclosed observer setup and physical clicks/taps. The standard storyboard is command-assisted: selection, orders and speed call public `ui.actions`; disclosure buttons are clicked. Supplemental screenshots test physical discovery and phone layout separately.


`food-audit.js` reports edible portions, empty resident homes and individual risk traces. Each trace keeps hunger, task, plan, hands, household, source ownership, access and a real route to accessible stores. `social-check.js` counts completed meals at each six-minute step, separately from the original hourly meal gate. It records seasonal food totals and pre-death traces without changing state. An empty household reserve can coexist with private food elsewhere. These diagnostics do not grant access or create food.

## Player questions and closing replies

A player question receives its own reply before the icon row can end the chat.
Specific questions use answers from that topic. When the speaker has no eligible
fact or refusal left, an authored reply says that they have nothing more to tell
on that topic. A children question never selects another kind of relative.
Known deaths replace living-relative questions with condolences.

An NPC request always gives the player an accept or decline choice. A referral
always gives the player a closing reply. These responses remain available when
the row is full, including in tired chats. They do not need an extra patience
slot. If the row filled at the offer, the chat ends after the response and its
NPC reply. Otherwise, the chat continues with its usual patience. The visible
row still keeps its normal maximum size.

Each player remembers the last eight spoken NPC row IDs for each reply purpose across people. The
wording selector skips those IDs when another eligible wording exists. It also
keeps the existing rule against repeating the previous wording on a return
visit. An on-topic answer takes priority when only one eligible wording remains.

## Seven-day seasons

History still contains 180 seasons, or 45 years. Dates use seven days per season.
Ageing, births and old-age probabilities remain seasonal. Courtship still waits
two seasons. Festival attendance and the season-turn page use only real events.
Public honours and memorial readings disclose their actual recorded events to
people present. Sealed backstory stays hidden. See [the core loop](design.md#seasons-and-gatherings).

## Event accounts and audiences

The shared event catalogue is `src/data/event_types.json`. It defines each type’s wording, topic icon, participant roles, ordinary disclosure and feed membership. The news feed and chat read this table. `tools/chat-design/gen_lines.py` generates NPC accounts, player Tell rows and overheard event lines from it. The catalogue also declares occurrence effects, learning effects and restricted initial audiences. Romance and affairs start with their participants and actual nearby witnesses. Summary history has no invented witnesses. Sealed backstory remains inaccessible.

One policy, `canDiscloseEvent`, governs NPC speech, player Tell and legacy Ask about. Public events include weddings, births, deaths, completed buildings, household arrivals and oaths. Social trust admits moves, help and woodland incidents. Personal trust admits inheritance, household joining, gifts, reconciliation, quarrels and defiance. A public legacy answer discloses its event without disclosing an unrelated family tree.

A quarrel between current spouses needs Intimate trust, or Personal trust for a listener with negative goodwill towards a subject. The policy excludes either subject’s close kin and close friends from third-party disclosure. It reads current kinship and directional bonds. Disclosure does not erase existing knowledge. New-world initial family learning stays within the local hex.

Player Tell uses only known, unsealed, permitted records. A card carries the catalogue topic and every participant. Anonymous witnesses can tell what happened without naming unknown people. New listeners learn through `learnEvent`, which keeps family reactions once per learner. Private spoken sources retain the first teller, day and line. Player sources also retain this evidence after promotion. Retelling records the player as the new listener’s source while preserving the player’s earlier source.

Mood preferences are stable calculations from each person’s personality, tastes, identity and opinion seed. Learned mood scores live beside topic evidence in personal knowledge. Existing save and traveller knowledge records carry that evidence and spoken event sources.


## News between villagers

Each encounter permits one unheard event from each villager after the first completed half-hour. Both choose before either learns, so a story cannot bounce straight back. An interrupted walk or unfinished half-hour transfers nothing. Player interactions retain their explicit spoken disclosures.

The seasonal encounter represents six half-hours and permits at most one event in each direction. A hostile encounter represents one half-hour. A quarrel ends the exchange. These limits also bound older anecdotes. They do not multiply the initial event audience.

`canDiscloseEvent` filters every candidate before preferences apply. The catalogue marks good and unflattering news with `valence`. Unflattering news favours listeners with distant or hostile bonds towards the subjects. Good news favours listeners with close bonds. Trust and recency also weight the choice. Companion selection checks the latest permitted unheard account before ranking otherwise equal listeners. News preferences break ties between otherwise equal social companions. Partner attraction and existing friendship retain priority. Hard exclusions remain exclusions regardless of preference.

`learnEvent` applies the existing kin reactions only on first learning. `spokenSources` records the teller, day and catalogue account. Later hearing preserves that first source. A listener also learns names actually stated by the teller, without gaining acquaintance or trait knowledge. Anonymous accounts stay anonymous. Visits between villages and existing traveller bundles carry the same event IDs and personal knowledge. Seasonal copies own their source and learned-person maps. New-world news selection intersects the teller’s knowledge with the listener’s village, hex and affected kin. People in the same scope already share its general news, so selection skips those scope lists. Earlier saves retain the story-group index. Neither index enters saves.

## Hearing and evening callers

During a live conversation, each villager shows a catalogue line about the actual season or the event they just told. Event speech lasts up to half an hour while the social task continues. The player hears within 120 world units, in the same interior, with no building wall across the line of hearing. The disclosure policy also applies to the player. Sleep prevents hearing. The simulation records learning and its source. Rendering reads speech without changing knowledge.

From 18:00 to 21:00, the player can receive a caller near their own home fire, camp or journey camp. Each evening has a seeded 45% opportunity. An available friendly adult, friend or homeless stranger can use a real route and start the ordinary paused chat. Friends receive priority. Work, needs, existing visits and insufficient travel time exclude a candidate. Only one caller can set out in an evening, and an existing caller prevents another. Sleep, leaving the fire, hunger or tiredness cancels a pending caller. No new traveller is created for a visit.

## Authored social actions and romance

`src/data/social_actions.json` defines participant bindings, conditions, seeded chance, effects and the event to record. `social_conditions.js` supplies pure ring, goodwill, trait, kin, age and spouse tests for chat and simulation. Roles are explicit: actor, partner, spouse, subject, teller and listener. Missing people fail the test. Unknown tests never satisfy a condition.

`chatTogether` runs contact actions after actual contact. Summary encounters use the same function. `advanceSeasonRules` also runs seasonal actions for household pairs. Actions never scan all possible village pairs. An action remembers its latest attempt per pair and calendar day, including failed chances. Quarrels and reconciliation use a calendar season instead. Reversed contact, repeated half-hours, saves and traveller transfers cannot retry that moment. Summary contact combines its conversation opportunities into one seeded trial. A quarrel stops further contact actions and the news exchange.

Reconciliation (spike situation 2) and a visit from another village (situation 9) are the two additional data actions. Both reuse real contact and existing event definitions. Reconciliation runs on contact and household seasons. It clears expired avoidance and restores the six goodwill lost to the quarrel in each direction. The visit binds the actual visitor and host and records their villages. Local visit recording stays with the physical task. Neither action needs event-specific scheduler code.

Marital satisfaction is directional. It equals current goodwill towards a living spouse, minus 15 during active avoidance, limited to 0–100. Unmarried people have no score. A score below 30 unlocks honest unhappy-marriage speech with a Personal confidant. The score is computed, so drift and actual relationship changes take effect immediately.

Romance is an explicit mutual record on two directional bonds. Contact can form it only between unrelated living adults with mutual attraction and mutual Intimate trust. Its chance is 2% per conversation, or 11.4% across six summary conversations. Kinship, friendship and an Intimate ring alone never create romance. Romance preserves existing spouse links. No automatic dissolution rule is added.

An unhappy married person in a mutual romance with someone other than their spouse can begin an affair during contact. The catalogue records the affair and both participants know it. Live witnesses must be awake, within 85 units and in the same interior, with no wall between them. History and away-map summaries teach only participants. Gossip uses the existing disclosure policy: third parties need Intimate trust, or Personal trust when hostile towards a subject. Close kin and Personal friends of either subject cannot receive this gossip. Direct witnessing can still expose an affair to a spouse.

When a spouse first learns an affair, they lose 30 goodwill towards their unfaithful spouse. A declared quarrel then applies its ordinary six-point losses and avoidance. Reaction records use the event identity. There is no separation, eviction, parentage change or succession dispute.

Romance and affair records live on relationship bonds. Latest action attempts live on the relationship component. Reactions and discovery records live in personal knowledge. Existing generic saves, traveller components, identity records and `LOCAL_FIELDS` carry these containers. `historyStep` copies the attempt, reaction and discovery maps at the snapshot boundary. Individual writes then take constant time. New-world event audiences and scope memory use the shared world storage. Legacy saves retain their original containers.

Occurrence effects do not introduce strangers. An anonymous goodwill change stays in `relationships[id].unmetGoodwill` until actual contact introduces that person. It drifts towards zero at the ordinary rate. The shared goodwill query includes this regard. Saves, traveller identity records and seasonal copies retain it. Existing kin reactions keep their previous first-learning behaviour.
