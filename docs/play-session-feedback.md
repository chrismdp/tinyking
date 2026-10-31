# People, camera and opening guidance

Known visible people have a separate name label. `displayName(state, id)` still
checks the current actor's knowledge. Inspecting a stranger grants no identity,
conversation, impression or control. Name labels remain when activity labels
need space. Local views keep each name label at least 20 screen pixels high, with 13-unit type.
A person inside a home has no label through its roof. Two body samples also
check real opaque roofs before the renderer shows a name or activity label.

`headActivity` filters travel, waits and idle planner states above heads.
`currentActivity` keeps route and blocked-material detail for panels. Debug
retains the task name. The controlled person's outer gold ring and `You` label
remain distinct from the selected person's marker.

The camera reads `ui.playerId` each frame. `resumeFollow()` resumes its soft
screen box. `recenter()` also brings the actor towards the usable screen centre.
Panning or inspecting another person suspends follow until an explicit movement command, selection of the
controlled person, or the accessible Recenter on you button. Orbit and zoom keep
their existing controls. Panel bounds and terrain height affect the screen box.
One finger pans the canvas. Two fingers pan, pinch and twist together. Lifting
one finger continues the pan and cannot select an entity. Panels retain scrolling.

`locomotion.js` exports `LOCOMOTION_RATIO = 0.8` and `HUMAN_SPEED = 16`.
The latter measures hex sides per game hour. All ordinary physical walkers,
child play and map exits use it. Work, needs, the calendar and camera rates stay
independent. The arrival cinematic still uses its existing 5.2 wall-clock seconds.
Social trip estimates and task walking estimates use the reduced rate too.

`conversationPositions` assigns each NPC a stable point 30 units from the shared
conversation centre. Timed speech still requires real contact and goodwill rules.
Explicit player speech approaches a separate point 45 units from its partner.
The player speech reach is 70 units, below the existing NPC contact reach of 85.
A distant, interrupted or invalid interaction grants no conversation knowledge.

`home.js` checks actual resident identity, household, building and position.
Generated buildings and completed `shelter.stage == "house"` homes share this treatment.
Night downtime replaces outdoor idle from 21:00 to 06:00. Real needs and jobs
retain precedence. NPCs walk through the existing house approach before entering.
The controlled person never receives this autonomous home routine. Dead, moved
or departed residents lose stale occupancy. `occupiedHomes(state)` returns only
valid occupied homes at night. The renderer uses cheap warm window materials.
It adds no individual house lights and invents no occupants from the clock.

`guidanceState(state, key)` stores `{seen, dismissed}` by the current actor and
a small guidance key. `dismissGuidance(state, key)` ends that hint. These helpers
can support future optional family milestones without adding a goal engine.
`openingGuidance(state)` reads completed spoken contact and `visibleFavours`.
It offers a first Chat, then a genuine learned request when one exists. Completed
help, dismissal, a brief contact hint or the first day's end closes the opening.
Requests, rewards and social outcomes still come from their existing systems.
