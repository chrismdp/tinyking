import { canCourt, eligiblePartner, marry, chatTogether, moveHouse } from "game/social";
import { addGoodwill, disposition, spendPatience, beginInteraction, completeConversation } from "game/people";
import { isResident, entityId } from "game/residents";
import { Hex } from "game/hex";
import { closeFamily, recordEvent } from "game/events";

export const canMarryPlayer = (s,a,b) => canCourt(s,a,b,true);
export function marriageReason(s,a,b) {
  if (!eligiblePartner(s,a,b,true)) return "Marriage needs living unmarried adults who are not close kin.";
  if (!canMarryPlayer(s,a,b)) return "Marriage needs both of you to consider each other a closest friend.";
  return null;
}
export function familyConversation(s,a,b,key) {
  if (key == "play") {
    if (s.ecs.personable[a].age >= 18 || s.ecs.personable[b].age >= 18) return {ok:false,message:"Choose another child to play together."};
    if (!spendPatience(s,a,b)) return {ok:false,message:"They have had enough of talking for today."};
    beginInteraction(s,a,b);chatTogether(s,a,b);completeConversation(s,a,b);
    return {ok:true,message:"You played together."};
  }
  if(key=="invite_home") {
    const house=s.ecs.household?.[a]?.houseId;
    if(!canInviteHome(s,a,b) || !householdRoom(s,house,b))return {ok:false,message:"A willing adult friend and room in your own house are needed."};
    if(!spendPatience(s,a,b))return {ok:false,message:"They have had enough of talking for today."};
    beginInteraction(s,a,b);completeConversation(s,a,b);moveHouse(s,b,house);
    recordEvent(s,"household_join",[b,a],[],{houseId:house});
    return {ok:true,message:"Your friend agreed to join your household. Their belongings remain theirs."};
  }
  const reason = key == "marry" ? marriageReason(s,a,b) : !eligiblePartner(s,a,b,true) ? "Courtship needs living unmarried adults who are not close kin." :
    disposition(s,a,b) == "hate" || disposition(s,b,a) == "hate" ? "One of you does not want to court." : null;
  if (reason) return {ok:false,message:reason};
  if (!spendPatience(s,a,b)) return {ok:false,message:"They have had enough of talking for today."};
  if (key == "court") {
    beginInteraction(s,a,b);chatTogether(s,a,b);completeConversation(s,a,b);
    return {ok:true,message:"You spent time courting. Your feelings grow at their own pace."};
  }
  // Snapshot the original families before the new spouse links join them.
  const families = [[a,closeFamily(s,b)],[b,closeFamily(s,a)]];
  const planner=s.ecs.planner[a],task=planner?.task,plan=planner?.plan,currentJob=planner?.world.currentJob;
  if (!marry(s,a,b,false,true)) return {ok:false,message:"There is no family home with room for you both yet."};
  // A household move clears stale plans. Preserve only this finishing deliberate
  // visit so the normal release-attention/complete-job tail can run once.
  if(planner?.world.ordered) {planner.task=task;planner.plan=plan;planner.world.currentJob=currentJob;delete planner.world.moveHome;}
  beginInteraction(s,a,b);completeConversation(s,a,b);
  for (const [newcomer,kin] of families) for (const relative of kin) if (![a,b].includes(relative) && !s.ecs.personable[relative]?.dead) {
    addGoodwill(s,newcomer,relative,6);addGoodwill(s,relative,newcomer,6);
  }
  const event=(s.events||[]).filter(e=>e.type=="marriage"&&e.people.includes(a)&&e.people.includes(b)).at(-1);
  s.wedding = {eventId:event.id,people:[a,b],until:s.days+1/12};
  recordEvent(s,"celebration",[a,b],[],{marriageId:event.id});
  return {ok:true,message:"You married and formed a household. Your families celebrate."};
}

export function canFoundHousehold(s) {
  const a=s.ui.playerId,house=s.ecs.household?.[a]?.houseId;
  return s.ecs.personable[a].age>=18 && !s.ecs.personable[a].dead && (s.ecs.building?.[house] || s.ecs.shelter?.[house]?.stage=="house") && s.ecs.controllable[house]?.controllerId==a && !s.ecs.village?.[house]?.villageId;
}
export function foundHousehold(s) {
  if(!canFoundHousehold(s))return false;
  const a=s.ui.playerId,house=s.ecs.household[a].houseId,id=entityId(s.ecs,"village-");
  const centre=Hex().fromPoint(s.ecs.spatial[house]);
  s.villages[id]={id,name:"Newstead",centre:{x:centre.x,y:centre.y},houses:[house],sharedPlaces:[],founderId:a};
  s.ecs.village[house]={...s.ecs.village[house],id:house,villageId:id};
  for(const person of Object.keys(s.ecs.personable))if(s.ecs.household[person]?.houseId==house)s.ecs.village[person]={...s.ecs.village[person],id:person,villageId:id};
  recordEvent(s,"settlement",[a],[house],{villageId:id});return true;
}
export function canInviteHome(s,a,b) {
  const house=s.ecs.household?.[a]?.houseId;
  return a!=b && !s.ecs.personable[a]?.dead && !s.ecs.personable[b]?.dead && s.ecs.personable[a]?.age>=18 && s.ecs.personable[b]?.age>=18 &&
    (!s.ecs.kinship[b]?.spouse || s.ecs.personable[s.ecs.kinship[b].spouse]?.dead) && house!=s.ecs.household[b]?.houseId && (s.ecs.building?.[house] || s.ecs.shelter?.[house]?.stage=="house") && s.ecs.controllable[house]?.controllerId==a &&
    ["personal","intimate"].includes(s.ecs.relationships[b]?.known[a]?.ring) && ["personal","intimate"].includes(s.ecs.relationships[a]?.known[b]?.ring);
}

export function householdRoom(s,house,person) {
  const beds=new Set([house,...(s.ecs.building?.[house]?.rooms||[]),...Object.keys(s.ecs.interior||{}).filter(id=>s.ecs.interior[id].buildingId==house)]);
  const capacity=[...beds].reduce((sum,id)=>sum+(s.ecs.sleepable?.[id]?.capacity||0),0);
  const residents=Object.keys(s.ecs.personable).filter(id=>isResident(s,id) && !s.ecs.personable[id].dead && s.ecs.household[id]?.houseId==house);
  return capacity>=residents.length+(residents.includes(person)?0:1);
}
