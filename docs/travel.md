# Travel and persistent communities

Click any walkable boundary tile. Its popup names the adjacent **Reach x, y**,
biome and selected side, and describes the journey and cancellation policy. Press
**Travel** explicitly, or **Stay here** to close it. Ordinary tile orders remain
below the invitation. Ocean and the finite world's rim explain their block in the
same popup. The clock opens the existing biome/weather overview and shows the
current reach. A boundary corner belongs to the side with the greatest outward
projection; exact ties choose the lowest side index. World sides are east,
south-east, south-west, west, north-west and north-east.

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
crossing does the global calendar advance exactly three days (one season).

Normal needs continue during the walk out. Hunger and tiredness are frozen on the
off-map journey, while generation runs, and through the 5.2-second arrival.
No food, healing or inventory is supplied. Every arrival uses the opposite side's
deterministic boundary → middle → camp route and the opening's put-down/fire/
bedroll sequence, skip control and standing handover. A first visit creates one
empty camp. Returning retains that camp's identity, location and stores, and the
existing home; the arrival rest at another pass does not create a duplicate camp.

All land passes are established during generation, independently of the eventual
arrival side. A pass has two inward walkable tiles, a farm-sized clearing, six
reachable trees, three nearby forage plants and a walkable connection to a
village. Seasonal availability still applies: winter forage cannot be eaten.
A coastal land hex without a natural three-house site receives an inland village
clearing. Ocean has no pass. Continuous coastline generation otherwise stays in
use. Passes can clear narrow paths across intervening terrain where necessary.
These are initial geography/resources, not journey supplies; returning does not
regrow used resources or refill a store.

## Identity and ownership

`state.travel` owns the world seed, active coordinate, visited/generated map
snapshots, an authoritative people directory, events, NPC transit and visit
records, and the processed season. Each snapshot stores local ECS, spatial index,
map, households/villages, relationships, knowledge/events, favours, weather snow
and ecology. `residents[id]` distinguishes actual residents (including deceased
local ancestors) from reference-only people. Physical planners/spatial/holder
records move once; a person can be resident on one map or in transit.

The opening retains its legacy IDs. New maps allocate `wX_Y-` before ordinary
entity prefixes and their local sequence. Numeric `nextId` and coordinates remain
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

Live `socialHour` performs the active map's normal seasonal update. At each
crossed season, `advanceWorldClock` calls the existing pure `historyStep` once for
every other generated map. Travel first removes the player, then calls it once
for all existing maps, including the departed map. An already-generated
arrival map is therefore never advanced twice. Never-visited maps use a numeric
seed derived from the world seed and coordinate, their own 45-year prehistory,
then summary seasons 1 through the elapsed global season. Unneeded maps are not
generated. Weather always samples the global seed/calendar and current reach;
world morality/biomes are retained, never regenerated on transfer.

A seasonal transfer batch snapshots its initial communities and residents,
finishes their seasons, resolves due arrivals, then considers only those initial
residents for departure. New arrivals and newly generated residents cannot take
another seasonal update, another trip or recursively generate neighbours in that
batch. Active-map departures use the independent NPC's HTN walk/edge tasks;
active-map arrivals walk inward through that planner and record news/activity.
Off-screen departures/visits/returns are events in summary. Each NPC trip takes
three days, with one demographic season and frozen needs in transit.

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
There are no quests, boats, costs, travel inventory or succession features here.

Transit also applies one season of the traveller's outgoing goodwill drift;
incoming relationships drift in the communities where their observers remain.
An NPC ages once on the road. A road death runs the existing death/heir rules on
the real bundle with remote kin references, retains death/inheritance news and
places the actual inherited objects in the departed reach's estate. It does not
arrive a living replacement or silently lose the heirloom. Player ageing and
succession remain outside this feature. Arrival rebuilds the planner's holding
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
hunger/tiredness signal cannot restart pathfinding from outside the map. Normal
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
