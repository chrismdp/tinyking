# The 3D realm map

The gameplay camera shows one continuous landscape. Zoom out to inspect villages,
reaches and the finite radius-five realm. Zoom back in to return to the same
local terrain. Camera inspection does not start a journey or advance the calendar.
Explicit journeys still use the existing map-edge Travel action and take one season.

Realm fits the whole realm. You restores a useful local distance and resumes
soft camera follow. You preserves the viewing direction. The current Reach
button also fits the realm. Drag or use the movement keys to pan. Use the wheel
or a two-finger pinch to zoom. Use right-drag, Q/E or a two-finger twist to rotate.
A remaining finger can continue panning after the other finger lifts.

Map layers appears at overview scale. Communities shows discovered village
names, known areas and community facts. Weather shows the existing hourly
conditions. Wind shows the existing pressure model's direction and strength.
The controls change presentation. They do not change weather or world time.
Clicking an overview reach or community selects information and never dispatches
local orders. An unexplored reach stays coarse at every zoom. Its information
explains how to visit through the existing travel system.

The current person's discoveries decide which community names and areas appear.
Discovery belongs to both a person and a map. A visited map does not reveal its
communities to a successor who does not know them. Unknown owners remain unknown.
Household owners come from the actual house controller. Recognised elders come
from the existing village-customs rule. An elder recognises customs and does not
own all village land. The realm view introduces no territorial titles or king.
Unexplored reaches expose public terrain, climate and weather summaries only.

The renderer keeps local people, known names and props at close range. At greater
distances, it removes tiny people and then props from drawing. It also stops their
rendering animations. The simulation keeps its normal tasks, needs and seasonal
updates. The overview hides the local task panel and opening hint. Clock, news,
speed and return controls remain available. Returning restores the local panel.
Distant lighting keeps terrain readable at night without changing local night or weather.

Coarse terrain uses the same land field and exact world-coordinate translations
as local maps. The active patch uses the actual graded surface and exact tile
fans. Other reaches use a triangular lattice with the actual stepped borders.
Shared edges meet the active surface. Indexed geometry reuses vertices, and each
reach can leave the draw list when it lies outside the camera view. Terrain
construction caches repeated field queries. Normal frames create no world maps,
communities or terrain meshes. Actual surface replacement refreshes active
heights and their cache. View disposal releases its owned geometry and materials.
The camera adjusts its depth range with zoom so that low coasts remain distinct
from the surrounding sea. Close views retain local clipping and terrain clearance.

The old SVG overview remains in new-game and debug seed/climate previews.
