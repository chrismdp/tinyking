import ACTION_TUNING from "data/social_actions.json";
import { lifeClockChance } from "game/social_clock";
import { conditions, pairKey, boundId } from "game/social_conditions";
import { applySocialEffects } from "game/social_effects";
import { recordEvent } from "game/events";
import { hashUnit } from "game/math";
import { DAYS_IN_SEASON } from "game/time";
import { socialLookup } from "game/social_lookups";

// Authored chances retain their former half-life-year units. Convert once,
// before aggregating completed conversations; custom fixture actions are exact.
export const SOCIAL_ACTIONS = ACTION_TUNING.map(action => ({ ...action, chance: lifeClockChance(action.chance) }));

export function socialActionBindings(s,action,a,b) {
  const bindings={actor:a,partner:b,first:a,second:b};
  const visit=s.ecs.planner?.[a]?.world.social;
  bindings.visitor=visit?.visitor===false?b:a;bindings.host=bindings.visitor==a?b:a;
  for(const [role,source] of Object.entries(action.participants||{}))bindings[role]=typeof source=="string"?boundId(bindings,source):socialLookup(s,bindings,source);
  return bindings;
}
function attempts(s,action,bindings,a,b) {
  const moment=Math.floor(s.days/(action.period=="season"?DAYS_IN_SEASON:1));
  const stamp=(action.attemptGroup||action.id)+":"+pairKey(a,b)+(action.directional?":"+bindings.actor:"");
  return (action.oncePerPerson?.map(role=>boundId(bindings,role))||[a,b]).map(id=>({
    owner:s.ecs.relationships?.[id],moment,stamp:action.oncePerPerson?(action.attemptGroup||action.id)+":"+id:stamp
  }));
}
export function socialActionAvailable(s,action,bindings,a,b) {
  return conditions(s,bindings,action.when) && attempts(s,action,bindings,a,b).every(({owner,moment,stamp})=>owner&&owner.actionMoments?.[stamp]!=moment);
}

// Work only on a supplied encounter pair. No population-wide action scans.
export function runSocialActions(s,hook,a,b,{conversations=1,actions=SOCIAL_ACTIONS,summary=false}={}) {
  if(a==b || !s.ecs.personable?.[a] || !s.ecs.personable?.[b] || s.ecs.personable[a].dead || s.ecs.personable[b].dead)return [];
  const fired=[],key=pairKey(a,b);
  for(const action of actions) {
    if(!action.hooks.includes(hook))continue;
    const pairs=action.directional?[[a,b],[b,a]]:[[a,b]];
    for(const [first,second] of pairs) {
      const bindings=socialActionBindings(s,action,first,second);
      if(!socialActionAvailable(s,action,bindings,a,b))continue;
      const moment=Math.floor(s.days/(action.period=="season"?DAYS_IN_SEASON:1));
      const stamp=action.id+":"+key+(action.directional?":"+first:"");
      // Remember attempts, including a failed chance, through saves and travel.
      for(const {owner,moment,stamp} of attempts(s,action,bindings,a,b))(owner.actionMoments ||= {})[stamp]=moment;
      const chance=1-(1-action.chance)**conversations;
      if(hashUnit(s.peopleSeed+":action:"+stamp+":"+moment)>=chance)continue;
      let event;
      if(action.event) {
        const people=action.event.people.map(role=>boundId(bindings,role)),details={summary};
        for(const [name,source] of Object.entries(action.event.details||{}))details[name]=typeof source=="object"?socialLookup(s,bindings,source):source;
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
