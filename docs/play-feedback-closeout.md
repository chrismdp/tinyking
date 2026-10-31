# Live play feedback closeout

Person sheets use the current actor's existing known-name rule. Selecting a stranger does not introduce them. Unknown sheets keep Chat, gift and help controls. They hide names, household names and village details. Unknown family-tree subjects use anonymous node IDs. Actual conversations and disclosed family news still reveal identities through the existing knowledge records.

Gift orders approach within ten world units. Each handoff tick checks distance, building occupancy and visible fence boards before it transfers the actual item. Chat and Ask keep their separate speech positions. NPC conversations keep their existing spacing.

Overhead names and activities stack along the camera's screen-up direction. Both retain a minimum readable size at local zoom. Names keep priority over activities in crowds. Roof checks and normal activity filtering remain active. Opening guidance sits below the clock and leaves room for phone encounter sheets.

Run the bounded gift check with:

```sh
PLAYTEST_OUT=shots/closeout/gift npm run playtest -- http://localhost:8126/ 60 --gift-only
```

This mode gathers real wood, uses the gift chooser and shares the original receipt assertion with the full playtest. The distance assertion remains `<= 10`.

Run the blocked story continuation with:

```sh
npm run storyboard -- http://localhost:8126/ shots/closeout/story --closeout
```

This mode chooses the legal camp site nearest the earned friend's household. It adds real Find food and Rest orders before the third Chat and Build. It records the helper's eligibility, needs, queue and approach. All original delivery, consent, helper-work and family-control assertions remain. It skips the unrelated 24-hour observation. It changes no friendship or needs balance.
