# The world map

The gameplay camera stays over the current hex. Its zoom distance stops at 6,500
world units on every screen size. Panning stays within the local hex.
The detailed map fades to black at its unexplored edge. Neighbouring hexes do
not appear in the gameplay scene.

World map opens a separate top-down SVG map. M opens or closes the same map.
The clock also opens it. You recentres the local camera and resumes follow.
The map leaves simulation speed and the calendar unchanged. Closing it unmounts
the SVG. The renderer constructs no realm mesh or realm overlay.

Each world hex uses its biome colour. A red ring marks the current hex.
A pale rim marks a hex that this person knows from their own visits.
Unknown hexes remain dim. Terrain summaries remain public.
Community names require the existing person-specific, map-specific discovery.
A successor does not inherit another person's discoveries.

Grey lines show recorded border roads. Gold lines show the remaining planned
journey. These lines do not claim a detailed route through unvisited terrain.
Select a land hex and press Plan journey. The game chooses adjacent land hops
through surveyed passes without generating detailed maps. Each hop takes one
season and starts arrival at dawn. The character walks through every hex.
The destination panel states the seasonal cost, with walking time additional.

Stop journey here ends the route in the current hex. Change course replaces the
route from the current hex. Both actions retain the existing cancellation rules.
Journey text reports the number of seasons still to travel. During a night camp,
the map also states that the character will resume at dawn.

New-game and debug previews retain the old SVG biome and weather views.
Gameplay no longer has the continuous 3D realm view, distant weather layers,
remote camera clearance, realm lighting or distant model visibility stages.
The local terrain, weather, lighting and camera follow keep their existing rules.
