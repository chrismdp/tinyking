/* global it, expect */
import {community,attach} from './support/travel';
import {completeTravel,ensureMap,localSnapshot} from 'game/travel';
import {skipIntro} from 'game/intro';
import {serialiseGame,restoreGame} from 'game/save_game';
const setup=()=>{
 const {s,ids}=community();s.travel.wholeWorld=true;s.worldHistory={version:1};
 attach(s,community({namespace:'away-',key:'6,5',player:false}).s);
 const disk=new Map();
 s.persistence={checkpoint:async maps=>{s.travel.hexRecords||={};for(const [key,map] of Object.entries(maps)){disk.set(key,restoreGame(serialiseGame(map)));s.travel.hexRecords[key]=key;}},readHex:async key=>disk.get(key)};
 return {s,ids,disk};
};
it('saves then evicts departed terrain and restores actual changed property without duplicating a traveller',async()=>{
 const {s,ids,disk}=setup(),start=s.travel.active;
 const house=Object.keys(s.ecs.building)[0];s.ecs.nameable[house].nickname='Changed home';
 await completeTravel(s,{destination:'6,5',side:0});skipIntro(s);
 expect(disk.has(start)).toBe(true);expect(s.travel.maps[start].compact).toBe(true);
 expect(s.travel.maps[start].ecs.mappable).toBeUndefined();
 expect(Object.values(s.travel.maps).filter(m=>!m.compact)).toHaveLength(1);
 await completeTravel(s,{destination:start,side:3});skipIntro(s);
 expect(s.ecs.nameable[house].nickname).toBe('Changed home');
 expect(Object.values(s.travel.maps).filter(m=>m.residents[ids[0]])).toHaveLength(1);
 expect(s.travel.transit.filter(t=>t.bundle.id===ids[0])).toHaveLength(0);
 expect(Object.values(s.travel.maps).filter(m=>!m.compact)).toHaveLength(1);
});
it('retains a departure snapshot when its persistent checkpoint fails',async()=>{
 const {s}=setup(),old=localSnapshot(s),start=s.travel.active;
 s.persistence.checkpoint=async()=>{throw new Error('disk full');};
 await expect(completeTravel(s,{destination:'6,5',side:0})).rejects.toThrow('disk full');
 expect(s.travel.maps[start].ecs.mappable).toEqual(old.ecs.mappable);
 expect(s.transition).toBeNull();
 await ensureMap(s,start);expect(s.travel.maps[start].compact).toBeFalsy();
});
it('imports every newly learned event once when arrays grow or are replaced',async()=>{
 const {s,ids}=setup(),{advanceWorldClock}=require('game/travel'),{learnEvent}=require('game/events');
 await advanceWorldClock(s);
 for(let i=0;i<3;i++) {
  const event={id:'remote-'+i,type:'birth',people:[ids[1]],items:[],season:0,day:0};
  s.travel.events[event.id]=event;s.travel.eventOrder[event.id]=s.travel.nextEventOrder++;
  if(i===1)s.knowledge[ids[0]].events=[...s.knowledge[ids[0]].events];
  learnEvent(s,ids[0],event);
  await advanceWorldClock(s);await advanceWorldClock(s);
  expect(s.events.filter(e=>e.id===event.id)).toHaveLength(1);
 }
});
it('removes an absent NPC and its actual carried goods from an archived map',()=>{
 const {s,ids}=setup(),{newEntities}=require('game/entities'),{compactMap,restoreDetails}=require('game/world_history'),{departNpc}=require('game/travel');
 const npc=ids[1];
 const [item]=newEntities(s,[{spatial:{...s.ecs.spatial[npc]},good:{type:'grain',amount:2},haulable:{heldBy:npc},controllable:{controllerId:npc}}]);s.ecs.holder[npc].held=[item];
 const detail=restoreGame(serialiseGame(localSnapshot(s))),summary=compactMap(localSnapshot(s));
 departNpc(summary,npc,{to:'6,5',side:0},s.travel);
 restoreDetails(detail,summary);
 expect(detail.residents[npc]).toBeUndefined();expect(detail.ecs.spatial[npc]).toBeUndefined();
 expect(detail.ecs.good[item]).toBeUndefined();expect(detail.ecs.spatial[item]).toBeUndefined();
 expect(s.travel.transit[0].bundle.entities[item].good.amount).toBe(2);
});
it('places a newly arrived NPC cargo with its real holder when loading details',()=>{
 const {s,ids}=setup(),{newEntities}=require('game/entities'),{compactMap,restoreDetails}=require('game/world_history');
 const detail=restoreGame(serialiseGame(localSnapshot(s))),summary=compactMap(localSnapshot(s)),source=ids[1];
 const person=Object.fromEntries(Object.entries(summary.ecs).filter(([,table])=>typeof table==='object'&&table[source]).map(([key,table])=>[key,structuredClone(table[source])]));
 const [npc]=newEntities(summary,[person]);summary.residents[npc]=true;
 const [item]=newEntities(summary,[{spatial:{...summary.ecs.spatial[npc]},good:{type:'wood',amount:3},haulable:{heldBy:npc},controllable:{controllerId:npc}}]);summary.ecs.holder[npc].held=[item];
 restoreDetails(detail,summary);
 expect(detail.ecs.holder[npc].held).toEqual([item]);
 expect(detail.ecs.spatial[item]).toMatchObject({x:detail.ecs.spatial[npc].x,y:detail.ecs.spatial[npc].y});
});
it('gives a visitor without a host an independent queue and preserves its home estate',async()=>{
 const {s,ids}=setup(),{departNpc,advanceWorldClock}=require('game/travel'),{jobQueueFor}=require('game/manager');
 const dest=s.travel.maps['6,5'];dest.residents={};dest.ecs.building={};dest.villages={};
 const home=s.ecs.household[ids[1]].houseId;
 departNpc(s,ids[1],{to:'6,5',side:0});s.days+=7;
 await advanceWorldClock(s);
 const visitor=s.travel.maps['6,5'];
 expect(visitor.ecs.guest[ids[1]]).toMatchObject({houseId:null,homeWorld:'5,5'});
 expect(visitor.ecs.household[ids[1]].houseId).toBeNull();
 expect(jobQueueFor(visitor.ecs,ids[1])).toEqual([]);
 expect(s.travel.visits[ids[1]].household.houseId).toBe(home);
});
it('lands a road heir at a saved compact entrance before activation',async()=>{
 const {s,ids}=setup(),{departNpc,returnSuccessorFromRoad}=require('game/travel'),{compactMap}=require('game/world_history');
 const npc=ids[1];departNpc(s,npc,{to:'6,5',side:0});s.travel.maps[s.travel.active]=compactMap(localSnapshot(s));
 const expected=s.travel.maps[s.travel.active].map.entrances[0].campPoint;
 expect(await returnSuccessorFromRoad(s,npc)).toBe('5,5');
 expect(s.travel.maps['5,5'].ecs.spatial[npc]).toMatchObject(expected);
 expect(s.travel.transit.some(t=>t.bundle.id===npc)).toBe(false);
});
it('keeps the actual workshop when an away household changes its worker',()=>{
 const {s,house,ids}=(()=>{const f=community();f.s.travel.wholeWorld=true;return f;})(),{newEntities}=require('game/entities'),{compactMap,summarySeason,restoreDetails}=require('game/world_history');
 const [workplace]=newEntities(s,[{spatial:{...s.ecs.spatial[house]},workplace:{houseId:house,trade:'smith'},controllable:{controllerId:house}}]);
 Object.assign(s.ecs.household[house],{trade:'smith',workplaceId:workplace});
 const detail=restoreGame(serialiseGame(localSnapshot(s))),summary=compactMap(localSnapshot(s));
 summarySeason(summary,1);restoreDetails(detail,summary);
 const worker=ids.find(id=>detail.ecs.profession?.[id]);
 expect(detail.ecs.profession[worker].workplaceId).toBe(workplace);
 expect(detail.ecs.planner[worker].world.profession.workplaceId).toBe(workplace);
});
it('retains detailed fields and yards at a player-built shelter household',()=>{
 const {s,house}=community(),{compactMap,restoreDetails}=require('game/world_history'),{newEntities}=require('game/entities');
 s.ecs.shelter={[house]:{id:house,stage:'house'}};delete s.ecs.building[house];
 const [field,yard]=newEntities(s,[{spatial:{...s.ecs.spatial[house]},farmable:{houseId:house,slots:[]},controllable:{controllerId:house}},{spatial:{...s.ecs.spatial[house]},backyard:{houseId:house},controllable:{controllerId:house}}]);
 const fields=[field],yards=[yard];
 Object.assign(s.ecs.household[house],{fields,backyards:yards});
 const detail=restoreGame(serialiseGame(localSnapshot(s))),summary=compactMap(localSnapshot(s));
 expect(summary.ecs.household[house].fields).toEqual([]);
 restoreDetails(detail,summary);
 expect(detail.ecs.household[house].fields).toEqual(fields);
 expect(detail.ecs.household[house].backyards).toEqual(yards);
});
it('continues allocating identities after people born while a hex was away',()=>{
 const {s,house,ids}=community(),{compactMap,restoreDetails}=require('game/world_history'),{newEntities}=require('game/entities');
 const detail=restoreGame(serialiseGame(localSnapshot(s))),summary=compactMap(localSnapshot(s));
 const infant={personable:{...s.ecs.personable[ids[1]],age:0},nameable:{nickname:'Born while away'},household:{houseId:house},controllable:{controllerId:ids[1]},kinship:{parents:[ids[1]],children:[]},relationships:{known:{}}};
 const [born]=newEntities(summary,[infant],'social-');summary.residents[born]=true;
 restoreDetails(detail,summary);
 const [later]=newEntities(detail,[{nameable:{nickname:'Born after return'}}],'social-');
 expect(later).not.toBe(born);
 expect(detail.ecs.nameable[born].nickname).toBe('Born while away');
});
