import { Hex, Grid, ALL_SIDES } from "game/hex";
import { TRIANGLES } from "game/map";
import { newEntities, deleteEntity } from "game/entities";
import { hashUnit } from "game/math";
import { season } from "game/time";

export const TRADES = ["smith", "carpenter", "weaver", "baker", "tanner", "miller"];
export const TRADE_LABELS = {
  smith: "at_forge", carpenter: "carpentry", weaver: "weaving",
  baker: "baking", tanner: "tanning", miller: "milling"
};
const BACKYARDS = ["vegetable", "chicken", "pig", "goat", "beehives"];
const keyOf = p => Hex().fromPoint(p).toString();

// Reserve whole tiles for fields and yards. The house entrance stays open;
// props use the adjoining yard, leaving the house and its door legible.
export function generateVillageLife(state, seed, start) {
  const ecs = state.ecs;
  state.redraws ||= [];
  const occupied = new Set(Object.keys(ecs.building).map(id => keyOf(ecs.spatial[id])));
  for (const hex of Grid.hexagon({ center: Hex(start), radius: 1 })) occupied.add(hex.toString());
  // Village clearings must preserve the reachable timber promised at arrival.
  for (const id in ecs.good) if (ecs.good[id].type == "wood" &&
    Hex(start).distance(Hex().fromPoint(ecs.spatial[id])) <= 4) occupied.add(keyOf(ecs.spatial[id]));
  const land = Object.keys(ecs.mappable).filter(id => ecs.mappable[id].terrain == "grassland");
  const tileAt = Object.fromEntries(land.map(id => [keyOf(ecs.spatial[id]), id]));
  const reserved = new Set();
  const reserve = id => {
    if (!id) return null;
    const key = keyOf(ecs.spatial[id]);
    occupied.add(key);
    reserved.add(key);
    ecs.mappable[id].villagePlot = true;
    return ecs.spatial[id];
  };
  // Search through the actual navigation graph, so a nearby field is reachable.
  const nearby = (house, reach = 5) => {
    const origin = Hex().fromPoint(ecs.spatial[house]);
    const tile = tileAt[origin];
    const reached = new Set();
    const queue = [tile];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (!id || reached.has(id)) continue;
      reached.add(id);
      for (const n of Object.values(ecs.walkable[id].neighbours)) {
        if (origin.distance(Hex().fromPoint(ecs.spatial[n])) <= reach && !reached.has(n)) queue.push(n);
      }
    }
    return [...reached].filter(id => ecs.mappable[id].terrain == "grassland" && !occupied.has(keyOf(ecs.spatial[id])))
      .sort((a, b) => origin.distance(Hex().fromPoint(ecs.spatial[a])) - origin.distance(Hex().fromPoint(ecs.spatial[b])) || Number(a) - Number(b));
  };
  const add = (point, villageId, components, houseId) => newEntities(state, [{
    spatial: { x: point.x, y: point.y, immovable: true }, village: { villageId },
    ...(houseId ? { controllable: { controllerId: ecs.controllable[houseId].controllerId } } : {}),
    ...components
  }])[0];
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
        animal: { houseId, pastureId: id, kind, phase, radius, facing: phase }
      }]);
    }
    return id;
  };

  let householdIndex = 0;
  for (const [vi, village] of Object.values(state.villages).entries()) {
    village.sharedPlaces = [];
    // The green shares its tile with a well; the rest remain separate places.
    const greenPoint = reserve(nearby(village.houses[0], 4)[0]);
    const green = add(greenPoint, village.id, { nameable: { nickname: "Village green" }, meetingPlace: { kind: "green" } });
    village.sharedPlaces.push(green, add({ x: greenPoint.x - 28, y: greenPoint.y - 23 }, village.id,
      { nameable: { nickname: "Well" }, meetingPlace: { kind: "well" } }));
    if (village.houses.length >= 5) for (const kind of ["chapel", "alehouse"]) {
      const point = reserve(nearby(village.houses[0], 4)[0]);
      village.sharedPlaces.push(add(point, village.id, { nameable: { nickname: kind == "chapel" ? "Chapel" : "Alehouse" }, meetingPlace: { kind } }));
    }
    // First allocate every yard; fields must not take another family's backyard.
    for (const houseId of village.houses) {
      const origin = Hex().fromPoint(ecs.spatial[houseId]);
      const adjacent = Grid.hexagon({ center: origin, radius: 1 }).neighborsOf(origin, ALL_SIDES);
      const entrance = adjacent[ecs.building[houseId].entrance]?.toString();
      const yardTile = nearby(houseId, 1).find(id => keyOf(ecs.spatial[id]) != entrance) || nearby(houseId, 1)[0];
      // A crowded ring can share the house's tile: its rear half is still a yard.
      const yard = reserve(yardTile) || { x: ecs.spatial[houseId].x, y: ecs.spatial[houseId].y - 33 };
      const storeId = ecs.building[houseId].rooms.find(id => ecs.container[id]);
      const household = { id: houseId, farming: true, fields: [], backyards: [], storeId,
        plot: { hexes: [...new Set([origin.toString(), keyOf(yard)])] } };
      ecs.household[houseId] = household;
      const h = village.houses.indexOf(houseId);
      if (h < Math.min(6, village.houses.length - 2)) {
        household.trade = TRADES[(h + vi) % TRADES.length];
        const point = { x: yard.x - 22, y: yard.y };
        household.workplaceId = add(point, village.id, {
          nameable: { nickname: household.trade == "smith" ? "Forge" : household.trade + " workshop" },
          workplace: { houseId, trade: household.trade, power: household.trade == "miller" ? "wind" : null }
        }, houseId);
        const worker = Object.keys(ecs.personable).find(id => ecs.household[id]?.houseId == houseId && ecs.personable[id].age >= 18);
        ecs.profession ||= {};
        ecs.profession[worker] = { id: worker, trade: household.trade, workplaceId: household.workplaceId, houseId };
        ecs.planner[worker].world.profession = { ...ecs.profession[worker] };
      }
      const kinds = [BACKYARDS[householdIndex % BACKYARDS.length]];
      if (hashUnit(seed + ":backyard:" + houseId) < 0.6) kinds.push(BACKYARDS[(householdIndex + 2) % BACKYARDS.length]);
      for (const [i, kind] of kinds.entries()) {
        const point = { x: yard.x + 23, y: yard.y + (i ? 23 : -23) };
        const id = add(point, village.id, { nameable: { nickname: kind == "vegetable" ? "Kitchen garden" : kind }, backyard: { houseId, kind } }, houseId);
        household.backyards.push(id);
        if (["chicken", "pig", "goat"].includes(kind)) enclosure(point, village.id, houseId, kind, 18, 16, kind == "chicken" ? 4 : 2, id);
      }
      householdIndex++;
    }
    for (const houseId of village.houses) {
      const h = ecs.household[houseId];
      const count = hashUnit(seed + ":fields:" + houseId) < 0.5 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const point = reserve(nearby(houseId)[0]);
        if (!point) break;
        const growth = season(state.days) == "winter" ? 0 : 1.5 + hashUnit(seed + ":crop:" + houseId + ":" + i) * 2;
        const id = add(point, village.id, {
          nameable: { nickname: "Family field" },
          farmable: { houseId, claimerId: null, slots: TRIANGLES.map(() => ({ state: "sown", content: "grain", growth, updated: state.days - growth })) }
        }, houseId);
        h.fields.push(id);
        h.plot.hexes.push(keyOf(point));
      }
    }
    // A modest flock on grassland, where there is room beyond the yards.
    const pasturePoint = reserve(nearby(village.houses[0])[0]);
    if (pasturePoint) enclosure(pasturePoint, village.id, village.houses[0], vi % 2 ? "cow" : "sheep", 39, 34, vi % 2 ? 3 : 5);
  }
  // Clear only the reserved village land, before woodland ecology is initialized.
  for (const id of Object.keys(ecs.good)) if (ecs.good[id].type == "wood" && reserved.has(keyOf(ecs.spatial[id]))) deleteEntity(state, id);
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

export function eveningPlace(state, actorId) {
  const v = state.villages?.[state.ecs.village?.[actorId]?.villageId];
  if (!v) return null;
  const places = v.sharedPlaces.filter(id => ["green", "alehouse"].includes(state.ecs.meetingPlace[id].kind));
  const id = places[Math.floor(hashUnit(actorId + ":evening:" + Math.floor(state.days)) * places.length)];
  const p = state.ecs.spatial[id];
  const phase = hashUnit(actorId + ":gather") * Math.PI * 2;
  return { id, x: p.x + Math.sin(phase) * 24, y: p.y + Math.cos(phase) * 20 };
}
