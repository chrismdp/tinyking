/* eslint-disable no-undef */
// Replays the saved day-layer worlds with an idle player. No state fixtures.
require("./research/day-with-register.cjs");
const fs = require("node:fs"), v8 = require("node:v8");
const {replaceGame} = require("../src/game/save_game");
const simulation = require("../src/game/simulation");
const {householdFood} = require("../src/game/favours");
const {name} = require("../src/game/name");
const {Hex} = require("../src/game/hex");
const {FOODS} = require("../src/game/goods");
const [seed = "13", output = "shots/day-food-before-13.json"] = process.argv.slice(2);
const s = {redraws:[]};
replaceGame(s, v8.deserialize(fs.readFileSync(`.cache/play/initial-${seed}.bin`)));
s.personName = id => s.ecs.nameable[id] ? name(s.ecs.nameable[id]) : id;
const people = () => Object.keys(s.ecs.planner).filter(id => id != s.ui.playerId && s.ecs.personable[id] && !s.ecs.personable[id].dead && (!s.residents || s.residents[id]));
const rows = [], hourly = [], slots = [], transfers = [];
const tasks = require("../src/game/tasks");
for (const key of ["pick_up_from_container", "forage", "recover_meal", "eat", "perform_subtask_in_slot"]) {
  const run = tasks[key];
  tasks[key] = function(state, id, world, dt, first, ...args) {
    if (state != s) return run(state,id,world,dt,first,...args);
    const before = JSON.stringify(s.ecs.holder[id]?.held.map(x => [x,s.ecs.good[x]]));
    const result = run(state,id,world,dt,first,...args);
    const after = JSON.stringify(s.ecs.holder[id]?.held.map(x => [x,s.ecs.good[x]]));
    if (before != after) transfers.push({day:s.days, id, task:key, args, source:world.mealSearch?.source || world.places?.[args[0]], before:JSON.parse(before || "null"), after:JSON.parse(after || "null")});
    return result;
  };
}
function snapshot() {
  const food = householdFood(s), ids = people();
  return {at:s.days, households:Object.values(s.villages).flatMap(v => v.houses.map(house => ({
    house, village:v.name, owner:s.ecs.controllable[house]?.controllerId,
    residents:ids.filter(id => s.ecs.household[id]?.houseId == house),
    food:food.get(house) || 0, store:structuredClone(s.ecs.container[s.ecs.household[house]?.storeId]),
    account:structuredClone(s.ecs.household[house]?.estateAccount),
    fields:(s.ecs.household[house]?.fields || []).map(id => ({id,...structuredClone(s.ecs.farmable[id])})),
  }))), people:ids.map(id => ({id,name:s.personName(id),hunger:s.ecs.personable[id].hunger,tiredness:s.ecs.personable[id].tiredness,
    task:s.ecs.planner[id].task,held:s.ecs.holder[id]?.held.map(x => [x,s.ecs.good[x]]),
    feeling:{...s.ecs.planner[id].world.feeling}})),
  forage:Object.values(s.ecs.forageable || {}).map(p => ({...p})),
  looseFood:Object.entries(s.ecs.good || {}).filter(([,g])=>FOODS.includes(g.type)).map(([id,g])=>({id,...g,heldBy:s.ecs.haulable[id]?.heldBy,owner:s.ecs.controllable[id]?.controllerId}))};
}
const initial = snapshot();
function sample() {
  const day = Math.floor(s.days + 1e-9) + 1, hour = Math.round((s.days % 1)*24) % 24;
  if (day > 7) return;
  const ids = people(), hungry = ids.filter(id=>s.ecs.personable[id].hunger > .9), asleep = ids.filter(id=>s.ecs.planner[id].task?.[0] == "sleep");
  hourly.push({day,hour,hungry,asleep,food:Object.fromEntries(householdFood(s))});
  if (hour == 18) {
    const row=snapshot();rows.push(row);
    console.log(JSON.stringify({seed,day,emptyHouseholds:row.households.filter(h=>h.residents.length && h.food<1).length,hungry:hungry.length}));
  }
}
const create = simulation.createSimulation;
simulation.createSimulation = (state, options = {}) => create(state,{...options,onHour(){options.onHour?.();sample();}});
const {slotChoices,playSlot} = require("../src/game/day");
// Match day-play.cjs: reveal places, without changing supplies or people.
s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.walkable).map(id=>Hex().fromPoint(s.ecs.spatial[id]));
(async () => {
  for (let i=0;i<21;i++) {
    const menu = slotChoices(s);
    const empty = menu.places.find(p=>!p.people.length && p.visit.available && !(s.space[Hex().fromPoint(s.ecs.spatial[p.id])] || []).some(id=>s.ecs.building[id] || s.ecs.meetingPlace?.[id]));
    if (!empty) throw new Error("No empty reachable place");
    const result = await playSlot(s, empty.visit, {chooseLine:()=>null});
    slots.push({day:result.day,slot:result.slot,place:empty.id,start:result.start,end:result.end,outcomes:result.outcomes});
    console.log(`seed ${seed}: day ${result.day} ${result.slot} complete`);
  }
  const daily = Array.from({length:7},(_,i)=>{
    const day=i+1, samples=hourly.filter(r=>r.day==day), evening=rows.find(r=>Math.floor(r.at+1e-9)+1==day);
    return {day,emptyHouseholds:evening.households.filter(h=>h.residents.length && h.food<1).length,
      households:evening.households.filter(h=>h.residents.length).length,
      hungry:new Set(samples.flatMap(r=>r.hungry)).size,
      peakHungry:Math.max(...samples.map(r=>r.hungry.length)),
      daytimeAsleep:new Set(samples.filter(r=>r.hour>=9 && r.hour<17).flatMap(r=>r.asleep)).size};
  });
  fs.writeFileSync(output,JSON.stringify({seed,initial,rows,hourly,slots,transfers,daily,
    kinship:s.ecs.kinship,events:s.events.filter(e=>["death","inheritance","move","household_arrival","harvest"].includes(e.type))},null,2)+"\n");
  console.log(JSON.stringify(daily));
})().catch(error=>{console.error(error);process.exitCode=1;});
