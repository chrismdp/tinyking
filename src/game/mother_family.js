import { HOUSEHOLD_CAPACITY } from "game/household_capacity";
import { isAdult, canBearChild, canFatherChild, canParentTogether, LIFE_STAGES, LIFE_YEARS_PER_SEASON } from "game/life_stages";
import { updateDirectoryPerson } from "game/person_storage";
import { refreshPersonIndex } from "game/population_index";
import { DAYS_IN_SEASON } from "game/time";
/* global require */
import MersenneTwister from "mersenne-twister";
import { newEntities } from "game/entities";
import { generatePerson } from "game/map";
import { entityId, personComponent } from "game/residents";
import { siblingsOf, meet, welcomeCloseKin, disposition } from "game/people";
import { recordEvent } from "game/events";
import { updateFavours, reasonGone } from "game/favours";
import { Hex } from "game/hex";
import { localDirection } from "game/chat_lands";

const kin=(s,id)=>personComponent(s,"kinship",id);
const alive=(s,id)=>personComponent(s,"personable",id)&&!personComponent(s,"personable",id).dead;
const fullName=(s,id)=>{const n=personComponent(s,"nameable",id);return n.nickname||s.personName?.(id)||require("game/name").name(n);};
export const backstoryFor=(s,actor=s.ui.playerId)=>s.backstories?.[actor];

// Called only for a new game's chosen character, never while restoring a save
// or generating another reach. Reference people have no body, planner or map.
export function seedMotherFamily(s,actor,seed) {
  if(backstoryFor(s,actor)||!s.map||!s.ecs.kinship?.[actor])return;
  const e=s.ecs,g=new MersenneTwister(seed),age=e.personable[actor].age+LIFE_STAGES.youngAdult.from;
  updateFavours(s);
  const at=e.spatial[actor];
  const villages=Object.values(s.villages||{}).filter(v=>v.houses?.length).sort((a,b)=>{
    const distance=v=>{const p=v.centre?Hex(v.centre).toPoint():e.spatial[v.houses[0]];return Math.hypot(p.x-at.x,p.y-at.y);};
    return distance(a)-distance(b);
  });
  // Prefer an established household with genuine work. A sibling who has not
  // yet featured in the simulated history can join its remaining bed.
  const adults=Object.keys(e.personable).filter(id=>id!=actor&&alive(s,id)&&isAdult(e.personable[id].age)&&e.household?.[id]?.houseId);
  const supportsChildren=id=>{
    const parents=kin(s,id).parents;
    // Both the mother and a possible younger sibling must fit the ancestry.
    const childAges=[age,age-2];
    if(!parents.length)return childAges.every(childAge=>canFatherChild(Math.max(age,e.personable[id].age)+20-childAge));
    return childAges.every(childAge=>{
      const pair=parents.map(parent=>{
        const p=personComponent(s,"personable",parent);
        const presentAge=p.age+(p.dead&&p.died!=null?(s.days-p.died)/DAYS_IN_SEASON*LIFE_YEARS_PER_SEASON:0);
        return {male:personComponent(s,"nameable",parent).male,age:presentAge-childAge};
      });
      return pair.length==2?canParentTogether(...pair):pair.every(p=>p.male===true?canFatherChild(p.age):p.male===false&&canBearChild(p.age));
    });
  };
  let anchor;
  for(const village of villages) {
    const locals=adults.filter(id=>e.village[id]?.villageId==village.id);
    const room=id=>Object.keys(e.personable).filter(p=>alive(s,p)&&e.household?.[p]?.houseId==e.household[id].houseId).length<HOUSEHOLD_CAPACITY;
    const work=id=>Object.values(s.favours.requests).some(r=>r.householdId==e.household[id].houseId&&r.status=="offered");
    const suitable=id=>supportsChildren(id) &&
      ([...kin(s,id).parents,...siblingsOf(s,id)].some(other=>alive(s,other)&&e.village?.[other]?.villageId==village.id) || village.houses.some(h=>Object.keys(e.personable).filter(p=>alive(s,p)&&e.household?.[p]?.houseId==h).length<HOUSEHOLD_CAPACITY));
    anchor=locals.filter(suitable).sort((a,b)=>Number(work(b)&&room(b))-Number(work(a)&&room(a))||Number(disposition(s,b,actor)!="hate")-Number(disposition(s,a,actor)!="hate")||Number(kin(s,b).parents.length>0)-Number(kin(s,a).parents.length>0)||e.personable[b].age-e.personable[a].age||a.localeCompare(b))[0];
    if(anchor)break;
  }
  if(!anchor)return;
  const reference=(male,personAge,familySeed,extra={})=>{
    const id=entityId(e,"backstory-"),p=generatePerson({male,age:personAge,familySeed,generator:g,days:s.days});
    const r={};
    for(const key of ["nameable","personable","personality","kinship"])r[key]={...p[key],id};
    Object.assign(r.personable,{offMap:true,...extra});
    r.household={id,houseId:null};r.village={id,villageId:null};r.relationships={id,known:{}};
    (s.peopleDirectory ||= {})[id]=r;
    r.nameable.nickname=fullName(s,id);
    if(s.travel){s.travel.people[id]=r;updateDirectoryPerson(s.travel,id);}
    return id;
  };
  const familySeed=e.nameable[anchor].familySeed??g.random_int();
  if(!kin(s,anchor).parents.length) {
    const grandparent=reference(true,Math.max(age,e.personable[anchor].age)+20,familySeed,{dead:true,historical:true});
    kin(s,anchor).parents=[grandparent];kin(s,grandparent).children=[anchor];
  }
  const motherId=reference(false,age,familySeed),parents=[...kin(s,anchor).parents];
  kin(s,motherId).parents=parents;
  for(const p of parents)kin(s,p).children.push(motherId);
  const village=e.village[anchor].villageId;
  let siblings=siblingsOf(s,motherId).filter(id=>alive(s,id)&&e.village?.[id]?.villageId==village);
  if(siblings.length<2) {
    const houses=s.villages[village].houses;
    const house=houses.find(h=>h==e.household[anchor].houseId&&Object.keys(e.personable).filter(id=>alive(s,id)&&e.household?.[id]?.houseId==h).length<HOUSEHOLD_CAPACITY)||houses.find(h=>Object.keys(e.personable).filter(id=>alive(s,id)&&e.household?.[id]?.houseId==h).length<HOUSEHOLD_CAPACITY);
    if(house) {
      const p=generatePerson({spatial:{...e.spatial[anchor]},male:g.random_int()%2==0,age:Math.max(LIFE_STAGES.youngAdult.from,age-2),familySeed,generator:g,days:s.days});
      const [id]=newEntities(s,[{...p,household:{houseId:house},village:{villageId:village},relationships:{known:{}}}],"person-");
      e.kinship[id].parents=parents;
      for(const parent of parents)kin(s,parent).children.push(id);
      e.controllable[id].controllerId=e.controllable[house]?.controllerId||id;
      if(s.residents)s.residents[id]=true;
      refreshPersonIndex(s,id);
      for(const other of adults.filter(x=>e.village[x]?.villageId==village)) {
        if(parents.some(parent=>kin(s,other).parents.includes(parent))){welcomeCloseKin(s,id,other);welcomeCloseKin(s,other,id);}
        else {meet(s,id,other);meet(s,other,id);}
      }
      recordEvent(s,"household_arrival",[id],[],{audienceIds:[],day:s.days-DAYS_IN_SEASON,season:-1,villageId:village,place:house});
      s.redraws?.push(id);
      siblings.push(id);
    }
  }
  const fatherId=reference(true,Math.max(LIFE_STAGES.old.from,age+12),g.random_int(),{dead:true,historical:true,unrevealed:true});
  const queenId=reference(false,age+1,g.random_int(),{unrevealed:true});
  const halfBrotherId=reference(true,Math.max(LIFE_STAGES.youngAdult.from,e.personable[actor].age-2),g.random_int(),{unrevealed:true});
  s.peopleDirectory[halfBrotherId].personality.traits.push("cruel");
  kin(s,actor).parents=[motherId,fatherId];kin(s,motherId).children=[actor];
  kin(s,fatherId).children=[actor,halfBrotherId];kin(s,fatherId).spouse=queenId;kin(s,queenId).spouse=fatherId;
  kin(s,queenId).children=[halfBrotherId];kin(s,halfBrotherId).parents=[queenId,fatherId];
  const b=(s.backstories ||= {})[actor]={motherId,fatherId,queenId,halfBrotherId,homeVillageId:village,relatives:[]};
  // Chronology uses the game's accelerated age scale, before arrival.
  const birth=-e.personable[actor].age / LIFE_YEARS_PER_SEASON * DAYS_IN_SEASON;
  const hidden=(type,people,day,details={})=>recordEvent(s,type,people,[],{sealed:true,audienceIds:[],day,season:Math.floor(day/DAYS_IN_SEASON),...details});
  hidden("marriage",[fatherId,motherId],birth-DAYS_IN_SEASON,{title:"old king"});
  hidden("birth",[actor,motherId,fatherId],birth);
  hidden("separation",[fatherId,motherId],birth+1,{reason:"The king was forbidden to keep the marriage"});
  hidden("exile",[motherId],birth+2,{reason:"The king sent her away",destination:"far away, beyond this region"});
  hidden("marriage",[fatherId,queenId],birth+DAYS_IN_SEASON);
  hidden("birth",[halfBrotherId,queenId,fatherId],birth+6,{title:"current king"});
  hidden("death",[fatherId],-DAYS_IN_SEASON,{cause:"old age"});
  const relatives=[...parents.filter(id=>alive(s,id)&&e.household?.[id]?.houseId),...siblingsOf(s,motherId).filter(id=>alive(s,id)&&e.household?.[id]?.houseId)];
  for(const id of relatives) {
    const grandparent=parents.includes(id),male=personComponent(s,"nameable",id).male;
    b.relatives.push({id,name:fullName(s,id),term:grandparent?(male?"grandfather":"grandmother"):(male?"uncle":"aunt"),inverse:grandparent?"grandchild":e.nameable[actor].male?"nephew":"niece"});
  }
  s.knowledge ||= {};const k=s.knowledge[actor] ||= {people:{},feelings:{}};k.people ||= {};
  k.people[motherId]={traits:[],nameOnly:true};
  for(const r of b.relatives)k.people[r.id]={traits:[],nameOnly:true};
  k.maternalFamily={motherId,origin:"this region",met:[]};
  updateFavours(s);
}
export function familyGoal(s,actor=s.ui.playerId) {
  const b=backstoryFor(s,actor);if(!b)return null;
  const met=s.knowledge?.[actor]?.maternalFamily?.met||[];
  return {met,total:b.relatives.length,text:fullName(s,b.motherId)+" sent you here to find family and work. "+(met.length?"Found "+met.length+" of "+b.relatives.length+" of your mother’s family: ":"Find your mother’s family: ")+b.relatives.map(r=>"your "+r.term+" "+r.name).join(", ")+"."};
}
export function maternalIntroduction(s,actor,npc) {
  const b=backstoryFor(s,actor),r=b?.relatives.find(r=>r.id==npc);
  return r&&!s.knowledge?.[actor]?.maternalFamily?.met?.includes(npc)?{...r,mother_name:fullName(s,b.motherId)}:null;
}
export function recogniseMaternalKin(s,actor,npc) {
  const b=backstoryFor(s,actor),r=maternalIntroduction(s,actor,npc);if(!r)return false;
  for(const [viewer,other] of [[actor,npc],[npc,actor]]) {
    s.knowledge ||= {};const k=s.knowledge[viewer] ||= {people:{},feelings:{}};
    const p=(k.people ||= {})[other] ||= {traits:[]};delete p.nameOnly;p.maternalKin={motherId:b.motherId,term:viewer==actor?r.term:r.inverse};
    (k.kinLinks ||= {})[actor+":"+npc+":maternal"]={id:actor+":"+npc+":maternal",speaker_id:actor,relative_id:npc,kinship:r.term,kin_term:r.term,inverse_term:r.inverse};
    welcomeCloseKin(s,viewer,other);
  }
  s.knowledge[actor].maternalFamily.met.push(npc);
  return true;
}
export function familySearchFacts(s,actor,npc) {
  const b=backstoryFor(s,actor);if(!b)return [];
  const knows=(a,id)=>a==id||!!s.ecs.relationships?.[a]?.known[id]||!!s.knowledge?.[a]?.people?.[id]&&!s.knowledge[a].people[id].nameOnly;
  return b.relatives.filter(r=>r.id!=npc&&!s.knowledge?.[actor]?.maternalFamily?.met?.includes(r.id)).map(r=>{
    const home=s.ecs.household?.[r.id]?.houseId,village=s.villages?.[s.ecs.village?.[r.id]?.villageId];
    const known=knows(npc,r.id),contact=!known&&Object.keys(s.ecs.relationships?.[npc]?.known||{}).sort().find(id=>alive(s,id)&&knows(id,r.id));
    return {...r,answer:known&&home&&village?"known":contact?"referral":"unknown",village_id:known?village?.id||s.ecs.village[r.id].villageId:undefined,village_name:known?village?.name:undefined,
      direction:known&&s.ecs.spatial[home]?localDirection(s.ecs.spatial[npc],s.ecs.spatial[home]):undefined,where_phrase:known?(localDirection(s.ecs.spatial[npc],s.ecs.spatial[home])?"to the "+localDirection(s.ecs.spatial[npc],s.ecs.spatial[home]):"close by"):undefined,contact_id:contact,contact_name:contact?fullName(s,contact):undefined};
  });
}
export function firstFamilyRequest(s,actor,npc) {
  if(!s.knowledge?.[actor]?.maternalFamily?.met?.includes(npc))return false;
  updateFavours(s);
  return Object.values(s.favours?.requests||{}).some(r=>r.householdId==s.ecs.household?.[npc]?.houseId&&r.status=="offered"&&!reasonGone(s,r));
}
