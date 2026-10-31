import { householdAccess, topController } from "game/playable";
import { householdStore } from "game/favours";
import { containerItemCount } from "game/container";
import { season } from "game/time";

export const FIELD_STATES = {
  plough_field: ["empty", "harvested", "rotten"],
  sow_field: ["ploughed"], harvest_field: ["harvestable"]
};
export function ownsField(s, actor, id) {
  const farm=s.ecs.farmable?.[id];
  return !!farm && farm.houseId==s.ecs.household?.[actor]?.houseId && householdAccess(s.ecs,actor,id);
}
export function fieldOrders(s, actor, id) {
  if(!ownsField(s,actor,id) || s.ecs.personable[actor]?.age<18)return [];
  const farm=s.ecs.farmable[id];
  const jobs=Object.entries(FIELD_STATES).filter(([,states])=>farm.slots.some(slot=>states.includes(slot.state))).map(([key])=>({key}));
  if(season(s.days)!="winter" && farm.slots.some(slot=>slot.state=="sown" && slot.tendedDay!=Math.floor(s.days)))jobs.push({key:"tend_field"});
  return jobs;
}

// Reserve room for the complete patch yield, including grain already cut and
// still in transit. Two workers cannot spend the same pantry space twice.
export function harvestFits(s, field, amount) {
  const ecs=s.ecs, house=ecs.farmable[field]?.houseId;
  if(!house)return true; // Legacy fields without a household retain their storage plans.
  const store=ecs.container?.[householdStore(s,house)];
  if(!store)return !!ecs.camp?.[house]; // Camp harvests are carried home as loose owned grain.
  let loose=0;
  for(const id of Object.keys(ecs.haulable || {})) {
    const good=ecs.good[id];
    if(good?.type!="grain")continue;
    const home=ecs.household?.[id]?.houseId || (ecs.controllable?.[id] && ecs.household?.[topController(ecs,id)]?.houseId);
    if(home==house)loose+=good.amount;
  }
  return containerItemCount(store)+loose+amount<=store.capacity;
}
