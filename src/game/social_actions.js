import ACTIONS from "data/social_actions.json";
import { conditions, pairKey, boundId } from "game/social_conditions";
import { applySocialEffects } from "game/social_effects";
import { recordEvent } from "game/events";
import { hashUnit } from "game/math";
import { DAYS_IN_SEASON } from "game/time";

// Work only on a supplied encounter pair. No population-wide action scans.
export function runSocialActions(s,hook,a,b,{conversations=1,actions=ACTIONS,summary=false}={}) {
  if(a==b || !s.ecs.personable?.[a] || !s.ecs.personable?.[b] || s.ecs.personable[a].dead || s.ecs.personable[b].dead)return [];
  const fired=[],key=pairKey(a,b);
  for(const action of actions) {
    if(!action.hooks.includes(hook))continue;
    const pairs=action.directional?[[a,b],[b,a]]:[[a,b]];
    for(const [first,second] of pairs) {
      const bindings={actor:first,partner:second,first,second};
      const visit=s.ecs.planner?.[first]?.world.social;
      bindings.visitor=visit?.visitor===false?second:first;bindings.host=bindings.visitor==first?second:first;
      for(const [role,source] of Object.entries(action.participants||{}))bindings[role]=typeof source=="string"?bindings[source]:s.ecs.kinship?.[bindings[source.spouseOf]]?.spouse;
      if(!conditions(s,bindings,action.when))continue;
      const owner=s.ecs.relationships?.[a];if(!owner)continue;
      const moment=Math.floor(s.days/(action.period=="season"?DAYS_IN_SEASON:1));
      const stamp=action.id+":"+key+(action.directional?":"+first:"");
      if(owner.actionMoments?.[stamp]==moment || s.ecs.relationships?.[b]?.actionMoments?.[stamp]==moment)continue;
      // Remember attempts, including a failed chance, through saves and travel.
      for(const id of [a,b]) {const r=s.ecs.relationships[id];if(r)r.actionMoments={...r.actionMoments,[stamp]:moment};}
      const chance=1-(1-action.chance)**conversations;
      if(hashUnit(s.peopleSeed+":action:"+stamp+":"+moment)>=chance)continue;
      let event;
      if(action.event) {
        const people=action.event.people.map(role=>boundId(bindings,role)),details={summary};
        for(const [name,source] of Object.entries(action.event.details||{}))details[name]=typeof source=="object"?s.ecs[source.component]?.[bindings[source.person]]?.[source.field]:source;
        event=recordEvent(s,action.event.type,people,[],details);
      }
      applySocialEffects(s,action.effects,{...bindings,event},recordEvent);
      fired.push({actionId:action.id,event,stop:!!action.stop});
      if(action.stop)return fired;
    }
  }
  return fired;
}

// Household groups are small. Season hooks check each resident pair once,
// including unhappy spouses who no longer choose one another as companions.
export function runSeasonSocialActions(s,ids,summary) {
  const homes=new Map();
  for(const id of ids) {
    const h=s.ecs.household?.[id]?.houseId;if(!h)continue;
    if(!homes.has(h))homes.set(h,[]);homes.get(h).push(id);
  }
  for(const group of homes.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)runSocialActions(s,"season",group[i],group[j],{summary,conversations:6});
}
