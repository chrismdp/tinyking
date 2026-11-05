import { householdMembers } from "game/population_index";
import { isResident, homeState, personComponent } from "game/residents";
import { householdAccess } from "game/playable";
import { closeFamily, relatedPeople } from "game/social_kin";
import { householdFood } from "game/favours";

export const foodHouse = (s, source) => s.ecs.interior?.[source]?.buildingId ||
  Object.keys(s.ecs.household || {}).find(house => s.ecs.household[house].storeId == source);
const residents = (s, house) => householdMembers(s, house).filter(id => isResident(s,id) && !s.ecs.personable[id]?.dead);

// Food permission does not grant another home's fields, beds or working access.
// A vacant estate feeds its owner's household. Occupied homes keep two meals
// each before sharing with the owner's household or the residents' close kin.
export function mealAccess(s, actor, source) {
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
  if (!beneficiaries.length || (householdFood(s).get(house) || 0) <= beneficiaries.length*2) return false;
  return owned || family.some(id => closeFamily(s,id).some(kin => beneficiaries.includes(kin)) ||
    beneficiaries.some(kin => relatedPeople(s,id,kin)));
}
