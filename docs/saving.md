# Saving and continuing a life

Tiny King keeps one save in IndexedDB in the current browser. The menu offers Continue when that slot contains a compatible save. Start new game opens character creation. Its Start game button begins the new life. Closing character creation returns to the menu and leaves the saved life available.

The game saves when a game day ends, when the page becomes hidden, and on `pagehide`. Starting a life requests its first automatic save. This save waits until the opening finishes, then waits another 30 real seconds. Page-hidden and pagehide saves bypass this delay, including during the opening. Generation and asynchronous travel must finish before a pending save takes its snapshot. Character drafts and the menu never overwrite the slot.

A service worker encodes the snapshot in bounded chunks, compresses it with `CompressionStream("gzip")`, and writes it in one IndexedDB transaction. The worker streams the existing version-1 object graph. It does not build a complete encoded graph or JSON string before compression. It releases consumed snapshot references as the stream advances. The main thread takes the snapshot through the worker's structured clone. This copy still causes a measurable hitch for the generated world. Rendering and simulation continue during compression and storage. The service worker holds submitted writes through navigation. A returning page waits for those writes before inspecting or loading the slot. `state.persistence.lastSave` records the snapshot time, worker time, total time, size, and saved day for development measurements.

The save includes the active map, all generated and visited maps, travellers, calendar, people, relationships, knowledge, possessions, ownership, orders, and UI player identity. It also includes the simulation's partial-hour clock. The object graph format retains shared records, undefined values, and non-finite planner values. Repeated generated journeys share read-only route snapshots. Each journey keeps its own people, dates, counts and road-wear effects. Restoring recreates browser resources and redraws from the saved game data.

The slot and compressed payload both carry format version 1. An incompatible version shows a message and offers Start new game. A failed save shows its error and preserves the previous committed slot.

Saving is asynchronous. Closing the browser process can interrupt the last save before its transaction commits. The previous committed save remains available. Browser storage removal also removes the save. Saves do not move between browsers or devices.

The service worker has its own webpack entry at `/save-worker.js`. The production worker compiles after the app, whose emit step cleans `dist`. Development hot reload is disabled because its injected client cannot share the service worker lifecycle.


A planned journey saves its remaining hops, active Travel order and temporary
night camp. Continuing resumes the current local walk without replaying a hop.
The save format remains version 1. Older saves without a planned route retain
their existing single-hop Travel orders.

Away maps still remain in memory. Storage by hex and eviction are unfinished.
The worker saves every retained snapshot with the active map and journey in one
transaction. This preserves the existing complete-save behaviour during travel.
