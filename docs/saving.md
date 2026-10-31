# Saving and continuing a life

Tiny King keeps one save in IndexedDB in the current browser. The menu offers Continue when that slot contains a compatible save. Start new game opens character creation. Its Start game button begins the new life. Closing character creation returns to the menu and leaves the saved life available.

The game saves when a game day ends, when the page becomes hidden, and on `pagehide`. Starting a life also requests a save. Generation and asynchronous travel must finish before a pending save takes its snapshot. Character drafts and the menu never overwrite the slot.

A service worker encodes the snapshot, compresses it with `CompressionStream("gzip")`, and writes it in one IndexedDB transaction. The main thread takes the snapshot through the worker's structured clone. This copy still causes a measurable hitch for the generated world. Rendering and simulation continue during compression and storage. The service worker holds submitted writes through navigation. A returning page waits for those writes before inspecting or loading the slot. `state.persistence.lastSave` records the snapshot time, worker time, total time, size, and saved day for development measurements.

The save includes the active map, all generated and visited maps, travellers, calendar, people, relationships, knowledge, possessions, ownership, orders, and UI player identity. It also includes the simulation's partial-hour clock. The object graph format retains shared records, undefined values, and non-finite planner values. Restoring recreates browser resources and redraws from the saved game data.

The slot and compressed payload both carry format version 1. An incompatible version shows a message and offers Start new game. A failed save shows its error and preserves the previous committed slot.

Saving is asynchronous. Closing the browser process can interrupt the last save before its transaction commits. The previous committed save remains available. Browser storage removal also removes the save. Saves do not move between browsers or devices.

The service worker has its own webpack entry at `/save-worker.js`. The production worker compiles after the app, whose emit step cleans `dist`. Development hot reload is disabled because its injected client cannot share the service worker lifecycle.
