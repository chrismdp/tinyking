# Energy, food and sleep

Energy is the player's daily work budget. It runs from zero to 100.
Chatting costs no energy. Walking uses a little energy. Carrying uses more.
Chopping, gathering, construction and field work use nine energy per game hour.

Work runs at full speed above 40 energy, 80% below 40, and 50% below 20.
At zero, the player cannot start or continue physical work. The queue keeps its
progress. Eating or sleeping makes the work available again.
The HUD always shows energy, including when the task list is collapsed.

At 6pm, darkness stops physical work. The player walks to their own home or camp.
Work resumes after dawn, at 6am. The player can still chat and visit in the evening.
Returning home happens once each evening. It does not cancel later visits.

## Food

Choose an Eat button to eat a particular food that you carry or own.
The player walks to that selected supply if necessary. There is no search for food.
One portion restores 35 energy, up to 100. A meal takes fifteen game minutes.
Grain, gruel, forage, bread and flour are edible. Grain needs no stove.
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
Sleep lasts at least six hours and continues through the night.
Sleeping late reduces the recovery ceiling by seven energy per hour after 10pm,
with a minimum ceiling of 55. Missing a second night causes collapse and a
55-energy ceiling. Sleep reduces tiredness too.

The player has no hunger stages, starvation, Find food order, automatic meal
search or automatic bedtime. Old saves convert hunger once to energy with
`clamp(100 - hunger * 40, 0, 100)`. Active old meal searches and Find food orders
are removed. The person's possessions, relationships and real supplies persist.

## Household larders

Villagers still eat real food from their accessible supplies and sleep at home.
Empty larders produce food requests. Ripe fields produce harvest requests.
Fuel requests retain their real oven and forge needs. Villagers cannot die from
starvation. Ageing, old-age deaths, inheritance and grief remain.

## Woodland and wild food

Crops, forage and saplings pause in winter. Remaining wild roots can still be
collected. The first camp retains reachable public forage.
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
