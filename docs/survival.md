# Energy, food and sleep

Energy is the player's daily work budget. It runs from zero to 100.
Chatting costs no energy. Walking uses a little energy. Carrying uses more.
Chopping, gathering, construction and field work use nine energy per game hour.

Work runs at full speed above 40 energy, 80% below 40, and 50% below 20.
At zero, the player cannot start or continue physical work. The current order keeps its
progress. Eating or sleeping makes the work available again.
The HUD always shows energy, in a compact strip above the map controls.

Work and visits remain available after dark. At zero energy, the player walks
to their own fire and sits there. A journey makes camp at the traveller's current
position. The status strip shows Sitting by the fire. An unfinished order keeps
its progress. The player can eat, visit or choose Rest from the fire.
At 11pm, the player walks to bed unless in a conversation. Bedtime waits for held
attention and timed social interactions too. Rest can start sleep earlier.

## Food

Choose an Eat button to eat a particular food that you carry or own.
The player walks to that selected supply if necessary. There is no search for food.
A meal takes fifteen game minutes. Each portion has its own energy value:

| Food | Energy |
| --- | --- |
| Bread | 40 |
| Roots | 25 |
| Berries | 15 |
| Gruel | 35 |
| Grain | 35 |
| Flour | 30 |

Energy stops at 100. Grain needs no stove. Old anonymous forage remains edible
and restores 35 energy. New finds retain their roots or berries identity.
Foods use existing tastes for gift preferences. Generated people explicitly
like or dislike foods associated with those tastes. Owned portions can also
satisfy a neighbour's real food request.
Eating one portion preserves the rest of its stack.

Food comes from real goods:

- Harvest favours split a gleaning share from the real crop, at least one grain.
- Fuel favours can earn a thank-you meal from the giver's surplus larder.
- An owned field produces grain that the player harvests and carries home.
- Forage orders gather wild food and carry it home.
- Existing gifts and household access retain their ownership rules.

A thank-you meal takes one portion from a household with more than two meals per
resident plus one spare portion. It is granted once. A food request never gives
food back as a reward. Borrowed harvest cargo cannot feed the player.

Sowing costs one grain per patch. A crop needs 10.5 growing days, or one and a half
seasons. Each patch yields six grain. Harvested patches need new seed.
Ordinary harvests need room for a whole patch in the household store.
Accepted harvest favours can leave household-owned grain beside a full pantry.

## Sleep

Choose Rest to walk home and sleep. A bed restores 12.5 energy per hour.
A camp bedroll or rough ground restores eight energy per hour.
Daytime sleep lasts at least six hours. Sleep at night continues until dawn, even after a late bedtime. The screen fades to dark while the simulation runs through the night in small steps. Hourly needs, weather, visits and festivals keep their normal rules. At dawn the screen returns with a short morning line. Staying awake keeps normal speed. Pause stops time, including during sleep. Space toggles Pause and Normal.
Sleeping late reduces the recovery ceiling by seven energy per hour after 10pm,
with a minimum ceiling of 55. Missing a second night causes collapse and a
55-energy ceiling. Sleep reduces tiredness too.

The player has no hunger stages, starvation, Find food order, automatic meal
search. Automatic bedtime starts at 11pm unless a conversation holds attention. Old saves convert hunger once to energy with
`clamp(100 - hunger * 40, 0, 100)`. Active old meal searches and Find food orders
are removed. The person's possessions, relationships and real supplies persist.

## Household larders

Villagers still eat real food from their accessible supplies and sleep at home.
Empty larders produce food requests. Ripe fields produce harvest requests.
Fuel requests retain their real oven and forge needs. Villagers cannot die from
starvation. Ageing, old-age deaths, inheritance and grief remain.

## Woodland and wild food

Crops, forage and saplings pause in winter. Remaining wild roots can still be
collected. Wild finds are small and occasional, at 15% of the earlier plant density.
Each plant yields one portion. The first camp retains three reachable finds.
Trees seed near existing woods, within each biome's original density cap.
A fully cleared wood cannot seed itself.

Saplings become young after seven growing days and mature after fourteen.
Young trees yield one log. Mature trees yield their normal two or three logs.
Saplings yield none. Forage replacement times use each biome's former rate,
multiplied by 7/3. Daily tree seeding rates use the former rate multiplied by 3/7.
This preserves regrowth per season with seven days in each season.

The focused implementation and browser evidence lives in
`shots/core-loop-report.md` in the builder's worktree. Earlier survival reports
describe the old design and are not current gameplay instructions.
