import { householdStore } from "game/favours";
import { topController } from "game/playable";
import { recordEvent } from "game/events";
import { growthRecord, consumeStored, expansionFits, expandedFootprint, householdRoster } from "game/settlement_growth";
import { path } from "game/pathfinding";
import { canPlaceField, reserveFieldPlot, reserveRoad, reserveWorkYard, canReserveWorkYard, reserveFieldLane } from "game/land_use";
import { reserveBuildingClearance, buildingFootprint, canClearForBuilding } from "game/tree_clearance";
import { isResident } from "game/residents";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { TRIANGLES } from "game/map";
import { newEntities, deleteEntity, removeFromSpace } from "game/entities";
import { hashUnit, squaredDistance } from "game/math";

export const TRADES = ["smith", "carpenter", "weaver", "baker", "tanner", "miller"];
export const TRADE_LABELS = {
  smith: "at_forge", carpenter: "carpentry", weaver: "weaving",
  baker: "baking", tanner: "tanning", miller: "milling"
};
const BACKYARDS = ["vegetable", "chicken", "pig", "goat", "beehives"];
const keyOf = p => Hex().fromPoint(p).toString();
const proposalId="~settlement-proposal";
function proposal(state,point,components,house) {
  const e=state.ecs;
  return {...state,ecs:{...e,spatial:{...e.spatial,[proposalId]:point},
    controllable:{...e.controllable,[proposalId]:{controllerId:house}},
    ...Object.fromEntries(Object.entries(components).map(([kind,record])=>[kind,{...e[kind],[proposalId]:record}]))}};
}
// Align the full native roof and first bay inside one actual work hex.
// The feasible interval comes from the sloping front edge and flat rear edge.
export function workStationPoint(point) {
  const proposal={ecs:{spatial:{station:point},workplace:{station:{}}}};
  const roof=buildingFootprint(proposal,"station"),bay=expandedFootprint(proposal,"station",1);
  const corners=Hex().corners(),edge=Math.max(...corners.map(p=>p.y)),right=Math.max(...corners.map(p=>p.x));
  const front=(right-roof.halfWidth)*edge/(right/2);
  const low=roof.halfDepth+2*(bay.halfDepth-roof.halfDepth)-edge,high=front-roof.halfDepth;
  return {x:point.x,y:point.y+(low+high)/2};
}
// Tile coverage of the actual station's rear wing, without clearing trees.
export function workBayTiles(state,point,stationOffset=-10) {
  const keys=new Set();
  for(const x of [stationOffset-19,stationOffset,stationOffset+19])for(const y of [-45,-57,-75])keys.add(keyOf({x:point.x+x,y:point.y+y}));
  keys.delete(keyOf(point));
  return [...keys].map(key=>(state.space[key] || []).find(id=>state.ecs.mappable[id]));
}
export function settlementLayoutInputs(state) {
  const residents=householdRoster(state);
  return JSON.stringify([state.landUseRevision,Object.values(state.villages).map(v=>[v.id,v.houses.map(id=>{
    const wood=state.ecs.container[householdStore(state,id)].amounts.wood || 0;
    return [id,wood>=4,wood>=8,(residents.get(id) || []).some(p=>state.ecs.personable[p].age>=18)];
  }),v.sharedPlaces])]);
}

// Reserve whole tiles for fields and yards. The house entrance stays open;
// props use the adjoining yard, leaving the house and its door legible.
export function generateVillageLife(state, seed, start) {
  const ecs = state.ecs;
  state.redraws ||= [];
  const housePads=new Set([...Object.keys(ecs.building).map(id=>keyOf(ecs.spatial[id])),...Object.values(state.settlement?.sites || {}).flat().map(site=>keyOf(site.point))]);
  const occupied = new Set([...housePads,...Object.keys(ecs.mappable).filter(id=>ecs.mappable[id].villagePlot).map(id=>keyOf(ecs.spatial[id]))]);
  for (const hex of Grid.hexagon({ center: Hex(start), radius: 1 })) occupied.add(hex.toString());
  // Village clearings must preserve the reachable timber promised at arrival.
  for (const id in ecs.good) if (ecs.good[id].type == "wood" &&
    Hex(start).distance(Hex().fromPoint(ecs.spatial[id])) <= 4) occupied.add(keyOf(ecs.spatial[id]));
  const land = Object.keys(ecs.mappable).filter(id => ecs.mappable[id].terrain == "grassland");
  const tileAt = Object.fromEntries(land.map(id => [keyOf(ecs.spatial[id]), id]));
  const reserved = new Set();
  const rearOpportunities=new Set(Object.values(state.settlement?.sites || {}).flat().flatMap(site=>site.rearOpportunity || []));
  const reserve = id => {
    if (!id) return null;
    const key = keyOf(ecs.spatial[id]);
    occupied.add(key);
    reserved.add(key);
    ecs.mappable[id].villagePlot = true;
    return ecs.spatial[id];
  };
  // Search through the actual navigation graph, so a nearby field is reachable.
  const nearby = (house, reach = 5, includePlots = false, includeOccupied = false) => {
    const origin = Hex().fromPoint(ecs.spatial[house]);
    const tile = tileAt[origin];
    const reached = new Set();
    const queue = [tile];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (!id || reached.has(id)) continue;
      reached.add(id);
      for (const n of Object.values(ecs.walkable[id].neighbours)) {
        if (!ecs.mappable[n].cropPlot && !ecs.mappable[n].buildingPlot && origin.distance(Hex().fromPoint(ecs.spatial[n])) <= reach && !reached.has(n)) queue.push(n);
      }
    }
    return [...reached].filter(id => ecs.mappable[id].terrain == "grassland" &&
      (includeOccupied || !occupied.has(keyOf(ecs.spatial[id])) || includePlots && reserved.has(keyOf(ecs.spatial[id]))))
      .sort((a, b) => origin.distance(Hex().fromPoint(ecs.spatial[a])) - origin.distance(Hex().fromPoint(ecs.spatial[b])) || Number(a) - Number(b));
  };
  const add = (point, villageId, components, houseId) => {
    const [id] = newEntities(state, [{
      spatial: { x: point.x, y: point.y, immovable: true }, village: { villageId },
      ...(houseId ? { controllable: { controllerId: houseId } } : {}),
      ...components
    }]);
    reserveBuildingClearance(state, id);
    if(components.workplace || components.meetingPlace?.kind=="alehouse") {
      const g=growthRecord(state,id);
      g.construction={timber:components.workplace?4:8,storeId:ecs.household[houseId]?.storeId};
      const owner=ecs.controllable[houseId]?.controllerId;
      if(state.settlement && ecs.personable?.[owner])recordEvent(state,"building_built",[owner],[id],{buildingId:id,kind:components.workplace?.trade || "alehouse",timber:g.construction.timber});
    }
    return id;
  };
  const seedSlot = house => {
    const planted=!state.settlement || consumeStored(state,house,"grain",1);
    return {state:planted?"sown":"empty",content:planted?"grain":null,growth:0,updated:state.days};
  };
  const fieldAccess = (house,tile) => {
    const origin=tileAt[keyOf(ecs.spatial[house])];
    const workYards=new Set(Object.values(ecs.household).flatMap(h=>h.workYardTiles || []));
    const blocked=Object.fromEntries([...workYards,tile].map(id=>[id,{...ecs.mappable[id],cropPlot:true}]));
    const survey={...state,ecs:{...ecs,mappable:{...ecs.mappable,...blocked}}};
    for(const keepRear of [true,false])for(const lane of Object.values(ecs.walkable[tile].neighbours).filter(id=>!ecs.mappable[id].cropPlot && !workYards.has(id) && !housePads.has(keyOf(ecs.spatial[id])))) {
      const route=path(survey,origin,lane,(a,b)=>!keepRear || !rearOpportunities.has(b));
      if(route) {
        const tiles=route.slice(1).map(p=>p.id);
        const kind=reserveRoad(state,tiles)?"road":reserveFieldLane(state,tiles)?"foot":null;
        if(kind)return {tile:lane,kind};
      }
    }
    return null;
  };
  const clearableWood = (tile,house) => !(state.space[keyOf(ecs.spatial[tile])] || []).some(id=>ecs.good?.[id]?.type=="wood" && !ecs.haulable?.[id] && ecs.controllable?.[id] && topController(ecs,id)!=topController(ecs,house));
  const canCultivate = (tile,house) => canPlaceField(state,tile) && clearableWood(tile,house);
  const enclosure = (point, villageId, houseId, kind, halfWidth, halfDepth, count, existing) => {
    const id = existing || add(point, villageId, { nameable: { nickname: kind == "chicken" ? "Chicken coop" : kind + " pasture" } }, houseId);
    ecs.pasture ||= {};
    ecs.pasture[id] = { id, houseId, kind, centre: { x: point.x, y: point.y }, halfWidth, halfDepth };
    for (let i = 0; i < count; i++) {
      const phase = hashUnit(seed + ":animal:" + id + ":" + i) * Math.PI * 2;
      const radius = kind == "chicken" ? 3 : kind == "cow" ? 9 : 6;
      newEntities(state, [{
        spatial: { x: point.x + Math.sin(phase) * (halfWidth - radius) * 0.65,
          y: point.y + Math.cos(phase) * (halfDepth - radius) * 0.65 },
        nameable: { nickname: kind }, village: { villageId },
        controllable: { controllerId: houseId },
        animal: { houseId, pastureId: id, kind, phase, radius, facing: phase }
      }]);
    }
    return id;
  };

  let householdIndex = Object.values(ecs.household).filter(h=>h.plot).length;
  for (const [vi, village] of Object.values(state.villages).entries()) {
    if (!village.houses.length) continue;
    village.sharedPlaces ||= [];
    // Start beside the well; the capacity survey below can move the green
    // to a nearby clearing after household fields and yards are complete.
    if (!village.sharedPlaces.length) {
      const candidates = nearby(village.houses[0], 4).filter(tile=>{
        const p=ecs.spatial[tile],owner=topController(ecs,village.houses[0]);
        return [[p,"green"],[{x:p.x-28,y:p.y-23},"well"]].every(([point,kind])=>canClearForBuilding(state,buildingFootprint(proposal(state,point,{meetingPlace:{kind}},village.houses[0]),proposalId),owner));
      });
      const greenTile = candidates.find(id => ecs.mappable[id].settlementTransit) || candidates.find(id => ecs.mappable[id].route?.length) || candidates[0];
      const greenPoint = reserve(greenTile);
      if (!greenPoint) continue;
      const green = add(greenPoint, village.id, { nameable: { nickname: "Village green" }, meetingPlace: { kind: "green" } }, village.houses[0]);
      village.sharedPlaces.push(green, add({ x: greenPoint.x - 28, y: greenPoint.y - 23 }, village.id,
        { nameable: { nickname: "Well" }, meetingPlace: { kind: "well" } }, village.houses[0]));
      if (village.origin) village.origin.centreHex ||= keyOf(greenPoint);
    }
    if (village.houses.length >= 5) for (const kind of ["chapel", "alehouse"]) {
      if (village.sharedPlaces.some(id => ecs.meetingPlace[id].kind == kind)) continue;
      const host = village.houses.find(id => (ecs.container[ecs.household[id]?.storeId]?.amounts.wood || 0) >= 8);
      const point = nearby(village.houses[0], 4).filter(id=>!ecs.mappable[id].route?.length && !ecs.walkable[id].trackReserved).map(id => ecs.spatial[id]).find(p => !Object.keys(ecs.building).some(id => squaredDistance(p,ecs.spatial[id]) < 100 ** 2) && canClearForBuilding(state,buildingFootprint(proposal(state,p,{meetingPlace:{kind}},host),proposalId),host?topController(ecs,host):null));
      if (!point || state.settlement && !host) continue;
      if (host) consumeStored(state,host,"wood",8);
      reserve(tileAt[keyOf(point)]);
      const id = add(point, village.id, { nameable: { nickname: kind == "chapel" ? "Chapel" : "Alehouse" }, meetingPlace: { kind, houseId:host, builtDay:state.days } }, host);
      village.sharedPlaces.push(id);
    }
    // First allocate every yard; fields must not take another family's backyard.
    const inhabited = village.houses.filter(house => Object.keys(ecs.personable).some(id =>
      !ecs.personable[id].dead && ecs.personable[id].age >= 18 && ecs.household[id]?.houseId == house));
    for (const houseId of village.houses) {
      if (ecs.household[houseId]?.plot) continue;
      const origin = Hex().fromPoint(ecs.spatial[houseId]);
      const adjacent = Grid.hexagon({ center: origin, radius: 1 }).neighborsOf(origin, ALL_SIDES);
      const entrance = adjacent[ecs.building[houseId].entrance]?.toString();
      const yardCandidates=ecs.household[houseId]?.yardReservation ? [ecs.household[houseId].yardReservation] :
        nearby(houseId,1).filter(id=>keyOf(ecs.spatial[id])!=entrance && canCultivate(id,houseId));
      const rearTiles = tile => workBayTiles(state,ecs.spatial[tile]);
      const freeRear = tile => tile && !occupied.has(keyOf(ecs.spatial[tile])) && !ecs.mappable[tile].route?.length && !ecs.mappable[tile].cropPlot && !ecs.walkable[tile].trackReserved && canReserveWorkYard(state,tile,houseId);
      const stationFits=tile=>{
        const p=ecs.spatial[tile],preview=proposal(state,{x:p.x-10,y:p.y},{workplace:{houseId}},houseId);
        return expansionFits(preview,proposalId,expandedFootprint(preview,proposalId,2));
      };
      const yardTile=yardCandidates.find(id=>rearTiles(id).every(freeRear) && stationFits(id)) || yardCandidates.find(stationFits) || yardCandidates[0];
      const compact=ecs.household[houseId]?.gardenPoint;
      const workYardTiles=[...new Set([...(ecs.household[houseId]?.workYardReservation || []),
        ...(!compact && yardTile?rearTiles(yardTile).filter(freeRear).filter(tile=>reserveWorkYard(state,tile,houseId)):[])])];
      const yard = reserve(yardTile) || { x: ecs.spatial[houseId].x, y: ecs.spatial[houseId].y - 33 };
      // The actual household yard leaves room behind its work station. Trees
      // outside the current roof remain until a paid extension needs clearance.
      for(const tile of workYardTiles)reserve(tile);
      const storeId = householdStore(state,houseId);
      const household = { ...ecs.household[houseId], id: houseId, farming: true, fields: [], backyards: [], storeId,
        workYardTiles, yardPoint: { x: yard.x, y: yard.y }, plot: { hexes: [...new Set([origin.toString(), keyOf(yard), ...workYardTiles.map(id=>keyOf(ecs.spatial[id]))])] } };
      ecs.household[houseId] = household;
      const kinds = [BACKYARDS[householdIndex % BACKYARDS.length]];
      if (hashUnit(seed + ":backyard:" + houseId) < 0.6) kinds.push(BACKYARDS[(householdIndex + 2) % BACKYARDS.length]);
      for (const [i, kind] of kinds.entries()) {
        let point = compact && !i ? compact : { x: yard.x + 43, y: yard.y + (i ? 23 : -23) };
        if(compact && i) {
          // A second actual garden is optional. Its whole footprint fits one
          // adjacent hex and must preserve public routes and existing farms.
          const extra=Grid.hexagon({center:Hex().fromPoint(yard),radius:1}).neighborsOf(Hex().fromPoint(yard),ALL_SIDES)
            .filter(h=>!state.map?.playerStartTile || h.distance(Hex(state.map.playerStartTile))>2).map(h=>tileAt[h]).find(tile=>tile && tile!=tileAt[keyOf(compact)] && !occupied.has(keyOf(ecs.spatial[tile])) && !rearOpportunities.has(tile) && clearableWood(tile,houseId) && canReserveWorkYard(state,tile,houseId));
          if(!extra)continue;
          reserveWorkYard(state,extra,houseId);reserve(extra);workYardTiles.push(extra);
          household.plot.hexes.push(keyOf(ecs.spatial[extra]));point=ecs.spatial[extra];
        }
        const id = add(point, village.id, { nameable: { nickname: kind == "vegetable" ? "Kitchen garden" : kind }, backyard: { houseId, kind } }, houseId);
        household.backyards.push(id);
        const gardenTile=compact?tileAt[keyOf(point)]:yardTile;
        if (kind == "vegetable" && gardenTile) {
          // Convert this household's unused private plot to its real kitchen crop.
          if(ecs.mappable[gardenTile].buildingPlot==houseId)delete ecs.mappable[gardenTile].buildingPlot;
          if(reserveFieldPlot(state,gardenTile))
            (ecs.farmable ||= {})[id] = { id, houseId, claimerId: null,
              slots: Array.from({ length: 2 }, () => seedSlot(houseId)) };
        }
        if (["chicken", "pig", "goat"].includes(kind)) enclosure(point, village.id, houseId, kind, 18, 16, kind == "chicken" ? 4 : 2, id);
      }
      household.workYardTiles=workYardTiles.filter(tile=>!ecs.mappable[tile].cropPlot);
      for(const tile of [...household.workYardTiles,yardTile].filter(Boolean))reserveWorkYard(state,tile,houseId);
      householdIndex++;
    }
    const targetTrades=Math.min(6,Math.max(0,village.houses.length-2));
    const establishedTrades=new Set(village.houses.map(id=>ecs.household[id]?.trade).filter(Boolean));
    for (const houseId of inhabited) {
      if(establishedTrades.size>=targetTrades)break;
      const household = ecs.household[houseId], storeId = household.storeId;
      if (household.trade || state.settlement && ecs.container[storeId].amounts.wood < 4) continue;
      const yard = household.yardPoint;
      const point = household.stationPoint || { x: yard.x - 10, y: yard.y };
      if(!canClearForBuilding(state,buildingFootprint(proposal(state,point,{workplace:{houseId}},houseId),proposalId),topController(ecs,houseId)))continue;
      if (state.settlement) consumeStored(state,houseId,"wood",4);
      household.trade = [...TRADES.slice(vi%TRADES.length),...TRADES.slice(0,vi%TRADES.length)].find(trade=>!establishedTrades.has(trade));
      establishedTrades.add(household.trade);
      household.workplaceId = add(point, village.id, {
        nameable: { nickname: household.trade == "smith" ? "Forge" : household.trade + " workshop" },
        workplace: { houseId, trade: household.trade, power: household.trade == "miller" ? "wind" : null, builtDay: state.days }
      }, houseId);
      const worker = Object.keys(ecs.personable).find(id => ecs.household[id]?.houseId == houseId && !ecs.personable[id].dead && ecs.personable[id].age >= 18);
      ecs.profession ||= {};
      if (worker) ecs.profession[worker] = { id: worker, trade: household.trade, workplaceId: household.workplaceId, houseId };
      if (worker && ecs.planner?.[worker]) ecs.planner[worker].world.profession = { ...ecs.profession[worker] };
    }
    for (const houseId of village.houses) {
      const h = ecs.household[houseId];
      const count = hashUnit(seed + ":fields:" + houseId) < 0.5 ? 1 : 2;
      if(!h.fields.length && h.fieldReservation) {
        const f=h.fieldReservation,point=reserve(f.tile);
        const id=add(point,village.id,{nameable:{nickname:"Family field"},farmable:{houseId,accessTileId:f.accessTileId,accessKind:f.kind || "road",claimerId:null,slots:TRIANGLES.map(()=>seedSlot(houseId))}},houseId);
        h.fields.push(id);h.plot.hexes.push(keyOf(point));delete h.fieldReservation;
      }
      for (let i = h.fields.length; i < count; i++) {
        let fieldTile,accessTileId,accessKind;
        for(const candidate of nearby(houseId).filter(id=>canCultivate(id,houseId)).sort((a,b)=>Number(rearOpportunities.has(a))-Number(rearOpportunities.has(b)))) {
          const access=fieldAccess(houseId,candidate);
          if(!access || !reserveFieldPlot(state,candidate))continue;
          fieldTile=candidate;accessTileId=access.tile;accessKind=access.kind;break;
        }
        if(!fieldTile)break;
        const point=reserve(fieldTile);
        const id = add(point, village.id, {
          nameable: { nickname: "Family field" },
          farmable: { houseId, accessTileId, accessKind, claimerId: null, slots: TRIANGLES.map(() => seedSlot(houseId)) }
        }, houseId);
        h.fields.push(id);
        h.plot.hexes.push(keyOf(point));
      }
    }
    // A modest flock on grassland, where there is room beyond the yards.
    const pasturePoint = Object.values(ecs.pasture || {}).some(p => p.sharedVillage == village.id) ? null : reserve(nearby(village.houses[0]).find(tile=>canCultivate(tile,village.houses[0])));
    if (pasturePoint) {
      const id = enclosure(pasturePoint, village.id, village.houses[0], vi % 2 ? "cow" : "sheep", 39, 34, vi % 2 ? 3 : 5);
      ecs.pasture[id].sharedVillage = village.id;
    }
  }
  // A crowded village needs more than the centre of a single tile. Allocate
  // body-sized spaces after all household plots, keeping doors and pens clear.
  const fieldHexes = new Set(Object.keys(ecs.farmable || {}).map(id => keyOf(ecs.spatial[id])));
  const obstacles = Object.keys(ecs.spatial).flatMap(id => {
    const kind = ecs.meetingPlace?.[id]?.kind;
    const radius = ecs.building[id] || kind == "chapel" ? 55 : kind == "alehouse" ? 45 :
      ecs.workplace?.[id]?.trade == "miller" ? 45 : ecs.workplace?.[id] || ecs.backyard?.[id] ? 30 : kind == "well" ? 28 : 0;
    return radius ? [{ ...ecs.spatial[id], radius }] : [];
  });
  const pens = Object.values(ecs.pasture || {});
  const gatheringSpaces = [];
  for (const village of Object.values(state.villages)) {
    if (!village.houses.length) continue;
    const venues = village.sharedPlaces.filter(id => ["green", "alehouse"].includes(ecs.meetingPlace[id].kind));
    const candidates = nearby(village.houses[0],8,false,true).filter(id => !fieldHexes.has(keyOf(ecs.spatial[id])))
      .flatMap(tile => [{ tile, ...ecs.spatial[tile] }, ...Array.from({ length: 6 }, (_, i) => ({ tile,
        x: ecs.spatial[tile].x + Math.cos(i * Math.PI / 3) * 34,
        y: ecs.spatial[tile].y + Math.sin(i * Math.PI / 3) * 34 }))])
      .filter(p => !obstacles.some(o => squaredDistance(p, o) < o.radius ** 2) &&
        !pens.some(pen => Math.abs(p.x - pen.centre.x) < pen.halfWidth + 12 && Math.abs(p.y - pen.centre.y) < pen.halfDepth + 12));
    // One pool of separated spaces, shared by all venues. Reserving a whole
    // population for each venue wastes the closest spaces at the first one.
    // Leave the walker's existing <10-unit stopping tolerance inside 300.
    const spacesAround = centres => {
      const distance = p => Math.min(...centres.map(c => squaredDistance(p, c)));
      const used = [];
      for (const p of candidates.filter(p => distance(p) < 290 ** 2 &&
        !gatheringSpaces.some(other => squaredDistance(p, other) < 34 ** 2)).sort((a, b) => distance(a) - distance(b))) {
        if (!used.some(other => squaredDistance(p, other) < 34 ** 2)) used.push(p);
      }
      return used;
    };
    let used = spacesAround(venues.map(id => ecs.spatial[id]));
    const population = Object.keys(ecs.personable).filter(id => !ecs.personable[id].dead && ecs.village[id].villageId == village.id).length;
    if (used.length < population) {
      // Fields can surround the original green. Choose the nearest reachable
      // unused tile with room for everyone, leaving all household plots intact.
      const green = venues.find(id => ecs.meetingPlace[id].kind == "green");
      const sites = nearby(village.houses[0], 8).sort((a, b) =>
        squaredDistance(ecs.spatial[a], ecs.spatial[green]) - squaredDistance(ecs.spatial[b], ecs.spatial[green]));
      for (const tile of sites) {
        const spaces = spacesAround(venues.map(id => ecs.spatial[id == green ? tile : id]));
        if (spaces.length < population) continue;
        const point=ecs.spatial[tile],owner=topController(ecs,green);
        const footprint=buildingFootprint(proposal(state,point,{meetingPlace:{kind:"green"}},village.houses[0]),proposalId);
        if(!canClearForBuilding(state,footprint,owner))continue;
        const fromHex=keyOf(ecs.spatial[green]);
        removeFromSpace(state, green);
        Object.assign(ecs.spatial[green], { x: ecs.spatial[tile].x, y: ecs.spatial[tile].y });
        state.space[keyOf(ecs.spatial[green])].push(green);
        reserve(tile);reserveBuildingClearance(state,green);
        state.redraws.push(green);
        state.landUseRevision=(state.landUseRevision || 0)+1;
        if(village.origin) {
          const move={day:state.days,placeId:green,fromHex,toHex:keyOf(ecs.spatial[green]),reason:"more public gathering space"};
          (village.greenMoves ||= []).push(move);
          const head=ecs.controllable[ecs.controllable[green].controllerId]?.controllerId;
          const locals=Object.keys(ecs.personable).filter(id=>isResident(state,id) && !ecs.personable[id].dead && ecs.village[id]?.villageId==village.id);
          const actor=locals.find(id=>id==head) || locals.find(id=>ecs.personable[id].age>=18) || locals[0];
          recordEvent(state,"green_moved",actor?[actor]:[],[green],{...move,villageId:village.id});
        }
        used = spaces;
        break;
      }
    }
    for (const p of used) { gatheringSpaces.push(p); }
    for (const id of venues) {
      const centre = ecs.spatial[id];
      ecs.meetingPlace[id].gatheringPoints = used.filter(p => squaredDistance(p, centre) < 290 ** 2)
        .sort((a, b) => squaredDistance(a, centre) - squaredDistance(b, centre)).map(p => ({ x: p.x, y: p.y }));
    }
  }
  const cultivated = new Set([...Object.keys(ecs.farmable || {}), ...Object.keys(ecs.backyard || {}), ...Object.keys(ecs.pasture || {}), ...Object.keys(ecs.meetingPlace || {}).filter(id=>["green","well"].includes(ecs.meetingPlace[id].kind))].map(id => keyOf(ecs.spatial[id])));
  for (const id of new Set([...Object.keys(ecs.good || {}),...Object.keys(ecs.forageable || {})])) if (
    (ecs.good?.[id]?.type == "wood" && !ecs.haulable?.[id] || ecs.forageable?.[id] && !ecs.controllable?.[id]) && cultivated.has(keyOf(ecs.spatial[id]))) deleteEntity(state, id);
  if(state.settlement) {
    state.settlement.estatesInitialized=true;
    state.settlement.layoutTriedRevision=state.landUseRevision;
    state.settlement.layoutInputs=settlementLayoutInputs(state);
  }
}

// A bounded, smooth orbit with a slow changing radius. It is a function of game
// time and the seeded phase, so long steps cannot overshoot a fence.
export function updateVillageLife(state) {
  for (const [id, animal] of Object.entries(state.ecs.animal || {})) {
    const pen = state.ecs.pasture[animal.pastureId];
    const phase = animal.phase + state.days * Math.PI * 5;
    const width = (pen.halfWidth - animal.radius - 2) * 0.8;
    const depth = (pen.halfDepth - animal.radius - 2) * 0.8;
    const x = pen.centre.x + Math.sin(phase) * width;
    const y = pen.centre.y + Math.sin(phase * 0.7 + animal.phase) * depth;
    animal.facing = Math.atan2(x - state.ecs.spatial[id].x, y - state.ecs.spatial[id].y);
    Object.assign(state.ecs.spatial[id], { x, y });
  }
}

// Derived data only: roster/day/venue changes invalidate it, and a loaded or
// replayed state computes the same assignments without serializing a cache.
const eveningAssignments = new WeakMap();

export function eveningPlace(state, actorId) {
  const v = state.villages?.[state.ecs.village?.[actorId]?.villageId];
  if (!v) return null;
  const places = v.sharedPlaces.filter(id => ["green", "alehouse"].includes(state.ecs.meetingPlace[id].kind));
  const villagers = Object.keys(state.ecs.personable).filter(person => isResident(state,person) && !state.ecs.personable[person].dead &&
    state.ecs.village[person]?.villageId == v.id);
  const key = JSON.stringify([Math.floor(state.days), villagers, places]);
  const pools = places.map(id => state.ecs.meetingPlace[id].gatheringPoints);
  let cached = eveningAssignments.get(v);
  if (!cached || cached.key != key || pools.some((pool, i) => pool !== cached.pools[i])) {
    const visitors = places.map(() => []);
    for (const person of villagers) {
      const venue = Math.floor(hashUnit(person + ":evening:" + Math.floor(state.days)) * places.length);
      visitors[venue]?.push(person);
    }
    const assignments = new Map(), owners = new Map();
    const preferences = new Map(visitors.flatMap((people, i) => people.map(person => [person, { id: places[i], points: pools[i] }])));
    const pointKey = p => p.x + "," + p.y;
    // Prefer an unoccupied nearby space. If a later venue has fewer options,
    // an augmenting path can free its space without dropping either visitor.
    const assign = (person, seen) => {
      const { id, points } = preferences.get(person);
      for (const p of points) if (!owners.has(pointKey(p))) {
        owners.set(pointKey(p), person);
        assignments.set(person, { id, ...p });
        return true;
      }
      for (const p of points) {
        const k = pointKey(p);
        if (seen.has(k)) continue;
        seen.add(k);
        if (assign(owners.get(k), seen)) {
          owners.set(k, person);
          assignments.set(person, { id, ...p });
          return true;
        }
      }
      return false;
    };
    // Take turns across venues so both get their nearest spaces first.
    for (let i = 0; i < Math.max(0, ...visitors.map(people => people.length)); i++) {
      for (const people of visitors) if (people[i]) assign(people[i], new Set());
    }
    // A full green can use the village's alehouse (or another local venue).
    // Exhaust preferred-venue matching first; overflow uses remaining spaces,
    // rather than distant ground or an absent coordinate for that visitor.
    for (const person of villagers.filter(person => !assignments.has(person))) {
      for (const [i, id] of places.entries()) {
        const p = pools[i].find(p => !owners.has(pointKey(p)));
        if (!p) continue;
        owners.set(pointKey(p), person);
        assignments.set(person, { id, ...p });
        break;
      }
    }
    cached = { key, pools, assignments };
    eveningAssignments.set(v, cached);
  }
  if (cached.assignments.has(actorId)) return cached.assignments.get(actorId);
  if (!villagers.includes(actorId)) return null;
  // New arrivals can fill a clearing. They stay at their own family house
  // until a space is free, rather than walking towards an undefined point.
  const houseId = state.ecs.household?.[actorId]?.houseId;
  const home = state.ecs.spatial?.[houseId];
  return home ? { id: houseId, x: home.x, y: home.y } : null;
}
