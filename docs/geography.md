# Geography foundations

Generated maps use one surface for terrain, walking, picking, occlusion and
camera/object grounding. `createLandField(seed).elevationAt(worldPoint)` makes
relief in world coordinates. A seeded direction stretches a ridged noise field
into long belts. Slow warping bends their spines. Broad envelopes limit mountain
extent and leave lowlands between ranges. Rounded cross-sections and variations
along each crest make summits and saddles. Smaller ridges join the shoulders as
spurs. A separate slow field supplies rolling country. Coastal relief fades
towards sea level. Local maps and coarse realm meshes sample this same field.
The realm lattice has triangle edges about 312 units long. These samples retain
the broad range profiles.

Steep ground becomes mountain terrain. Gentle ground above altitude 780 becomes
exposed stone, which remains walkable. Gentle uplands can support vegetation and
settlements. Alpine rock stays grey. The existing altitude rules control snow,
freezing and the shorter growing season.

These are analytic shapes. Valleys approximate spaces between ridges. The model
does not simulate erosion, runoff, drainage networks, rivers or geological time.
The coast field remains independent of the range field. Existing lakes remain
noise-based depressions, without a river or water-balance simulation.

The conceptual starting point is Amit Patel's
[terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/),
especially ridged fields and restrained detail. This implementation uses the
project's existing noise library. It imports no generator code or assets.

## Annual moisture

`annualClimate` samples the shared terrain on a 900-unit grid aligned with a
seeded prevailing wind. The grid extends 18,000 units upwind of the realm's
sampling margin. Each row transports moisture downwind. Sea cells replenish
vapour. The carrying capacity falls exponentially with elevation. Ascent
condenses excess vapour. Descending air retains the depleted supply, so the
leeward side becomes drier. Slow moisture loss also dries continental interiors.
Nine samples spread over each reach summarise its land climate. Sea samples do
not enter the land average a second time. Entirely unsampled sea uses wet supply.

`world.hexes[].annualMoisture` stores a dimensionless annual index. The existing
wet, normal and dry categories use thresholds 0.68 and 0.42. The existing repair
then limits neighbouring climate categories to one step. Temperature and morality
retain their seeded fields. `world.prevailingWind` stores the annual direction.
`world.climate.moisture` retains the small numeric grid and its wind orientation.
No detailed maps or histories are generated for it. Normal frames never repeat
the moisture transport pass.

This follows the small wind-ordered transport idea in
[Mapgen4 rainfall](https://simblob.blogspot.com/2018/09/mapgen4-rainfall.html).
It is a climate approximation, without measured rainfall units, seasonal wind
reversals or fluid dynamics. The actual hourly pressure gradient still supplies
weather wind. Weather continues to use the regional moisture categories. Storms
do not change a biome instantly.

## Continuous habitats

`biome_field.js` samples climate in canonical world coordinates. Bilinear sampling
blends the four nearest moisture grid values. Temperature uses the existing
seeded noise and latitude field before category thresholds or neighbour repair.
The inverse of `worldPoint` supplies those original temperature coordinates.
A point has the same climate whichever reach is active.

Sea-level warmth ranges from zero to one. Altitude lowers habitat warmth by
one unit per 1,400 height units. Linear weights blend neighbouring temperature
and moisture bands into up to four named biomes. Moisture band centres are
0.25, 0.55 and 0.85. These indices are game climate values, not physical degrees
or measured rainfall. The model has no soil, runoff or seasonal moisture budget.

Generation stores each finished tile's climate and mixture. Later building pads
refresh habitat where altitude changes. Detailed and coarse ground use the same
palette at physical coordinates. Generated ground
has no regional morality tint. Tree establishment and forage density blend the
habitat profiles. Deterministic draws select individual plant types. Real trees
retain wood, clearance, ownership and the existing per-species woodland capacity.
Woodland noise also uses canonical coordinates, so its patches cross reach edges.
Regrowth uses local habitat and the existing seasonal rules. No visual forest
substitutes for resource entities.

The seasonal snowline interpolates between the existing temperature bands using
sea-level warmth. Physical altitude then decides freezing for crops, forage and
snow. Both terrain views use that climate. The active coarse surface reads actual
local snow accumulation. Remote coarse terrain uses seasonal cover because no
local weather history exists there. Precipitation near the camera uses that
point's freezing condition. Hourly pressure, wind and storms retain their rules.
Named climate categories remain supported for small legacy fixtures.

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

## Household work-yard reservations

Settlement growth adds `reserveWorkYard(state, tileId, houseId)` and `transitBlocked(state, tileId)` to `land_use.js`. Existing field APIs retain their meaning. A work-yard reservation requires unclaimed, unworn, unrouted land and stores its household in `mappable.buildingPlot`. `reserveRoad` and `canPlaceField` reject that space. Navigation permits a yard as its actual origin/destination, while excluding it from through journeys. Wear rejects private interior work endpoints just as it rejects crop work. Existing public roads, wear, altitude, climate and tree-clearance envelopes are preserved.

A field or yard reservation must preserve the public component around it.
Existing fields must retain a public access neighbour. Existing private work
areas must retain an exit. Tiles of the same property can connect internally.
`canReserveWorkYard(state, tileId, houseId)` checks these rules without mutation.
`reserveWorkYard` applies them before it records ownership. Both reject existing
roads, worn reservations, crops and occupied public places. Expansion checks
and reserves its new private tiles through this same API before it spends wood.

`path` allows connected private tiles only when their property contains the
journey's start or destination. Crop tiles remain endpoints only. `routeBlocked(state, tileId, start, goal)` shares this rule between the path
search and actual local fence detours. `transitBlocked` reports public blockers.
A detour cannot cross crop interiors or another property's private space. Continue
to call `recordRoadUse` for actual steps. It rejects private and crop work space.

`safeTile` uses the same `1e-8` numerical tolerance as `roadStep`. This accepts
roundoff at a projected limit without changing the road slope or grade limits.
Greens and wells now use actual footprint clearance, including mature crowns.
They have no artificial door corridor. Unbuilt reserved land retains woodland.
## Fences and gates

`fences.js` defines the boards and their walking clearance. `fenceFootprints(state)`
reads each enclosure from its actual `ecs.spatial` and `ecs.pasture` dimensions.
`fenceSegments(footprint)` returns the visible solid sides. Each enclosure has
an open gate on its positive-y side. The gate width defaults to 24 units.
Small yards use a narrower gate that fits their width.

`fenceRoute(state, start, end)` adds local waypoints around those boards.
Ordinary transit goes around the enclosure. If the start or endpoint is inside,
the route uses the gate. The existing tile path still controls land access,
fields and house entrances. No containing tile becomes blocked because it has a fence.
Workers, carried goods and explicit movement use the same physical walker.

The walker caches these waypoints with a signature of every enclosure position,
width, depth and gate width. A changed signature discards the cached route.
The renderer uses that same signature to rebuild the visible fence.
Future settlement growth can change `pasture.halfWidth`, `pasture.halfDepth`
and optional `pasture.gateHalfWidth`. Use `ecs.spatial[id]` for position.
The older animal `centre` field does not override the physical fence position.
An optional `ecs.fence[id]` with those dimensions reserves the same geometry
for a future fenced plot. Unfenced crop plots retain the shared field rules above.

`reserveFieldLane(state, tileIds)` reserves a real public walking approach.
It checks existing navigation links and excludes crops and private yards.
It changes no height, road route or wear. Its `mappable.fieldLane` marker keeps
later crops and private additions out. An engineered road still uses the native
slope and grade checks. Field metadata records `accessKind: "road" | "foot"`.
The field's `accessTileId` must remain reachable through native walking rules.
A crop edge does not require an engineered road where walking land is viable.

Organic settlement surveys pass `reserveHouseYards: true` to `buildGeography`.
Before optional road routes exist, the survey picks distinct walkable yard
opportunities outside fixed doors, camps and crossings. The existing route search
avoids those opportunities. It can leave an infeasible optional connection absent.
Each opportunity becomes a site's preferred `yardPoint`. The later land-use
check still decides whether that yard is actually private and accessible.
This changes no road slope, grade, earthwork limit or existing visited map.

`canReserveWorkYard` and `reserveWorkYard` also accept an array of tile IDs.
The array is one connected property parcel. Validation checks the whole parcel
before mutation, including public connectivity and existing field/work exits.
This permits a genuine property endpoint without leaving an artificial public
fragment inside its work area. Existing callers that pass one tile are unchanged.
Organic yards use actual roof and garden footprints and the existing household
land reach. Their closest reachable viable space can stand across a public lane.
House pads, public roads, crops and camps cannot become private work ground.
