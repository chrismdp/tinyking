# Travel and persistent communities

Click any walkable boundary tile. Its popup names the adjacent **Reach x, y**,
biome and selected side, and describes the journey and cancellation policy. Press
**Travel** explicitly, or **Stay here** to close it. Ordinary tile orders remain
below the invitation. Ocean and the finite world's rim explain their block in the
same popup. The clock and World map button open the separate [world map](realm-map.md). M also opens or closes it. A boundary corner belongs to the side with the greatest outward
projection; exact ties choose the lowest side index. World sides are east,
south-east, south-west, west, north-west and north-east.

## Planning a journey

Open World map and select a land hex. Plan journey chooses a shortest route of
adjacent land hexes with surveyed passes. Planning creates no detailed map.
The map draws biome colours, your current hex, personally known hexes,
discovered communities, recorded border roads and the remaining journey route.
The map does not pause time. Closing it unmounts its SVG and stops all map work.
New-game and debug previews keep their existing SVG overview.

A journey walks through every hex. The planner walks to the next surveyed pass,
then performs the hop. Its existing pathfinder favours worn roads.
The edge-tile Travel invitation also creates a journey to the adjacent hex.
The task panel and world map state how many seasons remain.
Stop journey here cancels the remaining route. Selecting another destination
changes course from the current hex. Cancelling the Travel task also stops the
route. An unreachable next local pass leaves a paused journey that you can stop
or replace.

## Walking and arrival

Acceptance cancels unfinished local player orders and accepted local favours
through their existing cancellation/release functions, without completion or
reward. It releases attention, whole-field and per-patch claims. Work and goods
already delivered remain. Reserved borrowed harvest is released at the player's
actual position, still owned by its household. Other held goods, including
third-party cargo, and carried unique possessions travel with their existing IDs,
legal owners and provenance. Uncarried property remains on its map.

The normal ordered HTN queue performs `walk_to` followed by `leave_edge`:
pathfinding reaches the selected tile, then the character physically steps off
its navigation mesh. A cancelled Travel queue entry cancels departure. Only after
crossing does the calendar hop one season. The date advances seven days and the
arrival clock becomes 6am. This crosses exactly one seasonal boundary, even
when the departure hour differs. The traveller receives one seasonal ageing and
goodwill update. The partial-hour clock restarts at dawn.

Normal needs continue during the walk out. Energy and tiredness are frozen on the
off-map journey, while generation runs, and through the 5.2-second arrival.
No food, healing or inventory is supplied. Every arrival starts at dawn and uses the opposite side's
deterministic boundary → middle → camp route and the opening's put-down/fire/
bedroll sequence, skip control and standing handover. A first visit creates one
empty camp. Returning retains that camp's identity, location and stores, and the
existing home; the arrival rest at another pass does not create a duplicate camp.

All land passes are established during generation, independently of the eventual
arrival side. A pass has two inward walkable tiles, a farm-sized clearing, six
reachable trees, three nearby forage plants and a walkable connection to a
village. Seasonal availability still applies. Berries are unavailable in winter. Remaining roots can still be gathered.
A coastal land hex without a natural three-house site receives an inland village
clearing. Ocean has no pass. Continuous coastline generation otherwise stays in
use. Passes can clear narrow paths across intervening terrain where necessary.
These are initial geography/resources, not journey supplies; returning does not
regrow used resources or refill a store.

## Camping during a journey

A traveller can keep walking after dark. At zero energy, they make camp at their
actual position and sit by the fire. The camp uses the existing bundle, fire and
bedroll. At 11pm they turn in unless a conversation holds attention. Rest can
start sleep earlier. Energy and tiredness retain their current rules.
After sleep, the character packs the temporary camp and resumes the same Travel
task. Eating can also replenish energy and allow travel to continue.
A stopped journey leaves its bedroll available for ordinary rest.
The remaining route and temporary camp survive saving and restoring.
The arrival camp remains separate from this temporary journey camp.

## Identity and ownership

`state.travel` owns the world seed, active coordinate, visited/generated map
snapshots, an authoritative people directory, events, NPC transit and visit
records, and the processed season. Each snapshot stores local ECS, spatial index,
map, households/villages, relationships, knowledge/events, favours, weather snow
and ecology. `residents[id]` distinguishes actual residents (including deceased
local ancestors) from reference-only people. Physical planners/spatial/holder
records move once; a person can be resident on one map or in transit.

Old saves retain their legacy IDs. New world households allocate `wX_Y-`
before ordinary entity prefixes and their local sequence. Detailed terrain and
later local entities use `terrainX_Y-`. A person keeps their original ID after a move. Numeric `nextId` and coordinates remain
numbers; no post-hoc recursive remapping occurs. Social, item, village, favour and
event IDs all use this namespace. IDs contain no colon, so the existing sorted
`a:b` contact/avoidance/courtship keys and `split(":")` parsing keep working.
Player task numbers are queue-local and retain their existing meaning.

Each person's generated tastes/traits, opinion seed and hate/love thresholds are
fixed when their community's prehistory finishes. Directional opinions use the
observer's own seed and thresholds. Travel never recalibrates a population and
never recomputes a person's quantiles against newcomers. Later children inherit
a parent's fixed seed/threshold scale while receiving the existing inherited/
random personality. This retains disposition/ring caps for existing haters,
friends and potential partners without manufacturing compatibility. Goodwill
still drifts; ring capacity and actual contact rules still apply.

The directory retains ancestors and person/quest references globally. A map
imports only the family, known-social and ownership references it needs. Kin
queries can also resolve ancestors in the directory. Two-generation ancestry
checks are rebuilt outside a synchronous history scope, so importing a previously
missing grandparent cannot leave a stale cousin result. Remote people do not
age, drift, court or appear physically in a local step. Remote family/person
sheets remain readable, with “Away in another world hex” and no talk controls.

## Time and autonomous visits

New games generate every land community together for 180 seasons before play.
Only the active hex runs live planners, needs and village routines. At each
crossed season, `advanceWorldClock` advances the compact away communities once.
Travel removes the player first and advances the departed community too.
Arrival uses the stored households and seed. It never replays prehistory.

The away step uses the shared birth, courtship, marriage, death and move rules.
It updates household grain through one seasonal harvest and meal calculation.
It does not replay hourly needs, ecology, weather, crops or detailed construction.
The stored field count determines the household harvest. Detailed crops and
terrain stay in the saved hex record until the player returns.

A seasonal transfer batch snapshots its initial communities and residents,
finishes their seasons, resolves due arrivals, then considers only those initial
residents for departure. New arrivals and newly generated residents cannot take
another seasonal update, another trip or recursively generate neighbours in that
batch. Active-map departures use the independent NPC's HTN walk/edge tasks;
active-map arrivals walk inward through that planner and record news/activity.
Off-screen departures/visits/returns are events in summary. Each NPC trip takes
seven days, with one demographic season and frozen needs in transit.

Autonomous visits never generate a detailed destination map. In new worlds,
travellers join the compact destination community and meet its real residents.
Old saves retain their reference-only visit policy for unknown communities.
For those old saves, the actual traveller and carried property remain in a
reference-only visit. Age and outgoing goodwill advance once per season; needs
remain frozen without a simulated local household. After three seasons the
visitor begins the normal one-season return. If the player opens the reach first,
the visitor joins its real household simulation. Unknown communities supply no
invented contacts, marriages or possessions during a reference-only visit.

Old saves retain their former hourly household needs calculation. New worlds
use the seasonal household calculation above. Neither model permits starvation
deaths. Old age uses the shared death and inheritance rules. Travellers retain
the documented freeze of needs on the road.

An unmarried adult without a *viable mutual romantic prospect* locally may seek
company in an adjacent land community, even if unrelated but incompatible adults
are present. The same eligibility, kin exclusions and mutual love/Intimate ring
caps apply. Exploration chooses a seeded neighbouring road without reading
unvisited personalities. It remembers visited reaches and gives a visit three
seasons to make contacts. Viable prospects can prolong the visit. Existing
summary conversations/live visits accumulate actual goodwill, and existing
courtship consent and time determine marriage. A married visitor records a
permanent move; otherwise a visit with no viable prospect returns home. Original
household/trade references and ownership are retained for return. Land and
uncarried assets are never transferred merely because their owner visits.

This is a finite radius-five world. No boats connect islands. An island can still
run out of unrelated mutually compatible adults; random tastes, kin saturation,
ring slots, age and actual consent can prevent marriage even when raw unrelated
candidates exist. Journeys offer opportunities, not guaranteed population growth.
There are no quests, boats, travel costs or separate travel inventory. [Family and succession](design.md#marriage-ownership-and-succession) extends the shared lifecycle and persistent maps.

Transit also applies one season of the traveller's outgoing goodwill drift;
incoming relationships drift in the communities where their observers remain.
Each traveller, including the player, ages once on the road. A road death runs the existing death/heir rules on
the real bundle with remote kin references, retains death/inheritance news and
places the actual inherited objects in the departed reach's estate. It does not
arrive a living replacement or silently lose the heirloom. A road death can trigger player succession after its actual estate is settled. Arrival rebuilds the planner's holding
flags from actual accessible commodity cargo, leaving unique possessions intact.

Temporary accommodation is marked `ecs.guest`: the visitor can use the host's
household, while keeping their original controller chain and estate. Guests are
excluded from household controller reassignment and grown-child settlement.
Their destination queue starts empty. A genuine marriage removes guest status;
a return restores the saved home/trade references. Guest access grants no title,
recruitment or control over either family's assets.

Death after a visit or a permanent marriage move also settles across maps. The
ordinary death rule records its chosen `heirId`. Travel publishes the death and
reconciles that estate before another community can reassign an absentee owner's
house. Original houses, stores and uncarried possessions pass to that heir through
the existing inheritance/provenance/event functions, once. Cargo already on a
road keeps its identity and location when its legal owner dies. A departed family
head leaves local working relatives under their own resident household head;
legal ownership stays with the absent person until a real inheritance occurs.

The final steps off an edge have a visible planner phase. Once a character crosses
the navigation boundary, transfer is immediate in that simulation step. A new
needs signal cannot restart pathfinding from outside the map. Normal
needs still accrue until crossing, and cancellation remains available while the
character is on the walkable edge.

A map has a persisted monotonic `eventIds.next` sequence, independent of imported
or replaced event arrays. Pure history steps copy that counter; live snapshots
share the active map's counter. Global event IDs therefore cannot be reused after
an unseen remote inheritance or local/global refresh. The directory merges each
person's learned event IDs, and arrival/reference refresh restores them to their
resident map. Heirs retain knowledge of their own remote inheritance.

Arrival batches import legal-owner chains for real cargo, land all initial due
travellers, then refresh each touched community's references and household once.
They retain the start-of-step demographic/transfer boundary. Local orders or
favours accepted during the walk out are cancelled again at the actual walkable
edge, through the same release paths, before any borrowed crop crosses it.

Reference refresh uses one multi-source two-generation family walk, rather than
repeating the same shared ancestry for every person. A stable global event-order
index lets each map import its learned event IDs directly in the original order.
These are derived indexes: no resident, event, relationship, season or encounter
is sampled, skipped or capped to reduce processing cost.

Rendering samples opaque entity IDs for tree shape and object orientation without
converting the ID to a number. Legacy numeric IDs retain their existing looks;
namespaced vegetation and carried/ground goods have finite deterministic transforms.
The map-transfer UI callback closes any local popup opened during the departure
walk, as well as the original invitation. Skipping arrival cannot restore that
old popup or leave executable old-map targets in the new map.

The player uses [energy](survival.md), with deliberate Eat and Rest actions.
Walking spends a little energy. Current journey dates use `DAYS_IN_SEASON`.

## Storage and memory

`travel.maps` retains compact records for every land community and the active
detailed map. Compact records contain people, households, legal ownership,
stores, relationships and events. They contain no tile table, crop slots,
animal simulation, terrain surface or planners.

A departure commits its detailed hex record and the new world manifest in one
IndexedDB transaction through the save worker. The arrival renders its first
frame before the main thread copies that checkpoint to the worker. Closing the
page before this scheduled copy submits it immediately. Only after the commit
can the away map leave memory. A failed transaction retains its detailed state.
A return loads that record and applies the current compact people and household
records. It preserves the map seed, buildings, fields, stores and objects.
The seasonal cursor prevents another update of the same season.

The manifest records the active hex, saved record versions, compact communities,
people directory, travellers, calendar and remaining journey. A reload during a
local departure walk restores that walk. A completed hop checkpoint restores the
arrival. It does not repeat the transfer. Superseded hex versions leave storage
in the same transaction as the replacement manifest.

Saves from the earlier version remain readable. They retain their existing
per-hex history and detailed away simulation until a later migration changes
that policy. No new history replaces people in an old save.
