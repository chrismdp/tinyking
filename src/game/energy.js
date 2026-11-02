import { FOODS, FOOD_ENERGY } from "game/goods";
import { householdAccess } from "game/playable";
import { localHome } from "game/construction";
import { squaredDistance } from "game/math";
import { deleteEntity } from "game/entities";
import { take } from "game/holder";

export const MAX_ENERGY = 100;
export const MEAL_ENERGY = 35;
export const physicalOrder = key => ["build_shelter","cut_tree_down","forage","create_field","create_stockpile","plough_field","sow_field","tend_field","harvest_field","tend_garden","favour"].includes(key);
export const daylight = days => days % 1 * 24 >= 6 && days % 1 * 24 < 18;
export const energySpeed = person => person?.energy <= 0 ? .25 : person?.energy < 20 ? .5 : person?.energy < 40 ? .8 : 1;
export function spendEnergy(state, actor, hours, rate = 9) {
  const p=state.ecs.personable?.[actor];
  if(actor==state.ui?.playerId && Number.isFinite(p?.energy))p.energy=Math.max(0,p.energy-hours*rate);
}
// Runs on activation as well as new games; save parsing and away-map storage stay shared.
export function ensureEnergy(s) {
  const a=s.ui?.playerId,p=s.ecs.personable?.[a];
  if(!p || !(s.ecs.planner?.[a]?.world.ordered || s.ecs.playable?.[a]))return;
  if(!Number.isFinite(p.energy))p.energy=Math.max(0,Math.min(100,100-(p.hunger || 0)*40));
  delete p.hunger;delete p.starving;
  const w=s.ecs.planner?.[a]?.world;
  if(w){w.feeling.hungry=false;w.feeling.tired=false;delete w.mealFailure;delete w.mealSearch;}
  const planner=s.ecs.planner?.[a];
  if(planner && (["recover_meal","eat"].includes(planner.task?.[0]) || planner.plan?.some(task=>["recover_meal","eat"].includes(task[0]))))pauseWork(s);
  const jobs=s.ecs.manager?.[a]?.jobs;
  if(jobs)for(let i=jobs.length-1;i>=0;i--)if(jobs[i].job.key=="find_food")jobs.splice(i,1);
}
export function workBlocked(s) {
  if(s.ecs.personable[s.ui.playerId]?.energy<=0)return "No energy for work · eat or sleep";
  return null;
}
export function pauseWork(s) {
  const a=s.ui.playerId,e=s.ecs,p=e.planner[a],w=p.world;
  for(const j of e.manager[a].jobs)if(j.assignedId==a)j.assignedId=null;
  if(w.claimedFarmable && e.farmable?.[w.claimedFarmable]) {
    const f=e.farmable[w.claimedFarmable];if(f.claimerId==a)f.claimerId=null;
    for(const slot of f.slots)if(slot.workerId==a)delete slot.workerId;
  }
  w.currentJob=null;w.claimedFarmable=null;w.subtasks=null;p.task=null;p.plan=null;
}
export function playerDay(s) {
  ensureEnergy(s);
  const a=s.ui?.playerId,e=s.ecs,p=e.planner?.[a],person=e.personable?.[a];
  if(!p?.world.ordered || !Number.isFinite(person?.energy) || person.dead)return;
  const w=p.world,hour=s.days%1*24;
  const job=e.manager[a]?.jobs.find(j=>j.assignedId==a);
  if(job && physicalOrder(job.job.key) && workBlocked(s))pauseWork(s);
  w.restHome=e.camp?.[w.restCamp] ? w.restCamp : localHome(s,a);
  w.restBed=e.sleepable?.[w.restHome]?w.restHome:Object.keys(e.sleepable || {}).find(id=>householdAccess(e,a,id) && (e.interior?.[id]?.buildingId==w.restHome || e.building?.[w.restHome]?.rooms?.includes(id)));
  // Old saves may still have a compulsory dusk return queued.
  if(w.duskHome) {delete w.duskHome;p.task=null;p.plan=null;}
  if(person.energy>0) {
    delete w.energyEmpty;
    if(w.fireHome || w.byFire) {delete w.fireHome;delete w.byFire;p.task=null;p.plan=null;}
  }
  const talking=s.chat?.active || w.capturedBy || w.capturedAttentionOf ||
    ["chat","ask_about","court","marry","play","invite_home","give_gift"].includes(w.currentJob);
  const resting=p.task?.[0]=="sleep" || w.currentJob=="rest" || w.forcedRest;
  if(!talking && !resting && w.currentJob!="eat_food") {
    // A single return per exhaustion leaves later deliberate visits available.
    if(person.energy<=0 && !w.energyEmpty && !s.travel?.journey && w.restHome) {
      pauseWork(s);w.energyEmpty=true;w.fireHome=w.restHome;
    }
    if(hour>=23 || hour<6) {
      pauseWork(s);w.forcedRest=true;delete w.fireHome;delete w.byFire;
    }
  }
  // A second missed night can end in collapse; ordinary rest is always explicit.
  if(!talking && person.tiredness>1.8 && !w.forcedRest && p.task?.[0]!="sleep") {
    if(job)pauseWork(s);
    person.collapsed=true;w.forcedRest=true;p.task=null;p.plan=null;
    s.ui.dayMessage="You collapsed from a missed night. Tomorrow starts with less energy.";
  }
}
export function foodChoices(s) {
  const e=s.ecs,a=s.ui.playerId,result=[];
  for(const id of Object.keys(e.container || {}))if(e.controllable?.[id] && householdAccess(e,a,id))for(const type of FOODS)if(e.container[id].amounts[type]>=1)result.push({sourceId:id,type,stored:true});
  for(const [id,g] of Object.entries(e.good || {}))if(FOODS.includes(g.type)&&g.amount>=1&&!e.possession?.[id]&&!e.haulable?.[id]?.reservedFor&&e.controllable?.[id]&&householdAccess(e,a,id)) {
    const holder=e.haulable?.[id]?.heldBy;
    if(!holder || holder==a || e.stockpile?.[holder])result.push({sourceId:id,type:g.type});
  }
  return result;
}
export function eatOwnedFood(s, source, type) {
  const e=s.ecs,a=s.ui.playerId,choice=foodChoices(s).find(x=>x.sourceId==source&&x.type==type);
  if(!choice || !e.spatial?.[source] || (e.haulable?.[source]?.heldBy!=a && squaredDistance(e.spatial[a],e.spatial[source])>12**2))return false;
  if(choice.stored)e.container[source].amounts[type]--;
  else if(e.good[source].amount>1)e.good[source].amount--;
  else {if(e.haulable?.[source]?.heldBy)take(e,source);deleteEntity(s,source);}
  const p=e.personable[a];p.energy=Math.min(MAX_ENERGY,(p.energy || 0)+(FOOD_ENERGY[type] ?? MEAL_ENERGY));
  return true;
}
