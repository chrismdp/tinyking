import { householdMembers } from "game/population_index";
import { isResident, homeState, personComponent } from "game/residents";
import { householdAccess } from "game/playable";
import { closeFamily, relatedPeople } from "game/social_kin";
import { householdFood } from "game/favours";
import { isAdult } from "game/life_stages";
import { hour_of_day } from "game/time";
import { FOODS } from "game/goods";
import { canReachTask } from "game/manager";
import { containerHasSpace } from "game/container";

export const foodHouse = (s, source) => s.ecs.interior?.[source]?.buildingId ||
  Object.keys(s.ecs.household || {}).find(house => s.ecs.household[house].storeId == source);
const residents = (s, house) => householdMembers(s, house).filter(id => isResident(s,id) && !s.ecs.personable[id]?.dead);

// Food permission does not grant another home's fields, beds or working access.
// A vacant estate feeds its owner's household. Occupied homes keep two meals
// each before sharing with the owner's household or the residents' close kin.
export function mealAccess(s, actor, source, food) {
  const e=s.ecs;
  if (!e.controllable?.[source]) return false;
  if (householdAccess(e,actor,source)) return true;
  if (!e.container?.[source]) return false;
  const house=foodHouse(s,source);
  if (!house) return false;
  const home=e.household?.[actor]?.houseId;
  const family=home ? residents(s,home) : [actor];
  const members=residents(s,house), owner=e.controllable[house]?.controllerId;
  const owned=family.includes(owner);
  if (!members.length && owned) return true;
  // An inherited larder can still feed the heir's children after they move.
  const ownerHome=personComponent(s,"household",owner)?.houseId;
  const beneficiaries=members.length ? members : ownerHome ? residents(homeState(s,owner),ownerHome) : [];
  if (!beneficiaries.length || ((food || householdFood(s)).get(house) || 0) <= beneficiaries.length*2) return false;
  return owned || family.some(id => closeFamily(s,id).some(kin => beneficiaries.includes(kin)) ||
    beneficiaries.some(kin => relatedPeople(s,id,kin)));
}

// Keep two meals each and one shareable portion, as in the existing surplus
// rule. Available adults collect real food through the ordinary carrying plan.
export function updateHouseholdFood(s) {
  const e=s.ecs;
  if (!e.personable?.[s.ui?.playerId]) return;
  const food=householdFood(s), hour=hour_of_day(s.days);
  for (const [house,h] of Object.entries(e.household || {})) {
    if (!h.storeId || !e.container?.[h.storeId]) continue;
    const members=residents(s,house), workers=members.filter(id=>id!=s.ui.playerId && isAdult(e.personable[id].age) && e.planner?.[id]);
    for (const id of workers) delete e.planner[id].world.foodForHome;
    if (hour<6 || hour>=18 || !containerHasSpace(e.container[h.storeId]) || (food.get(house) || 0)>=members.length*2+1) continue;
    for(const worker of workers.sort()) {
      if (!e.spatial[worker]) continue;
      const point=e.spatial[worker];
      const sources=Object.keys(e.container).filter(id=>e.spatial[id] && foodHouse(s,id)!=house && FOODS.some(type=>e.container[id].amounts[type]>=1) && mealAccess(s,worker,id,food));
      sources.sort((a,b)=>Math.hypot(e.spatial[a].x-point.x,e.spatial[a].y-point.y)-Math.hypot(e.spatial[b].x-point.x,e.spatial[b].y-point.y));
      const source=sources.find(id=>canReachTask(s,worker,id));
      if (source) e.planner[worker].world.foodForHome={source,type:FOODS.find(type=>e.container[source].amounts[type]>=1)};
    }
  }
}
