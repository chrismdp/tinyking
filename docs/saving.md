# Saving and continuing a life

Tiny King keeps one save in IndexedDB in the current browser. The menu offers Continue when that slot contains a compatible save. Start new game opens character creation. Its Start game button begins the new life. Closing character creation returns to the menu and leaves the saved life available.

The game saves when a game day ends, when the page becomes hidden, and on `pagehide`. Starting a life requests its first automatic save. This save waits until the opening finishes, then waits another 30 real seconds. Page-hidden and pagehide saves bypass this delay, including during the opening. Generation and asynchronous travel must finish before a pending save takes its snapshot. Character drafts and the menu never overwrite the slot.

A service worker streams the version-1 object graph in bounded chunks for legacy saves. It compresses detailed hex records with `CompressionStream("gzip")` and writes them in one IndexedDB transaction. New worlds use one detailed record per
hex and a world manifest in native IndexedDB object storage. The manifest points to the committed hex versions. The main thread takes the snapshot through the worker's structured clone. This copy still causes a measurable hitch for the generated world. Rendering and simulation continue during compression and storage. The service worker holds submitted writes through navigation. A returning page waits for those writes before inspecting or loading the slot. `state.persistence.lastSave` records the snapshot time, worker time, total time, size, and saved day for development measurements.

The save includes the active map, saved away hex records, compact communities, travellers, calendar, people, relationships, knowledge, possessions, ownership, orders, and UI player identity. It also includes the simulation's partial-hour clock. The object graph format retains shared records, undefined values, and non-finite planner values. Repeated generated journeys share read-only route snapshots. Each journey keeps its own people, dates, counts and road-wear effects. Restoring recreates browser resources and redraws from the saved game data.

The slot and compressed payload both carry format version 1. An incompatible version shows a message and offers Start new game. A failed save shows its error and preserves the previous committed slot.

Saving is asynchronous. Closing the browser process can interrupt the last save before its transaction commits. The previous committed save remains available. Browser storage removal also removes the save. Saves do not move between browsers or devices.

The service worker has its own webpack entry at `/save-worker.js`. The production worker compiles after the app, whose emit step cleans `dist`. Development hot reload is disabled because its injected client cannot share the service worker lifecycle.


A planned journey saves its remaining hops, active Travel order and temporary
night camp. Continuing resumes the current local walk without replaying a hop.
The save format remains version 1. Older saves without a planned route retain
their existing single-hop Travel orders.

New worlds evict detailed away maps after their departure checkpoint commits.
The world manifest retains compact people and household records for seasonal
updates. The worker compares a SHA-256 digest of each submitted detailed hex
with its saved record. It writes a new hex version only when that state changes.
A routine save submits the active hex. A hop also submits the departed hex.
The worker commits these records and the manifest together, then removes old
versions that the manifest no longer references. Hex records use gzip.
The manifest uses IndexedDB's native object storage. This retains shared records,
undefined values and non-finite planner numbers without another JSON graph.
The worker reports compressed hex bytes separately. The native manifest size
is not included in that count.

A hop renders the arrival before it submits the checkpoint. The departed
details stay in memory until the transaction commits. A close before the
scheduled submission sends the checkpoint immediately. The worker holds a
submitted write through navigation, and Continue waits for that write.
If the browser process stops before the commit, the previous committed save
remains available. Neither committed snapshot repeats the transfer or contains
two resident copies of the traveller.

The IndexedDB database and public payload version remain 1. The new world slot
uses internal format 2 to identify a manifest and separate hex records.
The reader also accepts the earlier single-record save. An old save keeps its
existing history model and receives no replacement population.

Completed neighbour detail uses separate hex records too. The manifest retains
compact communities and the remaining preparation queue. It also retains the
compact historical inputs for construction. These inputs contain no terrain,
roads, trees, crops or animal simulation.

If a save occurs during a neighbour build, it contains no unfinished map. Reload
resumes missing work from the active hex and the committed record pointers. A
completed preparation leaves memory after its record commits. A failed save keeps
that map available for another save. Hexes beyond the player's approaches need
no detailed record.
