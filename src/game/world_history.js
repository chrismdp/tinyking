import { householdMembers, withPopulationIndex } from "game/population_index";
import { captureDetailOrigins, prepareNeighbourDetails, releaseHistoryWorkspace } from "game/hex_detail";
import { compactMap, SUMMARY_COMPONENTS } from "game/community_summary";
export { compactMap } from "game/community_summary";
import MersenneTwister from "mersenne-twister";
import { Hex } from "game/hex";
import { routeCrossing } from "game/geography";
import { generateWorld } from "game/overworld";
import { generateMap, generatePerson } from "game/map";
import { newEntities } from "game/entities";
import { initialiseTravel, advanceWorldClock, localSnapshot, ensureMap, freezeOpinions, releaseLocalWork, withReferenceIndex } from "game/travel";
import { advanceSeason } from "game/social";
import { drift, initializeRelationships, recalibrateRelationships, withRelationshipIndex } from "game/people";
import { createPossession, repairHouseholds } from "game/possessions";
import { recordEvent, withEventIndex } from "game/events";
import { hashUnit } from "game/math";
import { neighbours, worldKey } from "game/travel_geometry";
import { DAYS_IN_SEASON } from "game/time";
import { worldPoint } from "game/world_terrain";

const requirePoint=pad=>Hex(pad.x,pad.y).toPoint();
const settlementChance={grassland:.7,savanna:.5,steppe:.4,marsh:.3,taiga:.35,jungle:.25,tundra:.15,desert:.1,snowfield:.08};
export function rollHexContents(seed,hex,starting=false) {
  const key=worldKey(hex),roll=tag=>hashUnit(seed+":contents:"+key+":"+tag);
  const kind=hex.ocean?"empty":starting?"villages":roll("settled")>settlementChance[hex.biome]?"empty":roll("town")<.22?"town":"villages";
  const count=kind==="empty"?0:kind==="town"?1:2+Math.floor(roll("villages")*2);
  const discoveries=["ruins","old inn","standing stones","travellers camp"];
  return {kind,roads:!hex.ocean&&roll("road")<.4,settlements:Array.from({length:count},(_,i)=>({id:"w"+hex.x+"_"+hex.y+"-village-"+(i+1),name:["Ash","Reed","Thorn","Hazel"][Math.floor(roll("name"+i)*4)]+["brook","ford","combe","wood"][i%4],houseCount:kind==="town"?8:3+Math.floor(roll("houses"+i)*2)})),discoveries:hex.ocean?[]:[discoveries[Math.floor(roll("discovery")*discoveries.length)]]};
}
export function summarySeason(map,season) {
  if(map.social?.lastSeason>=season)return;
  return withPopulationIndex(map,()=>withRelationshipIndex(map,()=>withEventIndex(map,()=>{
    map.days=season*DAYS_IN_SEASON;
    drift(map,24*DAYS_IN_SEASON);
    advanceSeason(map,season,true);
    // One household livelihood transition, with no hourly needs or field replay.
    const residentOrder=new Map(Object.keys(map.residents||{}).map((id,n)=>[id,n]));
    const houses=new Set([...Object.keys(map.ecs.building||{}),...Object.keys(map.ecs.shelter||{}).filter(id=>map.ecs.shelter[id].stage==="house")]);
    for(const house of houses) {
      const h=map.ecs.household[house],store=map.ecs.container[h?.storeId];if(!store)continue;
      const members=householdMembers(map,house).filter(id=>!map.ecs.personable[id]?.dead).sort((a,b)=>residentOrder.get(a)-residentOrder.get(b));
      const harvest=(season%4+4)%4===2?Math.max(0,h.summaryFields||0)*18:0;
      store.amounts.grain=Math.max(0,(store.amounts.grain||0)+harvest-members.length*3);
      if(harvest&&members.length)recordEvent(map,"harvest",[members[0]],[house],{amount:harvest,summary:true});
    }
    map.needsUpdatedAt=map.environmentUpdatedAt=map.days;
  })));
}
function foundingMap(world,hex,contents,seed) {
  const key=worldKey(hex),s={newsModel:1,compact:true,ecs:{nextId:1,namespace:"w"+hex.x+"_"+hex.y+"-"},space:{},redraws:[],ui:{show:{}},days:-180*DAYS_IN_SEASON,peopleSeed:seed,opinionThresholds:{hate:-.8,love:.8},villages:{},events:[],knowledge:{},social:{lastSeason:-181,courtships:{},avoidance:{}},residents:{},world:{...world,home:hex}};
  const generator=new MersenneTwister(seed),entrances={};
  for(const [side,n] of neighbours(hex).entries())if(world.hexes.some(h=>!h.ocean&&worldKey(h)===worldKey(n))) {
    const route=world.landSeed ? routeCrossing({...world,home:hex},side) : {hexes:[{x:22,y:2},{x:22,y:3},{x:22,y:4}]};
    if(route)entrances[side]={key:route.key,campPoint:requirePoint(route.hexes[2]),hexes:route.hexes,tileIds:[]};
  }
  s.map={worldKey:key,seed,entrances,playerStartTile:{x:22,y:2}};
  for(const [vi,v] of contents.settlements.entries()) {
    s.villages[v.id]={id:v.id,name:v.name,kind:contents.kind,worldKey:key,houses:[],centre:{x:8+vi*7,y:15},sharedPlaces:[]};
    for(let i=0;i<v.houseCount;i++) {
      const point={x:vi*1200+i*210,y:0};
      const [house]=newEntities(s,[{spatial:{...point,immovable:true},nameable:{nickname:contents.kind==="town"?"Town house":"Family cottage"},building:{entrance:0,rooms:[],builtDay:-180*DAYS_IN_SEASON},household:{fields:[],backyards:[],summaryFields:2},village:{villageId:v.id},controllable:{}}],"home-");
      const [store]=newEntities(s,[{container:{capacity:180,amounts:{grain:36,wood:16}},controllable:{controllerId:house}}],"store-");
      s.ecs.household[house].storeId=store;s.villages[v.id].houses.push(house);
      const pair=newEntities(s,[true,false].map(male=>({...generatePerson({spatial:{...point},male,age:22+generator.random_int()%12,familySeed:generator.random_int(),generator,days:s.days}),household:{houseId:house},village:{villageId:v.id}})),"person-");
      for(const id of pair){s.residents[id]=true;s.ecs.controllable[id].controllerId=pair[0];s.ecs.kinship[id].spouse=pair.find(p=>p!==id);}
      s.ecs.controllable[house].controllerId=pair[0];
      recordEvent(s,"house_built",[pair[0]],[house],{houseId:house,timber:12});
      if(!i) {
        const reason="cultivable household land";
        recordEvent(s,"founding",pair,[house],{villageId:v.id,reason});
        s.villages[v.id].origin={day:s.days,people:[...pair],houseId:house,reason};
      }
      recordEvent(s,"marriage",pair);createPossession(s,pair[0],"Bronze brooch","heirloom");
    }
  }
  s.ecs.personality ||= {};s.ecs.personable ||= {};
  initializeRelationships(s,seed);
  return compactMap(s);
}
export async function generateWorldHistory(s,seed,progress=async()=>{},world=generateWorld(seed)) {
  const contents={},maps={};
  for(const [index,hex] of world.hexes.entries()) {
    const key=worldKey(hex);contents[key]=rollHexContents(seed,hex,key===worldKey(world.home));
    if(!hex.ocean)maps[key]=foundingMap(world,hex,contents[key],Math.floor(hashUnit(seed+":hex:"+key)*4294967296));
    await progress("Surveying the world: "+(index+1)+" of "+world.hexes.length,.08*(index+1)/world.hexes.length);
  }
  s.world=world;s.worldHistory={version:1,contents};
  Object.assign(s,maps[worldKey(world.home)]);s.world=world;
  initialiseTravel(s,seed);s.travel.maps=maps;s.travel.wholeWorld=true;s.travel.localPeople=true;s.travel.season=-180;
  for(const map of Object.values(maps)) {
    for(const id of Object.keys(map.residents))s.travel.people[id]=Object.fromEntries(["personable","personality","kinship","relationships","nameable","controllable","household","village","playable"].filter(key=>map.ecs[key]?.[id]).map(key=>[key,map.ecs[key][id]]));
    Object.assign(s.travel.knowledge,map.knowledge);
  }
  await advanceHistorySeasons(s,-179,0,progress);
  s.days=.375;s.travel.days=s.days;s.travel.season=0;
  for(const map of Object.values(s.travel.maps)) {
    map.days=s.days;map.social.lastSeason=0;
    Object.defineProperty(map,"peopleDirectory",{value:s.travel.people,writable:true,configurable:true});
    recalibrateRelationships(map);freezeOpinions(map);
    for(const p of Object.values(map.ecs.personable))if(p.dead)p.historical=true;
  }
  Object.assign(s,s.travel.maps[s.travel.active]);s.days=.375;
}
// Run the same shared seasonal boundary on declared communities of any size.
// New games retain the complete -179..0 range and existing progress values.
export async function advanceHistorySeasons(s,firstSeason,lastSeason,progress=async()=>{}) {
  await withReferenceIndex(s.travel,async()=>{
    for(let season=firstSeason;season<=lastSeason;season++) {
      s.days=season*DAYS_IN_SEASON;
      await advanceWorldClock(s,{travelling:true});
      Object.assign(s,s.travel.maps[s.travel.active]);
      await progress("Forty-five years of world history: year "+Math.ceil((season+180)/4),.08+.7*(season+180)/180);
    }
  });
}

export async function generateWorldGame(s,seed,progress=async()=>{},options={}) {
  await progress("Preparing the whole world",0);
  await generateWorldHistory(s,seed,(label, value) => progress(label, value * .8));
  captureDetailOrigins(s);
  const map=await ensureMap(s,s.travel.active,(label,value)=>progress(label,.65+.15*value),options);
  delete s.compact;Object.assign(s,map);
  await advanceWorldClock(s);
  await prepareNeighbourDetails(s, (label, value) => progress("Preparing nearby lands: " + label, .8 + .2 * value), options);
  await releaseHistoryWorkspace(s);
  s.travel.maps[s.travel.active]=localSnapshot(s);
  return {map:s.map,playerId:Object.keys(s.ecs.playable)[0]};
}

export async function buildHistoryMap(s,hex,summary,progress,options={}) {
  const fresh={ecs:{nextId:1,namespace:"terrain"+hex.x+"_"+hex.y+"-"},space:{},redraws:[],ui:{show:{}},days:s.days};
  const result=await generateMap(fresh,summary.map.seed,progress|| (async()=>{}),{...options,surveyedEntrances:options.geographyFixture ? undefined : storedEntrances(s,hex,summary),world:s.world,hex,worldSeed:s.travel.seed,storedHistory:summary,contents:(s.worldHistory?.contents || s.travel.contents)[worldKey(hex)],noPlayer:worldKey(hex)!==worldKey(s.world.home)||!!s.ui.playerId});
  fresh.map=result.map;return localSnapshot(fresh);
}

// Both sides' saved edge tiles determine the original crossing exactly. This
// survives a reload without retaining or resurveying the neighbouring terrain.
export function storedEntrances(s,hex,summary) {
  if(!s.world.landSeed || s.world.hexes.some(h=>!h.ocean&&!s.travel.maps[worldKey(h)]))return undefined;
  const contracts={},adjacent=neighbours(hex);
  for(const [side,next] of adjacent.entries()) {
    const local=summary.map.entrances[side],peer=s.travel.maps[worldKey(next)]?.map.entrances[(side+3)%6];
    if(!local) {if(peer)return undefined;continue;}
    if(!local.key || peer?.key!==local.key)return undefined;
    const a=worldPoint(hex,Hex(local.hexes[0]).toPoint()),b=worldPoint(next,Hex(peer.hexes[0]).toPoint());
    contracts[side]={key:local.key,crossing:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},
      hexes:local.hexes.map(h=>({...h})),facingHexes:peer.hexes.map(h=>({...h}))};
  }
  return contracts;
}

export function installStoredHistory(s,summary,sites,contents,noPlayer) {
  const e=s.ecs;
  e.interior ||= {};
  for(const [key,table] of Object.entries(summary.ecs))if(typeof table==="object"&&key!=="spatial")Object.assign(e[key]|| (e[key]={}),structuredClone(table));
  s.newsModel=summary.newsModel;s.residents={...summary.residents};s.events=[...summary.events];s.eventIds={...summary.eventIds};s.knowledge=structuredClone(summary.knowledge);s.social=structuredClone(summary.social);s.peopleSeed=summary.peopleSeed;s.opinionThresholds=summary.opinionThresholds;
  s.villages=Object.fromEntries(Object.entries(summary.villages).map(([id,v])=>[id,{...v,sharedPlaces:[]}]));
  const pads=Object.values(sites),used=new Set();
  for(const [id,b] of Object.entries(e.building)) {
    const village=e.village[id].villageId;
    let pad=pads.find(p=>p.villageId===village&&!used.has(p));
    if(!pad)pad=pads.find(p=>!used.has(p));
    if(!pad)throw new Error("Not enough surveyed house pads for stored household "+id);
    used.add(pad);const point=requirePoint(pad);
    e.spatial[id]={id,...point,immovable:true};(s.space[pad.x+","+pad.y]|| (s.space[pad.x+","+pad.y]=[])).push(id);
    b.entrance=pad.frontDoorSide;
    const tile=(s.space[pad.x+","+pad.y]||[]).find(t=>e.mappable[t]);e.mappable[tile].villagePlot=true;
    const [bed]=newEntities(s,[{spatial:point,sleepable:{capacity:6,level:1,occupiers:[]},interior:{buildingId:id},controllable:{controllerId:id}}]);
    const h=e.household[id],store=h.storeId;
    e.spatial[store]={id:store,...point};(e.interior|| (e.interior={}))[store]={id:store,buildingId:id};
    b.rooms=[bed,store];h.fields=[];h.backyards=[];
    s.villages[village].centre={x:pad.x,y:pad.y};
  }
  for(const id of Object.keys(s.residents)) {
    const home=e.household[id]?.houseId,point=e.spatial[home]||requirePoint(s.map.playerStartTile);
    e.spatial[id]={id,x:point.x,y:point.y};
    if(e.personable[id].dead)continue;
    (e.traits|| (e.traits={}))[id]={id,values:{}};(e.attributes|| (e.attributes={}))[id]={id};
    (e.holder|| (e.holder={}))[id]||={id,held:[],capacity:2};
    (e.manager|| (e.manager={}))[id]={id,jobs:[]};
    (e.planner|| (e.planner={}))[id]={id,world:{no_place_for:{},jobs:[],places:{},feeling:{},holding:{},days:s.days}};
  }
  // Add the stranger only after all 180 world seasons have finished.
  e.playable ||= {};
  if(!noPlayer) {
    const generator=new MersenneTwister(s.map.seed);
    const [id]=newEntities(s,[{...generatePerson({spatial:requirePoint(s.map.playerStartTile),male:true,age:24,familySeed:generator.random_int(),generator,days:s.days}),village:{villageId:null},relationships:{known:{}}}],"person-");
    e.playable[id]={id,known:[]};e.manager[id].ordered=true;e.planner[id].world.ordered=true;e.controllable[id].controllerId=id;s.residents[id]=true;
  }
  for(const id of Object.keys(e.possession||{}))e.spatial[id]={...(e.spatial[e.possession[id].ownerId]||requirePoint(s.map.playerStartTile)),id};
  placeSummaryCargo(s,summary,true);
  repairHouseholds(s);
  s.map.discovery=contents.discoveries[0];
  const point=Object.values(s.map.entrances)[0]?.campPoint||requirePoint(s.map.playerStartTile);
  newEntities(s,[{spatial:{x:point.x+70,y:point.y+70,immovable:true},nameable:{nickname:contents.discoveries[0]},discovery:{kind:contents.discoveries[0]}}],"discovery-");
  s.needsUpdatedAt=s.environmentUpdatedAt=s.days;
}

export function restoreDetails(detail,summary) {
  const e=detail.ecs,oldResidents=detail.residents||{};
  e.nextId=Math.max(e.nextId,summary.ecs.nextId);
  for(const id of Object.keys(oldResidents)) {
    const absent=!summary.residents[id],moved=e.household[id]?.houseId!==summary.ecs.household[id]?.houseId;
    if(absent || moved || summary.ecs.personable[id]?.dead) {
      releaseLocalWork(detail,id);
      if(e.planner?.[id]){e.planner[id].task=null;e.planner[id].plan=null;}
    }
    if(!absent)continue;
    const cargo=[...(e.holder[id]?.held || []),...Object.keys(e.possession || {}).filter(item=>e.possession[item].ownerId===id&&e.possession[item].carried)];
    for(const item of cargo)if(!summary.ecs.good[item]) {
      for(const table of Object.values(e))if(table&&typeof table==="object")delete table[item];
      for(const key of Object.keys(detail.space))detail.space[key]=detail.space[key].filter(other=>other!==item);
    }
    for(const key of ["spatial","planner","manager","holder","traits","attributes","guest","profession"])delete e[key]?.[id];
  }
  for(const key of SUMMARY_COMPONENTS) {
    if(["spatial","building","household","shelter"].includes(key))continue;
    for(const [id,record] of Object.entries(summary.ecs[key]||{}))(e[key]|| (e[key]={}))[id]=record;
  }
  for(const [id,h] of Object.entries(summary.ecs.shelter||{}))e.shelter[id]={...e.shelter[id],...h};
  for(const [id,h] of Object.entries(summary.ecs.household))e.household[id]={...e.household[id],...h,...(e.building[id] || e.shelter?.[id]?{fields:e.household[id]?.fields||[],backyards:e.household[id]?.backyards||[]}: {})};
  for(const id of Object.keys(summary.residents))if(!e.spatial[id]) {
    const home=e.household[id]?.houseId,p=e.spatial[home]||detail.map.entrances[Object.keys(detail.map.entrances)[0]]?.campPoint||{x:0,y:0};
    e.spatial[id]={id,x:p.x,y:p.y};
    if(!e.personable[id].dead) {
      (e.planner|| (e.planner={}))[id]={id,world:{no_place_for:{},jobs:[],places:{},feeling:{},holding:{},days:summary.days}};
      (e.manager|| (e.manager={}))[id]={id,jobs:[]};
      (e.traits|| (e.traits={}))[id]={id,values:{}};(e.attributes|| (e.attributes={}))[id]={id};
    }
  }
  for(const id of Object.keys(summary.residents)) {
    if(summary.ecs.spatial[id])Object.assign(e.spatial[id],summary.ecs.spatial[id],{id});
    if(e.personable[id].dead&&e.planner?.[id]){e.planner[id].task=null;e.planner[id].plan=null;}
  }
  placeSummaryCargo(detail,summary);
  for(const key of ["newsModel","events","eventIds","knowledge","social","residents","days"])detail[key]=summary[key];
  detail.needsUpdatedAt=detail.environmentUpdatedAt=summary.days;
  delete detail.compact;
  repairHouseholds(detail);
  return detail;
}

function placeSummaryCargo(detail,summary,cold=false) {
  const e=detail.ecs;
  for(const id of Object.keys(summary.ecs.haulable || {})) {
    if(!e.good[id])continue;
    const holder=e.haulable[id].heldBy,owner=e.possession?.[id]?.ownerId || e.controllable[id]?.controllerId;
    const point=e.spatial[holder] || (!cold && summary.ecs.spatial[id]) || e.spatial[owner] || e.spatial[e.household[owner]?.houseId] || requirePoint(detail.map.playerStartTile);
    e.spatial[id]={...point,id};
    for(const key of Object.keys(detail.space))detail.space[key]=detail.space[key].filter(other=>other!==id);
    if(!holder && e.spatial[id].immovable) {
      const key=String(Hex().fromPoint(point));(detail.space[key] ||= []).push(id);
    }
  }
}
