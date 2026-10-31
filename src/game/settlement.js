import { FUEL_TRADES, FUEL_HOURS } from "game/favours";
import MersenneTwister from "mersenne-twister";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities, deleteEntity } from "game/entities";
import { generatePerson, TRIANGLES } from "game/map";
import { generateVillageLife, settlementLayoutInputs } from "game/villages";
import { path, removeBidirectionalLink } from "game/pathfinding";
import { reserveRoad, canPlaceField, reserveFieldPlot } from "game/land_use";
import { buildingFootprint, canClearForBuilding, reserveBuildingClearance } from "game/tree_clearance";
import { groundForState, safeTile, shelterSurface } from "game/geography";
import { topController } from "game/playable";
import { meet, addGoodwill } from "game/people";
import { invalidateEventIndex, recordEvent } from "game/events";
import { createPossession, repairHouseholds } from "game/possessions";
import { recordJourney, routeTile, flushJourneys } from "game/settlement_routes";
import { growthRecord, growBuildings, householdRoster, recordProduction, recordMeetingUse, completeTradeProduction, consumeStored, depositProduced } from "game/settlement_growth";
import { frozenAt, climateTile } from "game/climate";
import { DAYS_IN_SEASON, HOUR, season as seasonName } from "game/time";
import { hashUnit } from "game/math";
import crops from "data/crops.json";

export const HOUSE_TIMBER = 12;
const at = (s,point) => routeTile(s,point);
function reserveSiteField(s,site,pads,owner) {
  const e=s.ecs,origin=at(s,site.point),door=e.walkable[origin].neighbours[site.entrance];
  if(!door)return null;
  const home=Hex().fromPoint(site.point),padHexes=pads.map(p=>Hex().fromPoint(p.point));
  const candidates=Grid.hexagon({center:home,radius:5}).filter(h=>padHexes.every(p=>p.distance(h)>0) &&
    (!s.map.playerStartTile || h.distance(Hex(s.map.playerStartTile))>2) &&
    Object.values(s.map.entrances || {}).every(e=>!e.hexes || h.distance(Hex(e.hexes[2]))>2))
    .map(h=>at(s,h.toPoint())).filter(id=>id && canPlaceField(s,id) && !(s.space[Hex().fromPoint(e.spatial[id])] || []).some(tree=>e.good?.[tree]?.type=="wood" && !e.haulable?.[tree] && e.controllable?.[tree] && topController(e,tree)!=owner))
    .sort((a,b)=>home.distance(Hex().fromPoint(e.spatial[a]))-home.distance(Hex().fromPoint(e.spatial[b])) || String(a).localeCompare(String(b),undefined,{numeric:true}));
  const padTiles=new Set(pads.map(p=>at(s,p.point)));
  for(const tile of candidates) {
    const survey={...s,ecs:{...e,mappable:{...e.mappable,[tile]:{...e.mappable[tile],cropPlot:true}}}};
    for(const access of Object.values(e.walkable[tile].neighbours).filter(id=>!padTiles.has(id) && !e.mappable[id].cropPlot && !e.mappable[id].buildingPlot)) {
      const route=path(survey,door,access);
      if(!route)continue;
      const tiles=[origin,...route.map(p=>p.id)];
      if(reserveRoad(s,tiles) && reserveFieldPlot(s,tile))return {tile,accessTileId:access,route:tiles};
    }
  }
  return null;
}
export function reserveFoundingFields(s) {
  const sites=Object.values(s.settlement.sites).flat(),now=s.days;
  for(const site of sites)for(const side of ALL_SIDES)if(side!=site.entrance)removeBidirectionalLink(s.ecs,at(s,site.point),side);
  s.days=-543;
  try {
    for(const site of sites) {
      site.field=reserveSiteField(s,site,sites,null);
      if(!site.field)throw new Error("Surveyed household lacks accessible cultivable land at "+Hex().fromPoint(site.point));
    }
  } finally {s.days=now;}
}
const historicalSurfacePlans=new WeakMap();
function planSurface(s,point) {
  if(!s.generatingHistory)return shelterSurface(s,point);
  let cache=historicalSurfacePlans.get(s);
  // Historical access reservations accompany a real field/home reservation,
  // which advances this revision. A new surface also invalidates every plan.
  if(!cache || cache.surface!==s.map.geography || cache.revision!==s.landUseRevision) {
    cache={surface:s.map.geography,revision:s.landUseRevision,plans:new Map()};
    historicalSurfacePlans.set(s,cache);
  }
  const key=String(Hex().fromPoint(point));
  if(!cache.plans.has(key))cache.plans.set(key,shelterSurface(s,point));
  return cache.plans.get(key);
}
function siteAvailable(s, site, villageId, people) {
  const e=s.ecs, tile=at(s,site.point);
  const hex=Hex().fromPoint(site.point);
  if(s.map?.playerStartTile && hex.distance(Hex(s.map.playerStartTile))<3)return false;
  if(Object.values(s.map?.entrances || {}).some(entry=>entry.hexes && hex.distance(Hex(entry.hexes[2]))<3))return false;
  if(site.unsurveyed && Object.values(s.settlement.sites).flat().some(other=>other!==site && !other.usedBy && Math.hypot(other.point.x-site.point.x,other.point.y-site.point.y)<150))return false;
  if(site.usedBy || !tile || e.mappable[tile].cropPlot || !e.walkable[tile].speed)return false;
  // A surveyed house has a single door spur. Through routes remain public.
  if(e.mappable[tile].route?.some(side=>side!=site.entrance))return false;
  if(Object.keys(e.building || {}).some(id=>Math.hypot(e.spatial[id].x-site.point.x,e.spatial[id].y-site.point.y)<150))return false;
  if((s.space[Hex().fromPoint(site.point)] || []).some(id=>e.farmable?.[id] || e.pasture?.[id] || e.workplace?.[id] || e.meetingPlace?.[id] || e.backyard?.[id]))return false;
  const preview={ecs:{spatial:{site:site.point},building:{site:{entrance:site.entrance}}}};
  const owner=people[0] && topController(e,people[0]);
  if(!canClearForBuilding(s,buildingFootprint(preview,"site"),owner))return false;
  if(s.map?.geography && !safeTile(groundForState(s),site.point))return false;
  const origin=at(s,e.spatial[people[0]]) || tile;
  return !!path(s,origin,tile) && (!s.villages[villageId].houses.length ||
    !!path(s,at(s,e.spatial[s.villages[villageId].houses[0]]),tile));
}
export function constructHome(s, villageId, people, options={}) {
  if(!s.settlement || !people.length)return null;
  const e=s.ecs, village=s.villages[villageId];
  let funding=e.container?.[e.household?.[e.household?.[people[0]]?.houseId]?.storeId];
  if(options.timber!=null && !funding) {
    // Explicit incoming household inventory, recorded before any construction.
    e.container ||= {};
    funding=e.container[people[0]] ||= {id:people[0],capacity:200,amounts:{wood:options.timber,grain:people.length*TRIANGLES.length,gruel:people.length}};
  }
  if(!(funding?.amounts.wood>=HOUSE_TIMBER))return null;
  const sites=s.settlement.sites[villageId] || [];
  let surface;
  let site=sites.find(site=>siteAvailable(s,site,villageId,people) && (options.timber!=null || site.establishSeason==null));
  if(!site && options.timber==null && s.map?.geography) {
    const centre=e.spatial[village.houses[0]], source=at(s,e.spatial[people[0]]);
    const candidates=Object.keys(e.mappable).filter(id=>e.mappable[id].terrain=="grassland" && !e.mappable[id].villagePlot && !e.mappable[id].route?.length && !e.walkable[id].trackReserved && Hex().fromPoint(e.spatial[id]).distance(Hex(village.centre))<=3)
      .sort((a,b)=>Math.hypot(e.spatial[a].x-centre.x,e.spatial[a].y-centre.y)-Math.hypot(e.spatial[b].x-centre.x,e.spatial[b].y-centre.y));
    for(const tile of candidates) {
      const route=path(s,tile,source);
      const trial={point:{x:e.spatial[tile].x,y:e.spatial[tile].y},entrance:route?.[0]?.exit ?? 1,unsurveyed:true};
      if(!siteAvailable(s,trial,villageId,people))continue;
      surface=planSurface(s,trial.point);
      if(!surface)continue;
      const preview={...s,map:{...s.map,geography:surface},redraws:[],ecs:{...e,
        mappable:Object.fromEntries(Object.entries(e.mappable).map(([id,t])=>[id,{...t,route:t.route && [...t.route]}])),
        walkable:Object.fromEntries(Object.entries(e.walkable).map(([id,w])=>[id,{...w,neighbours:id==tile?{[trial.entrance]:w.neighbours[trial.entrance]}:w.neighbours}]))}};
      trial.field=reserveSiteField(preview,trial,[...Object.values(s.settlement.sites).flat(),trial],topController(e,people[0]));
      if(!trial.field)continue;
      site=trial;sites.push(site);break;
    }
  }
  if(!site)return null;
  if(site.unsurveyed && s.map?.geography) {
    surface ||= planSurface(s,site.point);
    if(!surface)return null;
    s.map={...s.map,geography:surface};
    const ground=groundForState(s);
    for(const tile of Object.keys(e.mappable))e.mappable[tile].elevation=ground.hex(e.spatial[tile]).centre;
    if(site.field && (!reserveRoad(s,site.field.route) || !reserveFieldPlot(s,site.field.tile)))throw new Error("Validated household field reservation changed during construction");
  }
  const fundingHouse=e.household?.[people[0]]?.houseId;
  if(options.timber==null)consumeStored(s,fundingHouse,"wood",HOUSE_TIMBER);
  else funding.amounts.wood-=HOUSE_TIMBER;
  const starting=options.timber!=null?{...funding.amounts}:{};
  if(options.timber==null) {
    for(const [type,desired] of [["grain",TRIANGLES.length],["gruel",people.length]]) {
      const amount=Math.min(desired,funding.amounts[type] || 0);
      consumeStored(s,fundingHouse,type,amount);starting[type]=amount;
    }
  }
  const [house]=newEntities(s,[{spatial:{...site.point,immovable:true},nameable:{nickname:options.founding?"Founder's cottage":"Family cottage"},building:{entrance:site.entrance,rooms:[]},household:{farming:false,fields:[],backyards:[]},controllable:{controllerId:people[0]},village:{villageId}}]);
  site.usedBy=house;
  s.settlement.layoutDirty=true;
  s.landUseRevision=(s.landUseRevision || 0)+1;
  const [bed,store]=newEntities(s,[{spatial:{...site.point},interior:{buildingId:house},controllable:{controllerId:house},sleepable:{capacity:6,level:1,occupiers:[]}},{spatial:{...site.point},interior:{buildingId:house},controllable:{controllerId:house},container:{capacity:200,amounts:starting}}]);
  if(options.timber!=null) {funding.amounts={}; delete e.container[people[0]];}
  e.building[house].rooms=[bed,store];e.household[house].storeId=store;
  if(site.field)e.household[house].fieldReservation=site.field;
  e.household[house].estateAccount={initial:{...starting},produced:{},consumed:{}};
  village.houses.push(house);
  if(options.timber!=null)for(const person of people) {e.household[person]={id:person,houseId:house,since:s.days};e.village[person]={id:person,villageId};}
  reserveBuildingClearance(s,house);
  growthRecord(s,house).construction={timber:HOUSE_TIMBER,storeId:funding.id};
  const tile=at(s,site.point);
  for(const side of ALL_SIDES)if(side!=site.entrance)removeBidirectionalLink(e,tile,side);
  const green=village.sharedPlaces?.find(id=>e.meetingPlace[id].kind=="green");
  if(green) {
    const route=path(s,tile,at(s,e.spatial[green]));
    if(route)reserveRoad(s,route.map(step=>step.id));
  }
  invalidateEventIndex(s);
  recordEvent(s,"house_built",people,[house],{houseId:house,villageId,timber:HOUSE_TIMBER,sourceStore:funding.id,reason:options.founding?"founding household":options.timber!=null?"arriving household":"household establishment"});
  invalidateEventIndex(s);
  return house;
}

function incomingHousehold(s,village,site,index) {
  const generator=new MersenneTwister(Math.floor(hashUnit(s.peopleSeed+":settlers:"+village.id+":"+index)*4294967296));
  const familySeed=generator.random_int(), age=22+generator.random_int()%15;
  const people=newEntities(s,[true,false].map(male=>({
    ...generatePerson({spatial:{...site.point},male,age,familySeed:male?familySeed:generator.random_int(),generator,days:s.days}),
    village:{villageId:village.id},household:{},relationships:{known:{}}
  })),"person-");
  if(s.residents)for(const id of people)s.residents[id]=true;
  for(const [i,id] of people.entries()) {s.ecs.controllable[id].controllerId=id;s.ecs.kinship[id].spouse=people[1-i];}
  for(const a of people)for(const b of Object.keys(s.ecs.personable))if(a!=b && !s.ecs.personable[b].dead && !s.ecs.playable?.[b] && s.ecs.village[b]?.villageId==village.id){meet(s,a,b);meet(s,b,a);}
  addGoodwill(s,people[0],people[1],66);addGoodwill(s,people[1],people[0],66);
  return people;
}
export function prepareSettlementSeason(s,season) {
  if(!s.settlement || s.settlement.preparedSeason>=season)return;
  s.settlement.preparedSeason=season;
  let changed=false;
  for(const village of Object.values(s.villages)) {
    const sites=s.settlement.sites[village.id] || [];
    for(const [index,site] of sites.entries()) {
      if(site.householdEstablished || site.establishSeason>season || site.establishSeason==null)continue;
      // Site reservations precede history; the people, inventory and building
      // enter this world only on the actual establishment date.
      const people=incomingHousehold(s,village,site,index);
      const house=constructHome(s,village.id,people,{founding:!village.houses.length,timber:20});
      if(!house)throw new Error("Surveyed founding household cannot build in "+village.id+" at "+season+" site "+index);
      site.householdEstablished=house;
      const timberTrees=Object.keys(s.ecs.good || {}).filter(id=>s.ecs.good[id].type=="wood" && !s.ecs.haulable?.[id] && Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(site.point))<=5);
      const event=recordEvent(s,index?"household_arrival":"founding",people,[house],{villageId:village.id,reason:"accessible route and cultivable household land"+(timberTrees.length?" with nearby timber":""),timberTrees:timberTrees.length});
      if(!index) {
        village.origin={day:s.days,people:[...people],houseId:house,reason:event.reason,access:village.access,priorJourneys:s.settlement.journeys.filter(j=>j.tiles.some(id=>Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(site.point))<=1)).length};
        createPossession(s,people[0],["Silver ring","Bronze brooch","Carved box","Family sword","Psalter"][index%5],"heirloom");
      }
      recordEvent(s,"marriage",people);
      const entry=Object.values(s.map.entrances).find(e=>path(s,e.tileIds[2],at(s,site.point)));
      if(entry)recordJourney(s,{key:"establish:"+house,people,from:entry.tileIds[2],to:at(s,site.point),reason:index?"household arrival":"founding journey",day:s.days-.5,count:people.length});
      changed=true;
    }
  }
  if(changed) {generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);delete s.settlement.layoutDirty;}
}

function summariseLivelihood(s,house,season,residents) {
  const e=s.ecs,h=e.household[house],occupants=(residents.get(house) || []).filter(id=>!e.guest?.[id] && (e.personable[id].born ?? -Infinity)<=s.days-DAYS_IN_SEASON && (e.household[id].since ?? -Infinity)<=s.days-DAYS_IN_SEASON),adults=occupants.filter(id=>e.personable[id].age>=19);
  if(!h?.storeId || !adults.length)return;
  const store=e.container[h.storeId], amounts=store.amounts, worker=adults[0];
  const ledger=h.livelihood ||= {grainGrown:0,grainSown:0,foodConsumed:0,timberHarvested:0,tradeInputs:0};
  // Work summaries account for a real reachable tree and its available wood.
  // One fuel/construction collection per household per season is a journey,
  // never a fresh supply or village-wide woodland clearing.
  if((amounts.wood || 0)<HOUSE_TIMBER+10) {
    const tree=Object.keys(e.good || {}).find(id=>e.good[id].type=="wood" && !e.haulable?.[id] && !e.controllable?.[id] && e.good[id].amount>0 && Hex().fromPoint(e.spatial[id]).distance(Hex().fromPoint(e.spatial[house]))<=5 &&
      Hex().fromPoint(e.spatial[id]).distance(Hex(s.map.playerStartTile))>4 &&
      Object.values(s.map.entrances).every(entry=>Hex().fromPoint(e.spatial[id]).distance(Hex(entry.hexes[2]))>4) &&
      path(s,at(s,e.spatial[house]),at(s,e.spatial[id])));
    if(tree) {
      const trips=Math.ceil(e.good[tree].amount/(e.holder?.[worker]?.capacity || 2));
      const journey=recordJourney(s,{key:"timber:"+house+":"+season,people:[worker],from:at(s,e.spatial[house]),to:at(s,e.spatial[tree]),reason:"household timber",day:s.days-.75,returnDay:s.days-.5,count:trips});
      if(journey) {
        const wood=e.good[tree].amount;
        if(depositProduced(s,house,"wood",wood)){ledger.timberHarvested+=wood;deleteEntity(s,tree);}
      }
    }
  }
  for(const id of [...(h.fields || []),...(h.backyards || []).filter(id=>e.farmable?.[id])]) {
    const farm=e.farmable[id],tile=climateTile(s,id);
    let growing=0;
    const workingDays=new Set();
    for(let day=s.days-DAYS_IN_SEASON;s.generatingHistory && day<s.days-HOUR/2;day+=HOUR)if(seasonName(day)!="winter" && !frozenAt(tile,day)){growing+=HOUR;workingDays.add(Math.floor(day));}
    for(const day of workingDays)if(farm.accessTileId && (e.household[worker].since ?? -Infinity)<=day+.5)recordJourney(s,{key:"field:"+id+":"+day,people:[worker],from:at(s,e.spatial[house]),to:farm.accessTileId,reason:"family field work",day:day+.5,returnDay:day+.7,count:1});
    for(const slot of farm.slots) {
      if(slot.state=="sown")slot.growth=(slot.growth || 0)+growing;
      if(slot.state=="harvestable" || slot.state=="sown" && slot.growth>=crops.grain.growingTime) {
        const harvest=slot.amount || crops.grain.harvestableAmount;
        if(!depositProduced(s,house,"grain",harvest))continue;
        ledger.grainGrown+=harvest;
        recordProduction(s,house,worker,"grain",harvest);
        Object.assign(slot,{state:"harvested",content:null,growth:0,updated:s.days});delete slot.amount;
      }
      if(["empty","ploughed","harvested"].includes(slot.state) && amounts.grain>0) {
        consumeStored(s,house,"grain",1);ledger.grainSown++;
        Object.assign(slot,{state:"sown",content:"grain",growth:0,updated:s.days});
      }
    }
  }
  const elapsed=s.generatingHistory?DAYS_IN_SEASON:Math.max(0,s.days-Math.max(s.days-DAYS_IN_SEASON,s.environmentUpdatedAt ?? s.days-DAYS_IN_SEASON));
  let food=occupants.length*elapsed;
  for(const type of ["gruel","grain","forage"]) {
    const eat=Math.min(food,amounts[type] || 0);consumeStored(s,house,type,eat);food-=eat;ledger.foodConsumed+=eat;
  }
  const workplace=h.workplaceId && e.workplace[h.workplaceId];
  if(workplace) {
    let fueled=true;
    if(FUEL_TRADES[h.trade]) {
      if(!(workplace.fuelHours>0)) {
        if(consumeStored(s,house,"wood",1))workplace.fuelHours=FUEL_HOURS;
        else fueled=false;
      }
      if(fueled)workplace.fuelHours-=.5;
    }
    if(fueled && completeTradeProduction(s,h.workplaceId,worker)) {
      workplace.workHours=(workplace.workHours || 0)+.5;
      recordJourney(s,{key:"trade:"+house+":"+season,people:[worker],from:at(s,e.spatial[house]),to:at(s,e.spatial[h.workplaceId]),reason:"household trade work",day:s.days,returnDay:s.days+.05,count:1});
    }
  }
}

function summariseJourneys(s,season,residents) {
  for(const village of Object.values(s.villages)) {
    if(!village.houses.length)continue;
    const venues=(village.sharedPlaces || []).filter(id=>["green","alehouse"].includes(s.ecs.meetingPlace[id].kind));
    for(const house of village.houses) {
      const occupants=(residents.get(house) || []).filter(id=>!s.ecs.guest?.[id]);
      if(!occupants.length || !venues.length || growthRecord(s,house).builtDay>=s.days)continue;
      for(let day=0;day<DAYS_IN_SEASON;day++) {
        if(s.days-DAYS_IN_SEASON+day+.8<growthRecord(s,house).builtDay)continue;
        const venue=venues[Math.floor(hashUnit(house+":meeting:"+season+":"+day)*venues.length)], now=s.days;
        const atDay=s.days-DAYS_IN_SEASON+day+.8;
        const attending=occupants.filter(id=>(s.ecs.personable[id].born ?? -Infinity)<=atDay && (s.ecs.household[id].since ?? -Infinity)<=atDay);
        if(!attending.length)continue;
        recordJourney(s,{key:"meeting:"+house+":"+season+":"+day,people:attending,from:at(s,s.ecs.spatial[house]),to:at(s,s.ecs.spatial[venue]),reason:"evening meeting",day:atDay,returnDay:atDay+.1,count:attending.length});
        s.days=atDay;for(const id of attending)recordMeetingUse(s,venue,id);s.days=now;
      }
    }
    const adult=village.houses.flatMap(h=>residents.get(h) || []).find(id=>!s.ecs.guest?.[id] && s.ecs.personable[id].age>=19 && (s.ecs.household[id].since ?? -Infinity)<=s.days-1.25);
    if(!adult)continue;
    const entries=Object.values(s.map.entrances || {}).filter(e=>!s.settlement.sealedBorders?.includes(e.key));
    const entry=entries[Math.floor(hashUnit(village.id+":crossing:"+season)*entries.length)];
    if(entry)recordJourney(s,{key:"crossing:"+village.id+":"+season,people:[adult],from:at(s,s.ecs.spatial[s.ecs.household[adult].houseId]),to:entry.tileIds[0],reason:"seeking company at crossing",borderKey:entry.key,day:s.days-1.25,returnDay:s.days-.25,count:1});
  }
}
export function settleSeason(s,season,summary=false) {
  if(!s.settlement || s.settlement.lastSeason>=season)return;
  if(s.settlement.layoutDirty) {generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);delete s.settlement.layoutDirty;}
  const residents=householdRoster(s);
  if(summary) {
    s.settlement.summarising=true;
    for(const house of Object.keys(s.ecs.building || {}))if(growthRecord(s,house).builtDay<s.days)summariseLivelihood(s,house,season,residents);
    summariseJourneys(s,season,residents);
    delete s.settlement.summarising;
    flushJourneys(s);
  }
  // Retry unfinished initial estates when actual work has supplied materials.
  const changedInputs=!s.generatingHistory || s.settlement.layoutInputs!==settlementLayoutInputs(s);
  if(s.settlement.estatesInitialized && changedInputs && Object.values(s.villages).some(v=>v.houses.some(id=>!s.ecs.household[id].fields.length) ||
    v.houses.filter(id=>s.ecs.household[id].trade).length<Math.min(6,Math.max(0,v.houses.length-2)) &&
    v.houses.some(id=>!s.ecs.household[id].trade && (residents.get(id) || []).some(p=>s.ecs.personable[p].age>=18) && s.ecs.container[s.ecs.household[id].storeId].amounts.wood>=4) ||
    v.houses.length>=5 && ["chapel","alehouse"].some(kind=>!v.sharedPlaces.some(id=>s.ecs.meetingPlace[id].kind==kind)) &&
    v.houses.some(id=>s.ecs.container[s.ecs.household[id].storeId].amounts.wood>=8)))generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);
  growBuildings(s,season,residents);
  s.settlement.lastSeason=season;
  repairHouseholds(s);
}
