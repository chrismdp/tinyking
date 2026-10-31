import { FUEL_TRADES, FUEL_HOURS } from "game/favours";
import MersenneTwister from "mersenne-twister";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities, deleteEntity } from "game/entities";
import { generatePerson, TRIANGLES } from "game/map";
import { generateVillageLife, settlementLayoutInputs, workBayTiles } from "game/villages";
import { path, removeBidirectionalLink, addBidirectionalLink } from "game/pathfinding";
import { reserveRoad, canPlaceField, reserveFieldPlot, reserveWorkYard, canReserveWorkYard, reserveFieldLane, tileContents } from "game/land_use";
import { buildingFootprint, canClearForBuilding, reserveBuildingClearance } from "game/tree_clearance";
import { groundForState, safeTile, shelterSurface, roadStep, ROAD_CROSS_SLOPE } from "game/geography";
import { topController } from "game/playable";
import { meet, addGoodwill } from "game/people";
import { invalidateEventIndex, recordEvent } from "game/events";
import { createPossession, repairHouseholds } from "game/possessions";
import { recordJourney, routeTile, flushJourneys } from "game/settlement_routes";
import { growthRecord, growBuildings, householdRoster, expandedFootprint, footprintsOverlap, recordProduction, recordMeetingUse, completeTradeProduction, consumeStored, depositProduced } from "game/settlement_growth";
import { frozenAt, climateTile } from "game/climate";
import { DAYS_IN_SEASON, HOUR, season as seasonName } from "game/time";
import { hashUnit } from "game/math";
import crops from "data/crops.json";

export const HOUSE_TIMBER = 12;
const at = (s,point) => routeTile(s,point);
function homeRearTiles(s,site) {
  const f=buildingFootprint({ecs:{spatial:{home:site.point},building:{home:{entrance:site.entrance}}}},"home");
  return [...new Set([-32.5,0,32.5].flatMap(x=>[0,15,30].map(depth=>{
    const y=-f.halfDepth-depth;
    return at(s,{x:f.x+x*Math.cos(f.angle)+y*Math.sin(f.angle),y:f.y-x*Math.sin(f.angle)+y*Math.cos(f.angle)});
  })))];
}
function reserveSiteField(s,site,pads,owner) {
  const ground=s.map?.geography && groundForState(s),edges=new Map();
  const roadEdge=(a,b)=>{
    if(!ground)return true;
    const key=[a,b].sort().join(":");
    if(!edges.has(key))edges.set(key,safeTile(ground,s.ecs.spatial[a],ROAD_CROSS_SLOPE) && safeTile(ground,s.ecs.spatial[b],ROAD_CROSS_SLOPE) && roadStep(ground,Hex().fromPoint(s.ecs.spatial[a]),Hex().fromPoint(s.ecs.spatial[b])));
    return edges.get(key);
  };
  const e=s.ecs,origin=at(s,site.point),door=e.walkable[origin].neighbours[site.entrance];
  if(!door)return null;
  const home=Hex().fromPoint(site.point),padHexes=pads.map(p=>Hex().fromPoint(p.point)),rearSpace=new Set([...(site.rearOpportunity || []),...pads.flatMap(p=>[...homeRearTiles(s,p),...(p.rearOpportunity || [])])]);
  const candidates=Grid.hexagon({center:home,radius:5}).filter(h=>padHexes.every(p=>p.distance(h)>0) &&
    (!s.map.playerStartTile || h.distance(Hex(s.map.playerStartTile))>2) &&
    Object.values(s.map.entrances || {}).every(e=>!e.hexes || h.distance(Hex(e.hexes[2]))>2))
    .map(h=>at(s,h.toPoint())).filter(id=>id && canPlaceField(s,id) && !(s.space[Hex().fromPoint(e.spatial[id])] || []).some(tree=>e.good?.[tree]?.type=="wood" && !e.haulable?.[tree] && e.controllable?.[tree] && topController(e,tree)!=owner))
    .sort((a,b)=>Number(rearSpace.has(a))-Number(rearSpace.has(b)) || home.distance(Hex().fromPoint(e.spatial[a]))-home.distance(Hex().fromPoint(e.spatial[b])) || String(a).localeCompare(String(b),undefined,{numeric:true}));
  const padTiles=new Set(pads.map(p=>at(s,p.point)));
  for(const keepRear of [true,false])for(const kind of ["road","foot"])for(const tile of candidates) {
    const survey={...s,ecs:{...e,mappable:{...e.mappable,[tile]:{...e.mappable[tile],cropPlot:true}}}};
    for(const access of Object.values(e.walkable[tile].neighbours).filter(id=>!padTiles.has(id) && !e.mappable[id].cropPlot && !e.mappable[id].buildingPlot)) {
      const route=path(survey,door,access,(a,b)=>(kind!="road" || roadEdge(a,b)) && (!keepRear || !rearSpace.has(b)));
      if(!route)continue;
      const tiles=route.map(p=>p.id);
      if((kind=="road"?reserveRoad(s,tiles):reserveFieldLane(s,tiles)) && reserveFieldPlot(s,tile))return {tile,accessTileId:access,route:tiles,kind};
    }
  }
  return null;
}
function reservationPreview(s) {
  return {...s,redraws:[],ecs:{...s.ecs,
    mappable:Object.fromEntries(Object.entries(s.ecs.mappable).map(([id,t])=>[id,{...t,route:t.route && [...t.route]}])),
    walkable:Object.fromEntries(Object.entries(s.ecs.walkable).map(([id,w])=>[id,{...w,neighbours:{...w.neighbours}}]))}};
}
function yardGeometry(s,point,garden,pads,site) {
  const station={ecs:{spatial:{station:{x:point.x,y:point.y}},workplace:{station:{}}}};
  const base=buildingFootprint(station,"station"),bay=expandedFootprint(station,"station",1);
  const gardens=[{...garden,halfWidth:18,halfDepth:18,angle:0}];
  const homes=pads.map(p=>p.usedBy?s.ecs.treeClearance?.[p.usedBy] || buildingFootprint(s,p.usedBy):
    buildingFootprint({ecs:{spatial:{pad:p.point},building:{pad:{entrance:p.entrance}}}},"pad"));
  if([base,...gardens].some(f=>homes.some(h=>footprintsOverlap(f,h))))return null;
  const rectangles=[base,...gardens],tiles=[];
  // Exact convex overlap with the real roof/garden rectangles. The union
  // reserves only intersected tiles, rather than an inflated future yard.
  for(const h of Grid.hexagon({center:Hex().fromPoint(point),radius:2})) {
    const centre=h.toPoint(),hex=Hex().corners().map(p=>({x:p.x+centre.x,y:p.y+centre.y}));
    const overlap=rectangles.some(f=>{
      const box=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>({x:f.x+x*f.halfWidth,y:f.y+y*f.halfDepth}));
      const axes=[{x:1,y:0},{x:0,y:1},...hex.map((p,i)=>({x:hex[(i+1)%6].y-p.y,y:p.x-hex[(i+1)%6].x}))];
      return axes.every(a=>{const A=hex.map(p=>p.x*a.x+p.y*a.y),B=box.map(p=>p.x*a.x+p.y*a.y);return Math.max(...A)>Math.min(...B)+1e-7 && Math.max(...B)>Math.min(...A)+1e-7;});
    });
    if(overlap)tiles.push(at(s,centre));
  }
  const homeRear=expandedFootprint({ecs:{spatial:{home:site.point},building:{home:{entrance:site.entrance}}}},"home",2);
  return {tiles,base,room:!homes.some(h=>footprintsOverlap(bay,h)) && ![base,...gardens].some(f=>footprintsOverlap(f,homeRear)) &&
    !workBayTiles(s,point,0).includes(at(s,garden))};
}
function reserveSiteYard(s,site,pads,owner=null) {
  const padTiles=new Set(pads.map(p=>at(s,p.point))),home=Hex().fromPoint(site.point),door=s.ecs.walkable[at(s,site.point)].neighbours[site.entrance];
  site.yardOwner="site:"+at(s,site.point);
  const candidates=Grid.hexagon({center:home,radius:5}).filter(h=>home.distance(h)>0 &&
    (!s.map.playerStartTile || h.distance(Hex(s.map.playerStartTile))>2) &&
    Object.values(s.map.entrances || {}).every(e=>!e.hexes || h.distance(Hex(e.hexes[2]))>2)).map(h=>at(s,h.toPoint())).filter(id=>id &&
      !padTiles.has(id) && canReserveWorkYard(s,id,site.yardOwner) && !pads.some(other=>other!=site && !other.usedBy && other.yardPoint && at(s,other.yardPoint)==id))
    .sort((a,b)=>home.distance(Hex().fromPoint(s.ecs.spatial[a]))-home.distance(Hex().fromPoint(s.ecs.spatial[b])) || Number(b==at(s,site.yardPoint))-Number(a==at(s,site.yardPoint)) || Number(a)-Number(b));
  let fallback;
  for(const id of candidates) {
    for(const gardenHex of Grid.hexagon({center:Hex().fromPoint(s.ecs.spatial[id]),radius:1}).neighborsOf(Hex().fromPoint(s.ecs.spatial[id]),ALL_SIDES)) {
      const garden=gardenHex.toPoint();
      if(home.distance(gardenHex)>5)continue;
      const geometry=yardGeometry(s,s.ecs.spatial[id],garden,pads,site);
      if(!geometry || geometry.tiles.some(tile=>!tile || padTiles.has(tile) ||
          s.map.playerStartTile && Hex().fromPoint(s.ecs.spatial[tile]).distance(Hex(s.map.playerStartTile))<=2 ||
          Object.values(s.map.entrances || {}).some(e=>e.hexes && Hex().fromPoint(s.ecs.spatial[tile]).distance(Hex(e.hexes[2]))<=2) ||
          tileContents(s,tile).some(id=>s.ecs.good?.[id]?.type=="wood" && !s.ecs.haulable?.[id] && s.ecs.controllable?.[id] && topController(s.ecs,id)!=owner) ||
          pads.some(other=>other!=site && !other.usedBy && other.yardPoint && at(s,other.yardPoint)==tile)) ||
        !canClearForBuilding(s,geometry.base,owner) || !canReserveWorkYard(s,geometry.tiles,site.yardOwner) || !path(s,door,id))continue;
      const plan={id,tiles:geometry.tiles,garden,room:geometry.room};
      if(geometry.room){fallback=plan;break;}
      fallback ||= plan;
    }
    if(fallback?.room)break;
  }
  if(!fallback)return undefined;
  if(!reserveWorkYard(s,fallback.tiles,site.yardOwner))return undefined;
  site.yardTiles=fallback.tiles;
  site.yardPoint={x:s.ecs.spatial[fallback.id].x,y:s.ecs.spatial[fallback.id].y};
  site.gardenPoint=fallback.garden;
  site.rearOpportunity=[...new Set([...workBayTiles(s,s.ecs.spatial[fallback.id],0),...homeRearTiles(s,site)])];
  return fallback.id;
}

export function reserveFoundingFields(s) {
  const sites=Object.values(s.settlement.sites).flat(),now=s.days;
  for(const site of sites)site.navigationLinks ||= {...s.ecs.walkable[at(s,site.point)].neighbours};
  for(const site of sites)for(const side of ALL_SIDES)if(side!=site.entrance)removeBidirectionalLink(s.ecs,at(s,site.point),side);
  s.days=-543;
  try {
    for(const site of sites)site.yard=reserveSiteYard(s,site,sites);
    for(const site of [...sites]) {
      const villageId=Object.keys(s.settlement.sites).find(id=>s.settlement.sites[id].includes(site));
      if(!villageId)continue;
      site.field=reserveSiteField(s,site,sites,null);
      if(!site.yard || !site.field) {
        // No people, buildings or costs exist yet. Release only this rejected
        // proposal's private ground; public routes and all other plans remain.
        for(const tile of Object.keys(s.ecs.mappable))if(s.ecs.mappable[tile].buildingPlot==site.yardOwner)delete s.ecs.mappable[tile].buildingPlot;
        const tile=at(s,site.point);
        for(const [side,n] of Object.entries(site.navigationLinks))if(!sites.some(other=>other!=site && at(s,other.point)==n))addBidirectionalLink(s.ecs,tile,Number(side),n);
        if(site.field) {
          // This is an unused survey reservation, with no crop, owner or seed
          // expenditure yet. Its land can itself become the replacement pad.
          const field=site.field.tile;
          if(!(s.space[Hex().fromPoint(s.ecs.spatial[field])] || []).some(id=>s.ecs.farmable?.[id]))delete s.ecs.mappable[field].cropPlot;
          site.field=null;
        }
        const planned=newSitePlan(s,Object.keys(s.settlement.sites).find(id=>s.settlement.sites[id].includes(site)),sites.filter(p=>p!=site),[],site.point);
        if(!planned) {
          // Native uninhabited-terrain policy: these are survey opportunities,
          // not residents, buildings or paid construction. Keep viable hamlets.
          const remaining=s.settlement.sites[villageId].filter(other=>other!=site);
          const rejected=remaining.length<3?[site,...remaining]:[site];
          for(const proposal of rejected) {
            if(proposal.usedBy || proposal.householdEstablished)throw new Error("Cannot reject an established household");
            for(const id of Object.keys(s.ecs.mappable))if(s.ecs.mappable[id].buildingPlot==proposal.yardOwner)delete s.ecs.mappable[id].buildingPlot;
            if(proposal.field && !(s.space[Hex().fromPoint(s.ecs.spatial[proposal.field.tile])] || []).some(id=>s.ecs.farmable?.[id]))delete s.ecs.mappable[proposal.field.tile].cropPlot;
            (s.settlement.rejectedSites ||= []).push({point:{...proposal.point},establishSeason:proposal.establishSeason,reason:"No feasible house, work yard and accessible field proposal"});
            sites.splice(sites.indexOf(proposal),1);
            s.settlement.sites[villageId].splice(s.settlement.sites[villageId].indexOf(proposal),1);
          }
          if(!s.settlement.sites[villageId].length){delete s.settlement.sites[villageId];delete s.villages[villageId];}
          continue;
        }
        Object.assign(site,planned.site);
        applySitePlan(s,site,planned.surface);delete site.unsurveyed;
        if(!reserveWorkYard(s,site.yardTiles || [site.yard],site.yardOwner))throw new Error("Validated founding yard changed during reservation");
        if(!(site.field.kind=="foot"?reserveFieldLane(s,site.field.route):reserveRoad(s,site.field.route)) || !reserveFieldPlot(s,site.field.tile))throw new Error("Validated founding field changed during reservation");
      }
    }
    for(const site of sites)site.workYardTiles=[];
  } finally {s.days=now;}
}
const historicalSurfacePlans=new WeakMap();
function planSurface(s,point,pads=Object.values(s.settlement.sites).flat()) {
  // Native surface planning also pins unbuilt reserved pads. These records
  // exist only in the geometry proposal, never in the actual ECS or history.
  const survey={...s,ecs:{...s.ecs,building:{...s.ecs.building},spatial:{...s.ecs.spatial}}};
  pads.filter(site=>!site.usedBy).forEach((site,i)=>{
    survey.ecs.building["~pad:"+i]={};survey.ecs.spatial["~pad:"+i]=site.point;
  });
  if(!s.generatingHistory)return shelterSurface(survey,point);
  let cache=historicalSurfacePlans.get(s);
  // Historical access reservations accompany a real field/home reservation,
  // which advances this revision. A new surface also invalidates every plan.
  if(!cache || cache.surface!==s.map.geography || cache.revision!==s.landUseRevision) {
    cache={surface:s.map.geography,revision:s.landUseRevision,plans:new Map()};
    historicalSurfacePlans.set(s,cache);
  }
  const key=String(Hex().fromPoint(point));
  if(!cache.plans.has(key))cache.plans.set(key,shelterSurface(survey,point));
  return cache.plans.get(key);
}
function siteAvailable(s, site, villageId, people, pads=Object.values(s.settlement.sites).flat()) {
  const e=s.ecs, tile=at(s,site.point);
  const hex=Hex().fromPoint(site.point);
  if(s.map?.playerStartTile && hex.distance(Hex(s.map.playerStartTile))<3)return false;
  if(Object.values(s.map?.entrances || {}).some(entry=>entry.hexes && hex.distance(Hex(entry.hexes[2]))<3))return false;
  if(site.unsurveyed && pads.some(other=>other!==site && !other.usedBy && Math.hypot(other.point.x-site.point.x,other.point.y-site.point.y)<150))return false;
  if(site.usedBy || !tile || e.mappable[tile].cropPlot || e.mappable[tile].buildingPlot || !e.walkable[tile].speed)return false;
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
function newSitePlan(s,villageId,pads,people=[],near) {
  const e=s.ecs,village=s.villages[villageId],centre=Hex(village.centre);
  const anchor=at(s,e.spatial[village.houses[0]] || (s.settlement.sites[villageId] || []).find(site=>pads.includes(site))?.point || near);
  const candidates=Object.keys(e.mappable).filter(id=>e.mappable[id].terrain=="grassland" && !e.mappable[id].villagePlot &&
    !e.mappable[id].route?.length && !e.walkable[id].trackReserved && centre.distance(Hex().fromPoint(e.spatial[id]))<=3 && canPlaceField(s,id))
    .sort((a,b)=>Math.hypot(e.spatial[a].x-near.x,e.spatial[a].y-near.y)-Math.hypot(e.spatial[b].x-near.x,e.spatial[b].y-near.y) || Number(a)-Number(b));
  for(const tile of candidates) {
    const approach=path(s,tile,anchor),preferred=approach?.[0]?.exit;
    const entrances=Object.keys(e.walkable[tile].neighbours).map(Number).sort((a,b)=>Number(b==preferred)-Number(a==preferred) || a-b);
    let surface;
    for(const entrance of entrances) {
      const trial={point:{x:e.spatial[tile].x,y:e.spatial[tile].y},entrance,unsurveyed:true,navigationLinks:{...e.walkable[tile].neighbours}};
      if(!siteAvailable(s,trial,villageId,people,pads))continue;
      surface ??= planSurface(s,trial.point,pads);
      if(!surface)break;
      const preview=reservationPreview(s);preview.map={...s.map,geography:surface};
      for(const side of ALL_SIDES)if(side!=entrance)removeBidirectionalLink(preview.ecs,tile,side);
      const door=preview.ecs.walkable[tile].neighbours[entrance];
      if(!door || !(reserveRoad(preview,[tile,door]) || reserveFieldLane(preview,[tile,door])) || !path(preview,door,anchor))continue;
      trial.yard=reserveSiteYard(preview,trial,[...pads,trial],people[0]?topController(e,people[0]):null);
      if(!trial.yard)continue;
      trial.field=reserveSiteField(preview,trial,[...pads,trial],people[0]?topController(e,people[0]):null);
      if(trial.field){trial.workYardTiles=[];return {site:trial,surface};}
    }
  }
  return null;
}
function applySitePlan(s,site,surface) {
  s.map={...s.map,geography:surface};
  const ground=groundForState(s),tile=at(s,site.point);
  for(const id of Object.keys(s.ecs.mappable))s.ecs.mappable[id].elevation=ground.hex(s.ecs.spatial[id]).centre;
  for(const side of ALL_SIDES)if(side!=site.entrance)removeBidirectionalLink(s.ecs,tile,side);
  if(!(reserveRoad(s,[tile,s.ecs.walkable[tile].neighbours[site.entrance]]) || reserveFieldLane(s,[tile,s.ecs.walkable[tile].neighbours[site.entrance]])))throw new Error("Validated house approach changed during construction");
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
  let site=(options.site?[options.site]:sites).find(site=>siteAvailable(s,site,villageId,people) && (options.timber!=null || site.establishSeason==null));
  if(!site && options.timber==null && s.map?.geography) {
    const planned=newSitePlan(s,villageId,Object.values(s.settlement.sites).flat(),people,e.spatial[village.houses[0]]);
    if(planned){site=planned.site;surface=planned.surface;sites.push(site);}
  }
  if(!site)return null;
  if(!site.field) {
    const preview=reservationPreview(s),plan={...site};
    for(const side of ALL_SIDES)if(side!=site.entrance)removeBidirectionalLink(preview.ecs,at(s,site.point),side);
    plan.yard=reserveSiteYard(preview,plan,Object.values(s.settlement.sites).flat(),topController(e,people[0]));
    if(!plan.yard)return null;
    plan.field=reserveSiteField(preview,plan,Object.values(s.settlement.sites).flat(),topController(e,people[0]));
    if(!plan.field)return null;
    plan.workYardTiles=[];
    Object.assign(site,plan);
  }
  if(site.unsurveyed && s.map?.geography) {
    surface ||= planSurface(s,site.point);
    if(!surface)return null;
    applySitePlan(s,site,surface);
  }
  if(!reserveWorkYard(s,[...(site.yardTiles || [site.yard]),...(site.workYardTiles || [])],site.yardOwner))throw new Error("Validated household yard reservation changed during construction");
  if(!e.mappable[site.field.tile].cropPlot && (!(site.field.kind=="foot"?reserveFieldLane(s,site.field.route):reserveRoad(s,site.field.route)) || !reserveFieldPlot(s,site.field.tile)))throw new Error("Validated household field reservation changed during construction");
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
  if(site.yard) {
    for(const tile of [...(site.yardTiles || [site.yard]),...(site.workYardTiles || [])])e.mappable[tile].buildingPlot=house;
    e.household[house].yardReservation=site.yard;
    e.household[house].gardenPoint=site.gardenPoint;
    if(site.gardenPoint)e.household[house].stationPoint={...site.yardPoint};
    e.household[house].workYardReservation=[...new Set([...(site.yardTiles || []).filter(id=>id!=site.yard),...(site.workYardTiles || [])])];
  }
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
      const house=constructHome(s,village.id,people,{founding:!village.houses.length,timber:20,site});
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

function summariseLivelihood(s,house,season,residents,woodland) {
  const e=s.ecs,h=e.household[house],occupants=(residents.get(house) || []).filter(id=>!e.guest?.[id] && (e.personable[id].born ?? -Infinity)<=s.days-DAYS_IN_SEASON && (e.household[id].since ?? -Infinity)<=s.days-DAYS_IN_SEASON),adults=occupants.filter(id=>e.personable[id].age>=19);
  if(!h?.storeId || !adults.length)return;
  const store=e.container[h.storeId], amounts=store.amounts, worker=adults[0];
  const ledger=h.livelihood ||= {grainGrown:0,grainSown:0,foodConsumed:0,timberHarvested:0,tradeInputs:0};
  // Work summaries account for a real reachable tree and its available wood.
  // One fuel/construction collection per household per season is a journey,
  // never a fresh supply or village-wide woodland clearing.
  if((amounts.wood || 0)<HOUSE_TIMBER+10) {
    const home=Hex().fromPoint(e.spatial[house]);
    const tree=woodland.find(({id,hex})=>e.good[id] && home.distance(hex)<=5 &&
      path(s,at(s,e.spatial[house]),at(s,e.spatial[id])))?.id;
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
    // Trees cannot appear during this household phase. Reuse their physical
    // coordinates and protected-camp checks, then recheck each real entity:
    // an earlier household can already have collected and deleted that tree.
    const start=Hex(s.map.playerStartTile),camps=Object.values(s.map.entrances).map(e=>Hex(e.hexes[2]));
    const woodland=Object.keys(s.ecs.good || {}).filter(id=>s.ecs.good[id].type=="wood" && !s.ecs.haulable?.[id] && !s.ecs.controllable?.[id] && s.ecs.good[id].amount>0)
      .map(id=>({id,hex:Hex().fromPoint(s.ecs.spatial[id])})).filter(({hex})=>hex.distance(start)>4 && camps.every(camp=>hex.distance(camp)>4));
    for(const house of Object.keys(s.ecs.building || {}))if(growthRecord(s,house).builtDay<s.days)summariseLivelihood(s,house,season,residents,woodland);
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
  const crowded=s.settlement.estatesInitialized && Object.values(s.villages).some(v=>{
    const points=v.sharedPlaces.filter(id=>["green","alehouse"].includes(s.ecs.meetingPlace[id].kind)).flatMap(id=>s.ecs.meetingPlace[id].gatheringPoints || []);
    const population=v.houses.reduce((n,h)=>n+(residents.get(h) || []).length,0);
    return new Set(points.map(p=>p.x+":"+p.y)).size<population;
  });
  if(crowded)generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);
  s.settlement.lastSeason=season;
  repairHouseholds(s);
}
