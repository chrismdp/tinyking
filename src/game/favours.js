import { isResident } from "game/residents";
import { topController } from "game/playable";
import { Hex } from "game/hex";
import { giftOptions, beginInteraction, addGoodwill } from "game/people";
import { enqueueTask, playerOrderAllowed } from "game/manager";
import { recordEvent } from "game/events";
import { take } from "game/holder";

export const FUEL_TRADES = { baker: "oven", smith: "forge" };
export const FUEL_HOURS = 4;
const live = (s, id) => isResident(s,id) && s.ecs.personable?.[id] && !s.ecs.personable[id].dead;
export const requestForTask = (s, task) => s.favours?.requests[task?.favourId];
export const householdStore = (s, house) => s.ecs.household?.[house]?.storeId;
export function fuelReady(s, workplaceId) {
  const w = s.ecs.workplace?.[workplaceId];
  return !!w && (!FUEL_TRADES[w.trade] || w.fuelHours > 0 || s.ecs.container?.[householdStore(s, w.houseId)]?.amounts.wood > 0);
}
const residents = (s, house) => Object.keys(s.ecs.personable || {}).filter(id => live(s, id) && s.ecs.household?.[id]?.houseId == house);
const foods = ["gruel", "grain", "forage"];
// One inventory pass per needs update, rather than one full good scan for
// every household. These transient indices preserve the existing access rule.
function householdFood(s) {
  const ecs = s.ecs, stores = new Map(), owners = new Map(), homes = new Map(), totals = new Map();
  for (const [house, h] of Object.entries(ecs.household || {})) if (h.storeId) stores.set(h.storeId, house);
  for (const id of Object.keys(ecs.personable || {})) if (live(s, id) && ecs.household?.[id]?.houseId) {
    const house = ecs.household[id].houseId, owner = topController(ecs, id);
    homes.set(id, house);
    if (!owners.has(owner)) owners.set(owner, new Set());
    owners.get(owner).add(house);
  }
  const add = (house, amount) => { if (house) totals.set(house, (totals.get(house) || 0) + amount); };
  for (const [id, c] of Object.entries(ecs.container || {})) {
    const house = stores.get(id) || ecs.interior?.[id]?.buildingId;
    if (house) for (const type of foods) add(house, c.amounts[type] || 0);
  }
  for (const [id, good] of Object.entries(ecs.good || {})) if (foods.includes(good.type) && !ecs.possession?.[id]) {
    const house = ecs.household?.[id]?.houseId || ecs.interior?.[id]?.buildingId;
    const reachable = house ? new Set([house]) : new Set(ecs.controllable[id] ? owners.get(topController(ecs, id)) : []);
    const heldHome = homes.get(ecs.haulable?.[id]?.heldBy);
    if (heldHome) reachable.add(heldHome);
    for (const home of reachable) add(home, good.amount);
  }
  return totals;
}
function foodReserve(s, house) { return householdFood(s).get(house) || 0; }
export function reasonGone(s, r, food) {
  const ecs = s.ecs;
  if (!live(s, r.giverId)) return "The requester died";
  if (ecs.household?.[r.giverId]?.houseId != r.householdId) return "The requester moved home";
  const store = householdStore(s, r.householdId);
  if (!ecs.container?.[store] || !ecs.spatial[store] || !ecs.spatial[r.targetId]) return "The household target is gone";
  if (r.kind == "harvest") {
    if (r.produced > r.delivered + r.cargo.reduce((n, id) => n + (ecs.good[id]?.amount || 0), 0)) return "Harvest cargo no longer available";
    if (!ecs.farmable?.[r.targetId] || ecs.farmable[r.targetId].houseId != r.householdId) return "The family field is gone";
    if (r.progress < r.quantity && !ecs.farmable[r.targetId].slots.some(slot => slot.state == "harvestable")) return "The harvest need is already met";
  }
  if (r.kind == "wood") {
    const w = ecs.workplace?.[r.workplaceId];
    if (!w || !FUEL_TRADES[w.trade]) return "The household target is gone";
    if ((ecs.container[store].amounts.wood || 0) > 0 || w.fuelHours > 0) return "The fuel need is already met";
  }
  if (r.kind == "food" && (food ? food.get(r.householdId) || 0 : foodReserve(s, r.householdId)) >= residents(s, r.householdId).length * 2) return "The food need is already met";
  return null;
}

export function releaseFavourCargo(s, r) {
  if (r.kind != "harvest") return;
  for (const id of r.cargo) {
    if (s.ecs.haulable?.[id]) delete s.ecs.haulable[id].reservedFor;
    if (s.ecs.haulable?.[id]?.heldBy != s.ui.playerId) continue;
    take(s.ecs, id);
    Object.assign(s.ecs.spatial[id], { x: s.ecs.spatial[s.ui.playerId].x, y: s.ecs.spatial[s.ui.playerId].y });
    const space = s.space[Hex().fromPoint(s.ecs.spatial[id])];
    if (space && !space.includes(id)) space.push(id);
    s.redraws.push(id, s.ui.playerId);
  }
}
export function cancelFavour(s, r) {
  if (!r || r.status != "accepted") return;
  r.status = "cancelled"; r.outcome = "Cancelled · work already done stays done; no goodwill";
  releaseFavourCargo(s, r);
}

export function updateFavours(s) {
  const ecs = s.ecs, player = s.ui?.playerId;
  if (!player || !ecs.personable?.[player]) return;
  s.favours ||= { nextId: 0, requests: {} };
  const food = householdFood(s);
  for (const r of Object.values(s.favours.requests)) if (["offered", "accepted"].includes(r.status)) {
    const gone = reasonGone(s, r, food);
    if (gone) { r.status = "expired"; r.outcome = gone + " · no goodwill"; releaseFavourCargo(s, r); }
  }
  for (const [house, h] of Object.entries(ecs.household || {})) {
    if (!h.storeId || !ecs.container?.[h.storeId]) continue;
    const family = residents(s, house).filter(id => id != player && ecs.personable[id].age >= 18).sort();
    const head = ecs.controllable[house]?.controllerId;
    const giverId = family.includes(head) ? head : family[0]; if (!giverId) continue;
    const offer = (kind, targetId, quantity, reason, extra = {}) => {
      if (Object.values(s.favours.requests).some(r => r.householdId == house && r.kind == kind && ["offered", "accepted"].includes(r.status))) return;
      const id = (s.ecs.namespace || "") + "favour-" + ++s.favours.nextId;
      s.favours.requests[id] = { id, giverId, householdId: house, kind, reason, targetId, quantity,
        progress: 0, delivered: 0, produced: 0, goodwill: kind == "wood" ? 12 : quantity * 4,
        status: "offered", cargo: [], createdDay: s.days, ...extra };
    };
    const field = (h.fields || []).find(id => ecs.farmable?.[id]?.houseId == house && ecs.farmable[id].slots.some(slot => slot.state == "harvestable"));
    if (field) offer("harvest", field, Math.min(3, ecs.farmable[field].slots.filter(slot => slot.state == "harvestable").length), "The family crop is ready");
    const w = ecs.workplace?.[h.workplaceId];
    if (w && FUEL_TRADES[w.trade] && !(w.fuelHours > 0) && !(ecs.container[h.storeId].amounts.wood > 0)) {
      offer("wood", h.storeId, 1, `The ${FUEL_TRADES[w.trade]} needs fuel · one log fuels four hours of work`, { workplaceId: h.workplaceId });
    }
    const deficit = residents(s, house).length * 2 - (food.get(house) || 0);
    if (deficit > 0) offer("food", h.storeId, Math.min(3, deficit), "The household has less than two meals each");
  }
  // Nearby encounters teach requests through the same knowledge record as news
  // and learned people. A known name elsewhere never reveals a hidden need.
  for (const r of Object.values(s.favours.requests)) if (r.status == "offered" && nearbyRequester(s, r.giverId)) {
    s.knowledge ||= {};
    const knowledge = s.knowledge[player] ||= { people: {}, feelings: {} };
    // Hearing a nearby resident ask makes their visible Public name known,
    // without meeting them, learning traits or revealing their relatives.
    knowledge.people[r.giverId] ||= { traits: [] };
    knowledge.favours ||= [];
    if (!knowledge.favours.includes(r.id)) knowledge.favours.push(r.id);
  }
}
function nearbyRequester(s, id) {
  const p = s.ecs.spatial[s.ui.playerId], q = s.ecs.spatial[id];
  if (!p || !q || (p.x-q.x)**2 + (p.y-q.y)**2 > 300**2) return false;
  const at = Hex().fromPoint(q);
  return (s.ecs.playable?.[s.ui.playerId]?.known || []).some(k => k.x == at.x && k.y == at.y);
}
export function visibleFavours(s, personId) {
  const learned = new Set(s.knowledge?.[s.ui.playerId]?.favours || []);
  return Object.values(s.favours?.requests || {}).filter(r => learned.has(r.id) && (!personId || r.giverId == personId || s.ecs.household?.[personId]?.houseId == r.householdId));
}
// A met adult can ask for the same real household need in person. The
// accepted request names that person, and keeps the existing delivery reward.
export function canRequestForHousehold(s, request, personId) {
  return live(s, personId) && s.ecs.personable[personId].age >= 18 &&
    s.ecs.household?.[personId]?.houseId == request.householdId &&
    !!s.knowledge?.[s.ui.playerId]?.people?.[personId]?.conversation;
}
export function acceptFavour(s, id, personId) {
  if (!playerOrderAllowed(s,"favour")) return null;
  updateFavours(s);
  const r = s.favours?.requests[id];
  if (!r || r.status != "offered" || !visibleFavours(s).includes(r)) return null;
  let giverId=r.giverId;
  if(personId && personId!=giverId) {
    if(!canRequestForHousehold(s,r,personId))return null;
    giverId=personId;
  }
  const task=enqueueTask(s,{key:"favour"},r.targetId,{favourId:id,forId:giverId,expectedGoodwill:r.goodwill});
  if(!task)return null;
  if(giverId!=r.giverId){r.offeredBy=r.giverId;r.giverId=giverId;}
  beginInteraction(s,s.ui.playerId,giverId);
  r.status="accepted";r.acceptedDay=s.days;r.actorId=s.ui.playerId;r.taskId=task.id;
  return task;
}
export function finishFavour(s, r) {
  if (!r || r.actorId && r.actorId != s.ui.playerId || s.ecs.personable[s.ui.playerId]?.dead || r.status != "accepted" || r.progress < r.quantity || r.cargo.length || r.delivered < r.produced) return false;
  r.status = "completed"; r.completedDay = s.days;
  r.outcome = `Completed · +${r.goodwill} goodwill with the requester`;
  addGoodwill(s, s.ui.playerId, r.giverId, r.goodwill);
  recordEvent(s, "favour", [s.ui.playerId, r.giverId], [], { favourId: r.id, kind: r.kind, quantity: r.quantity, goodwill: r.goodwill, place: r.householdId });
  return true;
}
export function favourSource(s, r) {
  return giftOptions(s, s.ui.playerId).find(g => !g.possession && (r.kind == "wood" ? g.type == "wood" : foods.includes(g.type)));
}
export function favourWaiting(s, task) {
  const r = requestForTask(s, task);
  if (!r) return "Request gone";
  if (r.status != "accepted") return r.outcome || r.status;
  const ecs = s.ecs;
  const store = ecs.container?.[householdStore(s, r.householdId)];
  if (!store) return "The household target is gone";
  if (Object.values(store.amounts).reduce((n, a) => n + a, 0) >= store.capacity) return "Household store is full";
  if (r.kind == "harvest") {
    const field = ecs.farmable?.[r.targetId];
    if (field?.claimerId && field.claimerId != s.ui.playerId) return "Waiting for the family to finish this patch";
  } else if (!r.cargo.some(id => ecs.haulable?.[id]?.heldBy == s.ui.playerId) && !favourSource(s, r)) return `Needs your ${r.kind == "wood" ? "wood · queue Chop wood" : "food · gather some first"}`;
  return null;
}
export const favourTitle = r => r?.kind == "harvest" ? "Help with the harvest" : r?.kind == "wood" ? "Deliver wood" : "Deliver food";
export const favourQuantity = r => `${r.quantity} ${r.kind == "harvest" ? "crop patches" : r.kind == "wood" ? "log" : "food portions"}`;
