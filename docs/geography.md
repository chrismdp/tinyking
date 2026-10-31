# Geography foundations

Generated maps use one surface for terrain, walking, picking, occlusion and
camera/object grounding. `createLandField(seed).elevationAt(worldPoint)` makes
broad relief in world coordinates. Slow upland relief carries smaller ridges and
valleys. Coastal relief fades towards sea level. Steep ground becomes mountain
terrain. Gentle ground above altitude 780 becomes exposed stone, which remains
walkable. Gentle uplands can support vegetation and settlements.

`buildGeography(grid, landscape, settlements, entrances, anchors)` connects
actual front-door approaches, camps and entrances through land. A least-cost
search prefers lower elevations and smaller changes in elevation. It does not
cross water or reserved crop plots. Road triangles have at most 0.55 slope.
Their actual centre-to-edge walking segments have at most 0.24 rise/run.
Shared corner constraints limit road cut and fill to 55 units from natural ground.
Infeasible connections stay absent. Steep unoccupied ground retains its natural shape.
House pads use the local mean altitude and at most 35 units of cut or fill.
Pads extend to the house hex corners, then blend out over 180 units.
Village sites require gentle local ground on the main walkable land component.
A trial pad must preserve walking on the surrounding naturally gentle ground.
The finished shared surface must preserve this apron after road grading too. These
values concern geometry, not population, history, expansion or region counts.

Boundary corners retain the shared natural height. Pads cannot lower them.
The previous global minimum of cutting cones lowered distant ridges while
preserving those boundary corners. This created tall repeated triangular fins.
The bounded corrections now affect only occupied corners and their local blend.
Terrain, picking, walking, object grounding and snow keep the same hex triangles.

Player shelter placement tests the same bounded surface before creating a site.
It rejects steep pads, blocked approaches and changes that invalidate existing walking access.
Successful placement updates shared heights and physical tile altitude.
The renderer refreshes terrain, picking and grounded objects from that surface.
Legacy simulation fixtures without geography retain their previous height bands.
Rejected generated houses can use another eligible site within their original hamlet.
Every alternative consumes an unused site or door approach. Optional roads never trigger global retries.
Road reservation also checks actual hex slopes and centre-to-edge grades before writing any segment.
Initial arrivals select a two-ring grassland camp on the finished walkable surface,
with a reachable nearby community. This does not move explicit travel entrances.

`map.geography = { version: 1, heights, routes }` stores shared-corner heights
(keyed by rounded world-in-map x,y to 0.001) and local tile chains.
`groundForState(state)` reconstructs the exact hex-triangle surface, including
flat sea. Renderer terrain bounds include all vertices. The same function is
used during generation and by the renderer. Legacy small test fixtures without
geography still use the previous per-terrain height bands.

## Shared routes without generating neighbours

`routeCrossing(world, side, field?)` returns null for ocean, world rim or a
border with no connected dry crossing. Otherwise it returns:

- `key`: canonical unordered pair of world coordinates;
- `crossing`: physical midpoint of the two adjoining border tiles, in world coordinates;
- `hexes`: local edge, middle and camp tiles;
- `facingHexes`: those same roles in the neighbouring region.

The unordered pair is sorted, then **both callers enumerate the same adjoining
tile pairs on the same shared lattice**. A terrain-only flood survey identifies
each region's largest dry component. Each candidate must reach a dry two-ring
camp patch on both sides. Both edge tiles must have a safe natural slope. Rank is elevation at the crossing times 5 plus distance
from the shared edge's midpoint times 0.12; physical coordinates break ties.
There is no random draw or generation-order input. Surveys read only the two
terrain grids: no ECS maps, families, history, resources or elapsed seasons.
They are cached on the land field; unvisited maps remain absent from travel.maps.
A real isolated island is not connected by terraforming sea.

`sharedEntrances(landscape, world)` materialises this contract on a visited map.
The existing travel/return system uses these exact edge/camp entities. NPC trip
choices also require an existing local entrance. Roads draw through
`mappable.route` (a set of tile sides) using the existing dirt-track geometry.
`walkable.worn` starts empty and retains the existing live walking behaviour.
The terrain survey reserves topology without claiming journeys.
`docs/settlements.md` describes the seasonal construction and actual journey
records that now earn historical wear. The border contract remains unchanged.

## Building and tree clearance

Call `reserveBuildingClearance(state, buildingId, footprint?)` **after real
placement and ownership validation**. It derives a rotated roof footprint and
body-width door approach from the generated house, player shelter, alehouse,
chapel or workshop. An optional explicit footprint allows the later growth
feature to reserve its actual expanded geometry. Its schema is
`{x,y,halfWidth,halfDepth,angle,door:{halfWidth,from,to}}`; angle follows the
renderer's rotation about the vertical axis. Do not pass an unrelated resource
clearing area. The API is keyed by the real building entity and returns removed
tree IDs. Calling it again replaces the reservation and is idempotent.

Clearance tests a circle against the rotated footprint and door corridor. The
48-unit circle bounds every mature rendered crown, including maximum storm
sway. Saplings reserve that eventual mature size. The API searches nearby hexes,
removes all standing-tree ECS/space/render records, and creates **no logs**.
Loose logs remain untouched. Another owner's standing trees make placement
invalid (`canClearForBuilding`); player sites cannot consume village plots,
buildings, farms, camps or stockpiles. A player can have only the existing one
shelter and its upgrades. Regrowth calls `treeAllowed(state, point)` before
planting, using actual entity reservations, so future crowns cannot intrude.
Deleting the building removes its exclusion; upgrades replace it. Trees outside
the footprint/approach envelope remain.

The development URL `/?seed=13&geography=mountain-pass` labels a deterministic
initial fixture for independent acceptance. Its continuous Gaussian ridge has a
low saddle. Normal generation does not use this profile. The fixture changes
initial geography only. It does not grant materials or set movement outcomes.
The test walks a real planner actor across the ridge and checks a generated
fixture's arrival and cross-pass navigation. Independent acceptance must still
perform browser movement, outward/return travel and construction through the UI.
`scripts/geography-feedback.js` captures an ordinary seed-13 preview with discovery
revealed. Its records explicitly exclude gameplay outcome claims.

## Highland seasons

`climate.js` shares the freezing condition for snow, crops and forage. It uses
physical tile altitude and the existing twelve-day year. The snowline rises in
summer and falls in winter. Alpine valleys freeze earlier and thaw later than
lowlands with the same regional temperature. High peaks can retain snow after
the valley thaws. Snow accumulation still needs precipitation after the initial
seasonal cover. Warm ground melts its snow. Exposed mountain rock stays neutral
grey beneath that cover.

`updateEnvironment(state)` applies one real hour of crop, ecology and weather
updates. `environmentUpdatedAt` records the last applied hour on the shared
calendar. `advanceEnvironment(state, end)` applies missing hours to an offscreen
snapshot. Travel uses this after its existing social season step. It does not
add another ageing step or travel season. The normal tile information explains
frozen highlands and the shorter growing season. The crop panel reports paused
growth.

## Crop plots and public access

`land_use.js` provides `canPlaceField`, `reserveFieldPlot` and `reserveRoad`.
Call `reserveFieldPlot(state, tileId)` before adding a real field. It rejects
roads, worn tracks, occupied sites and places that close public access. It also
keeps an access neighbour for existing fields. Generated gardens and fields use
this rule. `reserveRoad(state, tileIds)` rejects crop plots before writing any
road segments. Future settlement construction can use these same functions.

The planner excludes crop tiles inside a route. It permits a crop tile as the
start or destination, so workers can reach and leave their actual slots. Field
work does not create transit wear. The field-designation walk uses
`{plotAccess:true}` to keep its new work endpoint free of transit wear. `landUseRevision` changes when a plot is
reserved. An active walker then replans its cached route before moving again.
Ownership, seed consumption and harvest delivery retain their existing rules.

## Refinement preview and acceptance setup

Run the development server on the assigned port. Open `/?seed=13&intro=skip`.
This uses the normal generator. It does not replace the geography or calendar.
`scripts/geography-refinement.js <url> <outdir>` reveals discovery and focuses
the same peak, house and family field. It selects labelled clear-weather
lighting. The yellow overlay follows the actual
planner result. It is a preview of the planned route, not a completed journey.

The development build exposes `window.tinykingGeography`. It provides `Hex`,
`path`, `walk_to`, `updateEnvironment`, `advanceEnvironment`, `growingAt`,
`frozenAt` and the three reservation functions. The game state remains
`window.tinyking`. The preview record supplies exact entity IDs and framing.
For shoulder-season acceptance, label the initial season and altitude fixture.
Advance real hours with `updateEnvironment`, or use the running simulation.
The shared-calendar regression uses altitudes 20, 460 and 1100 at day 12, with
rain as its labelled weather fixture. Real updates establish snow, thaw and crop
progress. The existing mountain-pass URL remains available for pass acceptance.

## Road wear

`time.js` exports `DAYS_IN_YEAR` from the existing season length and season list.
`road_wear.js` uses twice this value for full wear to fade. Each tile records
`wearUpdatedAt`. Repeated updates at the same day do not apply decay again.
`recordRoadUse(state, tileId, entrance, exit, amount=1)` records actual traffic.
It replenishes that track and rejects crop plots. The settlement history calls this function with recorded journey dates and
counts. The terrain survey itself claims no traffic.

Fixed route sides remain physical reservations and connections. Their separate
`routeWear` starts as a fresh constructed surface and then fades. The renderer
uses this value rather than drawing fixed routes at full opacity forever.
Actual tracks retain `trackReserved` after their visible wear fades. This keeps
field placement separate from appearance. Dirty tiles redraw only when wear
crosses a visible opacity step, or when footsteps add wear. Offscreen catch-up
uses the same hourly environment update and preserves tile timestamps. Map
activation does not reset them. The development API also exposes
`updateRoadWear` and `recordRoadUse` for a small elapsed-time acceptance setup.


## Settlement growth integration

Settlement sites retain the supplied bounded pads and door approaches. New
household fields call `reserveFieldPlot` and reserve a reachable lane beside the
plot. Historical use calls `recordRoadUse` through the journey ledger. Its initial
wear cursor starts before prehistory, so abandoned historical tracks also fade.
No activation call resets that cursor. Main-route roles come from actual
inter-village or border journeys, excluding the door endpoints. They affect the
grey colour. Other tracks retain brown. Both use the same fading wear.

Growth passes an explicit expanded footprint to `reserveBuildingClearance`.
Rear wings preserve the original door and its corridor. Their actual rendered
roof bounds stay within the reservation. Field, road, ownership and existing
building conflicts prevent expansion. Future trees use the same persisted
reservation. Terrain and shared crossing API signatures remain unchanged.
