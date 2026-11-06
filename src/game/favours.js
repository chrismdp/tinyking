import { isAdult, LIFE_STAGES } from "game/life_stages";
import { householdMembers } from "game/population_index";
import { harvestFits } from "game/farming";
import { FOODS } from "game/goods";
import { isResident } from "game/residents";
import { topController } from "game/playable";
import { Hex } from "game/hex";
import { giftOptions, addGoodwill, meet } from "game/people";
import { taskPlace } from "game/task_places";
import { enqueueTask, cancelTask, playerOrderAllowed, canReachTask } from "game/manager";
import { recordEvent, knownEvents, closeFamily } from "game/events";
import { take, give } from "game/holder";
import { newEntities } from "game/entities";
import { containerHasSpace } from "game/container";

export const FUEL_TRADES = { baker: "oven", smith: "forge" };
export const FUEL_HOURS = 4;
const live = (s, id) => isResident(s,id) && s.ecs.personable?.[id] && !s.ecs.personable[id].dead;
export const requestForTask = (s, task) => s.favours?.requests[task?.favourId];
// A household's estate can use a room store or the completed shelter itself.
// Resolve only this home: a shared legal owner does not merge family stocks.
export const householdStore = (s, house) => s.ecs.household?.[house]?.storeId ||
  s.ecs.building?.[house]?.rooms?.find(id => s.ecs.container?.[id]) ||
  (s.ecs.container?.[house] ? house : undefined);
// Keep ordinary room-store delivery. A full pantry can instead receive its
// requested log at the actual oven/forge, consuming it into existing fuelHours.
// Resolve at use time so already accepted store-targeted jobs resume unchanged.
export function favourReceiver(s, r) {
  const store = householdStore(s, r.householdId);
  const w = s.ecs.workplace?.[r.workplaceId];
  return r.kind == "wood" && s.ecs.container?.[store] && !containerHasSpace(s.ecs.container[store]) &&
    w?.houseId == r.householdId && FUEL_TRADES[w.trade] ? r.workplaceId : store;
}
export function fuelReady(s, workplaceId) {
  const w = s.ecs.workplace?.[workplaceId];
  return !!w && (!FUEL_TRADES[w.trade] || w.fuelHours > 0 || s.ecs.container?.[householdStore(s, w.houseId)]?.amounts.wood >= 1);
}
const residents = (s, house) => householdMembers(s,house).filter(id => live(s,id));
const foods = FOODS;
// One inventory pass per needs update, rather than one full good scan for
// every household. These transient indices preserve the existing access rule.
export function householdFood(s) {
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
// A synchronous choice query reads one inventory snapshot. Discard it before
// speech, deliveries or any other mutation can make a later query stale.
const foodQueries = new WeakMap();
export function withFavourQuery(s, query) {
  if (foodQueries.has(s)) return query();
  foodQueries.set(s, {});
  try { return query(); } finally { foodQueries.delete(s); }
}
function foodReserve(s, house) {
  const query = foodQueries.get(s);
  const food = query ? (query.food ||= householdFood(s)) : householdFood(s);
  return food.get(house) || 0;
}
export function reasonGone(s, r, food) {
  const ecs = s.ecs;
  if (ASKS.includes(r.kind)) return askGone(s, r);
  if (!live(s, r.giverId)) return "The requester died";
  if (ecs.household?.[r.giverId]?.houseId != r.householdId) return "The requester moved home";
  const store = householdStore(s, r.householdId);
  if (!ecs.container?.[store] || !ecs.spatial[store] || !ecs.spatial[r.targetId]) return "The household target is gone";
  if (r.kind == "harvest") {
    if (r.status=="offered" && harvestOfferQuantity(s,r.targetId)<r.quantity) return "The household no longer has room for this harvest";
    if (r.produced > r.delivered + r.cargo.reduce((n, id) => n + (ecs.good[id]?.amount || 0), 0)) return "Harvest cargo no longer available";
    if (!ecs.farmable?.[r.targetId] || ecs.farmable[r.targetId].houseId != r.householdId) return "The family field is gone";
    if (r.progress < r.quantity && !(r.status == "accepted" && r.progress > 0) && !ecs.farmable[r.targetId].slots.some(slot => slot.state == "harvestable")) return "The harvest need is already met";
  }
  if (r.kind == "wood") {
    const w = ecs.workplace?.[r.workplaceId];
    if (!w || w.houseId != r.householdId || !ecs.spatial[r.workplaceId] || !FUEL_TRADES[w.trade]) return "The household target is gone";
    if ((ecs.container[store].amounts.wood || 0) >= 1 || w.fuelHours > 0) return "The fuel need is already met";
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

// Quote only complete patches that the household can store at offer time.
export function harvestOfferQuantity(s, field) {
  let amount=0, quantity=0;
  for(const slot of s.ecs.farmable[field]?.slots || []) {
    if(slot.state!="harvestable" || quantity>=3)continue;
    if(harvestFits(s,field,amount+slot.amount)){amount+=slot.amount;quantity++;}
  }
  return quantity;
}

export function updateFavours(s) {
  const ecs = s.ecs, player = s.ui?.playerId;
  if (!player || !ecs.personable?.[player]) return;
  s.favours ||= { nextId: 0, requests: {} };
  const food = householdFood(s);
  for (const r of Object.values(s.favours.requests)) if (["offered", "accepted"].includes(r.status)) {
    const gone = reasonGone(s, r, food);
    if (gone) {
      const accepted=r.status=="accepted";
      r.status = "expired"; r.outcome = gone + " · no goodwill"; releaseFavourCargo(s, r);
      for(const task of [...ecs.manager[player].jobs])if(task.favourId==r.id){task.waiting=r.outcome;cancelTask(s,task.id);}
      if(accepted)s.ui.favourNotice={requestId:r.id,text:`${s.personName?.(r.giverId)||"Your neighbour"} no longer needs this help. ${gone}.`};
    }
  }
  for (const [house, h] of Object.entries(ecs.household || {})) {
    if (!h.storeId || !ecs.container?.[h.storeId]) continue;
    const family = residents(s, house).filter(id => id != player && isAdult(ecs.personable[id].age)).sort();
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
    const quantity=field && harvestOfferQuantity(s,field);
    if (quantity) offer("harvest", field, quantity, "The family crop is ready");
    const w = ecs.workplace?.[h.workplaceId];
    if (w && FUEL_TRADES[w.trade] && !(w.fuelHours > 0) && !(ecs.container[h.storeId].amounts.wood >= 1)) {
      offer("wood", h.storeId, 1, `The ${FUEL_TRADES[w.trade]} needs fuel · one log fuels four hours of work`, { workplaceId: h.workplaceId });
    }
    const deficit = residents(s, house).length * 2 - (food.get(house) || 0);
    if (deficit > 0) offer("food", h.storeId, Math.min(3, deficit), "The household has less than two meals each");
  }
  updateAsks(s);
  // An anonymous overheard need is an observation, never an introduction.
  for (const r of Object.values(s.favours.requests)) if (r.status == "offered" && nearbyRequester(s, r.giverId) && !s.knowledge?.[player]?.people?.[r.giverId]?.conversation) {
    s.knowledge ||= {};
    const k = s.knowledge[player] ||= { people: {}, feelings: {} };
    (k.noticedNeeds ||= {})[r.giverId + ":" + r.kind] = { speakerId: r.giverId, kind: r.kind, householdId: r.householdId, workplace_name: FUEL_TRADES[ecs.workplace?.[r.workplaceId]?.trade], day: s.days };
    s.redraws?.push(r.giverId);
  }
}
// Asks come from a person's own recent life: news their kin elsewhere have not
// heard, or a quarrel they would mend. Each names an outcome and completes when
// the simulation records it, however the player brought it about.
export const ASKS = ["word", "peace", "visit", "find"];
const ASK_DAYS = 7, FIND_DAYS = 21, WORD_EVENTS = ["death", "birth", "marriage"];
const pairKey = (a, b) => [a, b].sort().join(":");
function askGone(s, r) {
  if (!live(s, r.giverId)) return "The one who asked has died";
  if (!live(s, r.targetId)) return "The one it was for has died";
  if (s.days - r.createdDay > (r.kind == "find" ? FIND_DAYS : ASK_DAYS)) return "Too late now";
  if (r.kind == "word" && knownEvents(s, r.targetId).some(e => e.id == r.eventId) && !toldByPlayer(s, r)) return "They have heard already";
  if (r.kind == "peace" && r.status == "offered" && reconciled(s, r)) return "They have made it up already";
  return null;
}
const toldByPlayer = (s, r) => s.knowledge?.[r.targetId]?.spokenSources?.[r.eventId]?.speakerId == s.ui.playerId;
const reconciled = (s, r) => (s.events || []).some(e => e.type == "reconciliation" && e.day >= (r.acceptedDay ?? r.createdDay) && pairKey(...e.people) == pairKey(r.giverId, r.targetId));
// A visit counts once the player has talked with them since saying yes.
const talkedSince = (s, r) => (s.knowledge?.[s.ui.playerId]?.people?.[r.targetId]?.conversation?.day ?? -Infinity) >= r.acceptedDay;
// News of someone who left: anything the player has learned that happened to
// them after they went, or a conversation with them.
const newsSince = (s, r) => {
  const left = (s.events || []).find(e => e.id == r.eventId);
  return talkedSince(s, r) || knownEvents(s, s.ui.playerId).some(e => e.id != r.eventId && e.people.includes(r.targetId) && e.day > (left?.day ?? r.createdDay));
};
function askDone(s, r) {
  return r.kind == "word" ? toldByPlayer(s, r) : r.kind == "peace" ? reconciled(s, r) : r.kind == "visit" ? talkedSince(s, r) : newsSince(s, r);
}
function updateAsks(s) {
  const ecs = s.ecs, player = s.ui.playerId, requests = s.favours.requests;
  for (const r of Object.values(requests)) if (ASKS.includes(r.kind) && r.status == "accepted" && askDone(s, r)) {
    r.status = "completed"; r.completedDay = s.days; r.outcome = `Completed · +${r.goodwill} goodwill with the one who asked`;
    addGoodwill(s, player, r.giverId, r.goodwill);
    recordEvent(s, "favour", [player, r.giverId], [], { favourId: r.id, kind: r.kind, quantity: 1, goodwill: r.goodwill, place: r.householdId });
  }
  const open = (kind, giverId) => Object.values(requests).some(r => r.kind == kind && r.giverId == giverId && ["offered", "accepted"].includes(r.status));
  const offer = (kind, giverId, targetId, extra) => {
    const id = (ecs.namespace || "") + "favour-" + ++s.favours.nextId;
    requests[id] = { id, giverId, householdId: ecs.household?.[giverId]?.houseId, kind, targetId, quantity: 1, progress: 0, delivered: 0, produced: 0,
      goodwill: kind == "peace" ? 16 : kind == "visit" ? 6 : 10, status: "offered", cargo: [], createdDay: s.days, ...extra };
  };
  const recent = (s.events || []).filter(e => !e.sealed && s.days - e.day <= ASK_DAYS);
  for (const giverId of Object.keys(ecs.personable || {})) {
    if (giverId == player || !live(s, giverId) || !isResident(s, giverId) || !isAdult(ecs.personable[giverId].age)) continue;
    const village = ecs.village?.[giverId]?.villageId, known = new Set(knownEvents(s, giverId).map(e => e.id));
    if (!open("word", giverId)) {
      const news = recent.find(e => WORD_EVENTS.includes(e.type) && known.has(e.id) && (e.people.includes(giverId) || closeFamily(s, giverId).includes(e.people[0])));
      const kin = news && closeFamily(s, giverId).filter(id => id != player && live(s, id) && !news.people.includes(id) &&
        ecs.village?.[id]?.villageId != village && !knownEvents(s, id).some(e => e.id == news.id)).sort()[0];
      if (kin) offer("word", giverId, kin, { eventId: news.id, reason: "Kin elsewhere have not heard" });
    }
    const kin = closeFamily(s, giverId).filter(id => id != player && live(s, id));
    if (!open("visit", giverId)) {
      const alone = kin.filter(id => ecs.personable[id].age >= LIFE_STAGES.old.from && ecs.household?.[id]?.houseId != ecs.household?.[giverId]?.houseId &&
        !live(s, ecs.kinship?.[id]?.spouse)).sort()[0];
      if (alone) offer("visit", giverId, alone, { reason: "An old relative living alone" });
    }
    if (!open("find", giverId)) {
      // Someone away is no longer a resident here, so look among all close kin who are still alive.
      const away = closeFamily(s, giverId).filter(id => id != player && ecs.personable?.[id] && !ecs.personable[id].dead);
      const left = (s.events || []).filter(e => e.type == "departure" && known.has(e.id) && away.includes(e.people[0]) && ecs.village?.[e.people[0]]?.villageId != village &&
        !(s.events || []).some(x => x.type == "return" && x.people[0] == e.people[0] && x.day >= e.day)).sort((a, b) => b.day - a.day)[0];
      if (left) offer("find", giverId, left.people[0], { eventId: left.id, reason: "Kin who went away" });
    }
    if (!open("peace", giverId)) {
      const quarrel = [...recent].reverse().find(e => e.type == "quarrel" && e.people.includes(giverId) && known.has(e.id));
      const other = quarrel?.people.find(id => id != giverId);
      if (other && other != player && live(s, other) && !(s.events || []).some(e => e.type == "reconciliation" && e.day >= quarrel.day && pairKey(...e.people) == pairKey(giverId, other)))
        offer("peace", giverId, other, { eventId: quarrel.id, reason: "They would mend a quarrel" });
    }
  }
}
export function nearbyRequester(s, id) {
  const p = s.ecs.spatial?.[s.ui?.playerId], q = s.ecs.spatial?.[id];
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
  if (ASKS.includes(request.kind) && personId != request.giverId) return false;
  return live(s, personId) && isAdult(s.ecs.personable[personId].age) &&
    s.ecs.household?.[personId]?.houseId == request.householdId &&
    !!s.knowledge?.[s.ui.playerId]?.people?.[personId]?.conversation;
}
export function acceptFavour(s, id, personId) {
  if (!playerOrderAllowed(s,"favour")) return null;
  updateFavours(s);
  const r = s.favours?.requests[id];
  if (!r || r.status != "offered" || !visibleFavours(s).includes(r)) return null;
  let giverId=personId || r.giverId;
  if (!canRequestForHousehold(s,r,giverId) || s.knowledge?.[s.ui.playerId]?.offers?.[r.id]?.speakerId != giverId) return null;
  if(personId && personId!=giverId) {
    if(!canRequestForHousehold(s,r,personId))return null;
    giverId=personId;
  }
  // An ask names an outcome, not work: the player finds their own way to it.
  if(ASKS.includes(r.kind)) {
    if(personId && personId!=r.giverId)return null;
    meet(s,s.ui.playerId,r.giverId);meet(s,r.giverId,s.ui.playerId);
    r.status="accepted";r.acceptedDay=s.days;r.actorId=s.ui.playerId;
    return r;
  }
  const task=enqueueTask(s,{key:"favour"},r.targetId,{favourId:id,forId:giverId,expectedGoodwill:r.goodwill});
  if(!task)return null;
  if(giverId!=r.giverId){r.offeredBy=r.giverId;r.giverId=giverId;}
  meet(s,s.ui.playerId,giverId);
  meet(s,giverId,s.ui.playerId);
  r.deliveryAuthorised=true;
  r.status="accepted";r.acceptedDay=s.days;r.actorId=s.ui.playerId;r.taskId=task.id;
  return task;
}
// Resume work only when the player deliberately chooses delivery again.
export function resumeFavour(s,id) {
  updateFavours(s);
  const r=s.favours?.requests[id];
  if(!r || r.status!="accepted" || r.actorId!=s.ui.playerId || ASKS.includes(r.kind))return null;
  return s.ecs.manager[s.ui.playerId].jobs.find(j=>j.favourId==id) ||
    enqueueTask(s,{key:"favour"},r.targetId,{favourId:id,forId:r.giverId,expectedGoodwill:r.goodwill});
}
// A settled delivery needs neither spare pantry capacity nor another trip.
export function favourWorkDone(s, r) {
  if (!r || r.status != "accepted") return false;
  const partialHarvest = r.kind == "harvest" && r.progress > 0 &&
    !s.ecs.farmable?.[r.targetId]?.slots.some(slot => slot.state == "harvestable");
  return (r.progress >= r.quantity || partialHarvest) && !r.cargo.length && r.delivered >= r.produced;
}
export function finishFavour(s, r) {
  // Keep delivering the player's real crop when the family finishes first.
  // A completed patch earns its share only after all its yield reaches home.
  if (!favourWorkDone(s, r) || r.actorId && r.actorId != s.ui.playerId || s.ecs.personable[s.ui.playerId]?.dead) return false;
  if (r.kind == "harvest" && r.progress < r.quantity) r.goodwill = r.progress * 4;
  r.status = "completed"; r.completedDay = s.days;
  r.outcome = `Completed · +${r.goodwill} goodwill with the requester`;
  addGoodwill(s, s.ui.playerId, r.giverId, r.goodwill);
  // A household with a surplus can thank a helper with one of its real meals.
  // Never give food back for a food request or take from an already low larder.
  const storeId=householdStore(s,r.householdId),store=s.ecs.container?.[storeId];
  const type=FOODS.find(type=>store?.amounts[type]>=1);
  if(r.kind=="wood" && type && foodReserve(s,r.householdId)>residents(s,r.householdId).length*2+1) {
    store.amounts[type]--;
    const [id]=newEntities(s,[{spatial:{...s.ecs.spatial[s.ui.playerId]},good:{type,amount:1},haulable:{},controllable:{controllerId:s.ui.playerId}}]);
    give(s.ecs,id,s.ui.playerId);
    r.thanksFood={type,amount:1,itemId:id,sourceId:storeId,day:s.days};
    r.outcome+=" · Thank you: "+type;
    const account=s.ecs.household?.[r.householdId]?.estateAccount;
    if(account){account.given ||= {};account.given[type]=(account.given[type] || 0)+1;}
    s.redraws.push(id);
  }

  recordEvent(s, "favour", [s.ui.playerId, r.giverId], [], { favourId: r.id, kind: r.kind, quantity: r.progress, goodwill: r.goodwill, place: r.householdId });
  return true;
}
// Match household reserve membership, including resident hands and accessible
// loose goods. Legal ownership alone does not identify a separate supply.
function inHouseholdReserve(s, house, id) {
  const ecs = s.ecs;
  if (id == householdStore(s, house) || id == house || ecs.interior?.[id]?.buildingId == house || ecs.household?.[id]?.houseId == house) return true;
  if (!ecs.good?.[id]) return false;
  const heldBy = ecs.haulable?.[id]?.heldBy;
  if (heldBy && ecs.household?.[heldBy]?.houseId == house) return true;
  if (ecs.controllable?.[id]) {
    const owner = topController(ecs, id);
    return Object.keys(ecs.personable || {}).some(person => live(s, person) &&
      ecs.household?.[person]?.houseId == house && topController(ecs, person) == owner);
  }
  return false;
}
export function favourSource(s, r) {
  return giftOptions(s, s.ui.playerId).find(g => !g.possession && !inHouseholdReserve(s, r.householdId, g.sourceId) && (r.kind == "wood" ? g.type == "wood" : foods.includes(g.type)));
}
export function favourCargoAvailable(s, r, id) {
  if (r.kind == "harvest") return !!s.ecs.good[id] && !!s.ecs.haulable[id];
  const ecs = s.ecs, good = ecs.good[id], holder = ecs.haulable[id]?.heldBy;
  return (r.externalCargo?.includes(id) || !inHouseholdReserve(s, r.householdId, id)) && good?.amount == 1 && !!ecs.haulable[id] && !ecs.possession?.[id] &&
    !!ecs.controllable[id] && topController(ecs, id) == topController(ecs, s.ui.playerId) &&
    (!holder || holder == s.ui.playerId || !!ecs.stockpile?.[holder]) &&
    (r.kind == "wood" ? good.type == "wood" : foods.includes(good.type));
}
export function favourWaiting(s, task) {
  const r = requestForTask(s, task);
  if (!r) return "Request gone";
  if (r.status != "accepted") return r.outcome || r.status;
  if (favourWorkDone(s, r)) return null;
  const ecs = s.ecs;
  const store = ecs.container?.[householdStore(s, r.householdId)];
  if (!store) return "The household target is gone";
  if (r.kind == "wood" && !containerHasSpace(store) && favourReceiver(s, r) != r.workplaceId) return "Household store is full";
  if (r.kind == "harvest") {
    const field = ecs.farmable?.[r.targetId];
    const ripe=field?.slots.filter(slot=>slot.state=="harvestable") || [];
    if(!r.cargo.length && ripe.length && ripe.every(slot=>slot.workerId && slot.workerId!=s.ui.playerId)) return "Waiting for the family to finish this patch";
    // A claim protects new crop work, not the return trip with cut grain.
    if (!r.cargo.length && field?.claimerId && field.claimerId != s.ui.playerId) return "Waiting for the family to finish this patch";
  } else if (!r.cargo.some(id => ecs.haulable?.[id]?.heldBy == s.ui.playerId && favourCargoAvailable(s, r, id)) && !favourSource(s, r)) return `Needs your ${r.kind == "wood" ? "wood · choose Chop wood" : "food · gather some first"}`;
  return null;
}
// Give a blocked harvest an actual reachable, explored approach and a name.
export function harvestApproach(s, r) {
  const point=s.ecs.spatial[r.targetId], actor=s.ui.playerId;
  if(!point)return null;
  const known=s.ecs.playable?.[actor]?.known || [];
  const candidates=Object.keys(s.ecs.walkable || {}).filter(id=>{
    const at=Hex().fromPoint(s.ecs.spatial[id]);
    return !s.ecs.mappable?.[id]?.buildingPlot && !s.ecs.mappable?.[id]?.cropPlot &&
      !(s.space[at] || []).some(other=>s.ecs.farmable?.[other]) &&
      known.some(k=>k.x==at.x && k.y==at.y);
  });
  candidates.sort((a,b)=>Math.hypot(s.ecs.spatial[a].x-point.x,s.ecs.spatial[a].y-point.y)-Math.hypot(s.ecs.spatial[b].x-point.x,s.ecs.spatial[b].y-point.y));
  const id=candidates.find(id=>canReachTask(s,actor,id));
  return id ? {id,label:"clear ground "+taskPlace(s,id)} : null;
}
export function harvestRouteReason(s,r,stage) {
  const approach=harvestApproach(s,r);
  return `The route to the ${stage} is blocked. `+(approach ? `Choose Move to field approach to reach ${approach.label}, then continue the favour.` : "Show field to inspect it. No explored approach is reachable; explore around the field first.");
}
export const favourTitle = r => r?.kind == "visit" ? "Look in on them" : r?.kind == "find" ? "Find out how they fare" : r?.kind == "word" ? "Carry word" : r?.kind == "peace" ? "Help make peace" : r?.kind == "harvest" ? "Help with the harvest" : r?.kind == "wood" ? "Deliver wood" : "Deliver food";
export const favourQuantity = r => `${r.quantity} ${r.kind == "harvest" ? "crop patches" : r.kind == "wood" ? "log" : "food portions"}`;
