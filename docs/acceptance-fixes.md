# Frozen acceptance reruns

The application stays frozen during browser acceptance. Compile its development artifact once so the drivers can read `window.tinyking`. Reuse the candidate's production build and application tests when only scripts or documentation change.

From the private worktree, compile under one of the two shared heavy slots:

```sh
flock -w 7200 /tmp/27agents-gate-2.lock npx webpack --config webpack.dev.js --output-path "$PWD/shots/frozen-dev"
```

Serve that artifact on the worker's assigned port. This server binds only localhost and runs without a watcher. Save its PID. After acceptance, stop only that verified owned process.

```sh
python3 scripts/serve-frozen.py shots/frozen-dev --port 8123 > shots/frozen-server.log 2>&1 &
echo $! > shots/frozen-server.pid
```

The server returns the application entry for `/` and `/debug/worldgen`. It preserves 404 responses for missing assets. Run compilation and browsers in detached wrappers. Make the wrappers wait for actual children and save their exit status. The idle server holds no heavy slot.

Run only the affected acceptance scenarios under a shared heavy slot:

```sh
PLAYTEST_OUT=shots/construction-rerun flock -w 7200 /tmp/27agents-gate.lock npm run playtest -- http://localhost:8123/ 60 --acceptance-fixes
flock -w 7200 /tmp/27agents-gate.lock npm run storyboard -- http://localhost:8123/ shots/storyboard-rerun
```

The targeted mechanical entry replays seed 13's later construction conditions. Real popup orders reserve field tile 1340 and stockpile tile 1311. They also move towards tile 1368 and chop tree 1679. Simulation advances to day 2.915. This setup repeats the relevant reservations and elapsed time. It does not repeat the passed mechanical observations. It then requires popup placement, four delivered logs, a completed shelter, the debug deep link and no browser errors. Missing placement fails the run.

Shelter selection uses `canPlaceShelter` from the frozen application on a read-only snapshot. This includes camp-relative hex range, ownership, pad feasibility, clearance, path access and current reservations. Trees on a candidate tile do not automatically disqualify it. The live popup must still offer Build shelter. A populated popup that lacks an action is rejected promptly.

The storyboard repeats necessary setup because friendship and delivered building materials must come from real conversations and work. Assisted read-only selection chooses the nearest generated adult fuel requester with `love` disposition towards the player. That disposition starts a real meeting at 16 goodwill. Two consenting Chats and the real +12 fuel favour can cross the 30-goodwill Personal threshold despite ordinary drift. A third consenting Chat at four delivered logs refreshes contact before the small funded build. The driver never assumes that every requester, or any three Chats, earns friendship.

Selection changes no live state. All conversations, favour acceptance, timber gathering, delivery and helper decisions use normal UI commands or simulation. Global Pause records actual boundaries. Assertions require the helper to walk, stand beside the frame and contribute positive work. The helper must keep their controller and home. Their relationship towards the player must reach Personal trust. Later news, family and phone controls remain part of the same story. Phone speed controls use actual CDP touch events at 390×664.

Keep each old failed attempt with its original log and screenshots. A corrected rerun supplies new evidence and does not rewrite the old result. Retain passing observations whose application source stays unchanged.
