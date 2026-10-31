import { entityId, isResident } from "game/residents";
import { recordEvent, closeFamily } from "game/events";

// Personal objects are separate from commodity stacks: identity is never pooled.
export function createPossession(state, ownerId, name, kind = "heirloom") {
  const ecs = state.ecs, id = entityId(ecs, "item-");
  const components = { possession: { name, kind, ownerId, maker: ownerId, originalOwner: ownerId,
    owners: [{ personId: ownerId, day: state.days, reason: "made" }] },
  good: { type: kind, amount: 1, value: kind == "tool" ? 5 : 12 },
  controllable: { controllerId: ownerId }, nameable: { nickname: name },
  spatial: { ...ecs.spatial?.[ownerId] }, haulable: {} };
  for (const [key, value] of Object.entries(components)) (ecs[key] ||= {})[id] = { ...value, id };
  // Personal possessions are carried separately from the two working hands.
  ecs.possession[id].carried = true;
  return id;
}

export function transferPossession(state, itemId, ownerId, reason, fromId) {
  const p = state.ecs.possession?.[itemId];
  const previous = fromId || p?.ownerId;
  if (p) {
    p.ownerId = ownerId;
    // Inheritance changes legal ownership, not another person's working hands.
    if (!state.ecs.haulable?.[itemId]?.heldBy) p.carried = true;
    p.owners.push({ personId: ownerId, day: state.days, reason });
  }
  state.ecs.controllable[itemId].controllerId = ownerId || itemId;
  if (ownerId) recordEvent(state, reason, [previous, ownerId], [itemId]);
}

export function heirFor(state, id) {
  const ecs = state.ecs, kin = ecs.kinship?.[id];
  if (!kin) return null;
  const alive = p => p && p != id && ecs.personable[p] && !ecs.personable[p].dead && !ecs.playable?.[p];
  if (alive(kin.spouse)) return kin.spouse;
  const oldest = ids => ids.filter(alive).sort((a, b) => ecs.personable[b].age - ecs.personable[a].age || a.localeCompare(b))[0];
  const child = oldest(kin.children);
  if (child) return child;
  const seen = new Set([id]), queue = [id];
  while (queue.length) {
    const layer = queue.splice(0).flatMap(p => closeFamily(state, p)).filter(p => !seen.has(p));
    for (const p of layer) seen.add(p);
    const nearest = oldest(layer);
    if (nearest) return nearest;
    queue.push(...layer);
  }
  return null;
}

export function repairHouseholds(state) {
  const ecs = state.ecs;
  // Assets answer to their household, so an heir in another house cannot
  // accidentally merge the two families' fields or permissions.
  for (const key of ["farmable", "workplace", "backyard", "pasture", "animal"]) {
    for (const [id, asset] of Object.entries(ecs[key] || {})) if (asset.houseId) {
      (ecs.controllable ||= {})[id] = { id, controllerId: asset.houseId };
    }
  }
  const bedNeeds = {};
  for(const id of Object.keys(ecs.personable))if(isResident(state,id) && !ecs.personable[id].dead && ecs.household?.[id]?.houseId)bedNeeds[ecs.household[id].houseId]=(bedNeeds[ecs.household[id].houseId] || 0)+1;
  const residents = {};
  for (const id of Object.keys(ecs.personable)) if (isResident(state,id) && !ecs.guest?.[id] && !ecs.personable[id].dead && !ecs.playable?.[id] && ecs.household?.[id]?.houseId) (residents[ecs.household[id].houseId] ||= []).push(id);
  for (const houseId of Object.keys(ecs.building || {})) {
    if (ecs.playable?.[ecs.controllable[houseId]?.controllerId]) continue;
    const members = residents[houseId] || [];
    const old = ecs.controllable[houseId]?.controllerId;
    const head = members.includes(old) ? old : members.sort((a, b) => ecs.personable[b].age - ecs.personable[a].age || a.localeCompare(b))[0];
    if (!ecs.controllable[houseId]) continue;
    // Legal ownership survives an owner's move. Residence determines working
    // permissions separately, so an inherited house cannot annex another home.
    if (!ecs.personable[old] || ecs.personable[old].dead) ecs.controllable[houseId].controllerId = head || houseId;
    for (const id of members) ecs.controllable[id].controllerId = head;
    const household = ecs.household?.[houseId];
    if (household?.trade) {
      const previous = Object.keys(ecs.profession || {}).find(id => ecs.profession[id].houseId == houseId);
      const worker = members.includes(previous) && ecs.personable[previous].age >= 18 ? previous : members.find(id => ecs.personable[id].age >= 18);
      for (const id of Object.keys(ecs.profession || {})) if (ecs.profession[id].houseId == houseId && id != worker) {
        delete ecs.profession[id];
        if (ecs.planner?.[id]) delete ecs.planner[id].world.profession;
      }
      if (worker) {
        (ecs.profession ||= {})[worker] = { id: worker, houseId, trade: household.trade, workplaceId: household.workplaceId };
        if (ecs.planner?.[worker]) ecs.planner[worker].world.profession = { ...ecs.profession[worker] };
      }
    }
    for (const room of ecs.building[houseId].rooms || []) {
      if (ecs.sleepable?.[room]) ecs.sleepable[room].capacity = Math.max(6, members.length, bedNeeds[houseId] || 0, ecs.sleepable[room].capacity || 0);
    }
  }
}

export function die(state, id, cause = "old age") {
  const ecs = state.ecs, person = ecs.personable[id];
  if (person.deathProcessed || ecs.playable?.[id] && cause == "old age") return;
  person.dead = true; person.deathProcessed = true; person.deathCause = cause; person.died = state.days;
  const heir = heirFor(state, id);
  person.heirId = heir;
  recordEvent(state, "death", [id], [], { cause });
  for (const itemId of Object.keys(ecs.possession || {})) if (ecs.possession[itemId].ownerId == id) {
    if (!heir) ecs.possession[itemId].estateOf = id;
    transferPossession(state, itemId, heir, "inheritance", id);
  }
  const houses = Object.keys(ecs.building || {}).filter(h => ecs.controllable[h]?.controllerId == id);
  if (heir && houses.length) recordEvent(state, "inheritance", [id, heir], houses);
  // The estate can be unclaimed. No living person answers to a dead controller.
  for (const [other, c] of Object.entries(ecs.controllable || {})) if (c.controllerId == id) c.controllerId = heir || other;
  ecs.controllable[id].controllerId = id;
  const planner = ecs.planner?.[id];
  if (planner) { planner.task = null; planner.plan = null; planner.world.label = null; delete planner.world.helpingFriend; delete planner.world.friendOffer; }
  for (const farm of Object.values(ecs.farmable || {})) {
    if (farm.claimerId == id) farm.claimerId = null;
    for (const slot of farm.slots) if (slot.workerId == id) delete slot.workerId;
  }
  for (const manager of Object.values(ecs.manager || {})) for (const job of manager.jobs) if (job.assignedId == id) job.assignedId = null;
  for (const bed of Object.values(ecs.sleepable || {})) bed.occupiers = bed.occupiers.filter(p => p != id);
  for (const other of Object.values(ecs.planner || {})) if (other.world.capturedBy == id || other.world.social?.partnerId == id) {
    delete other.world.social; other.world.capturedBy = null; other.task = null; other.plan = null;
  }
  repairHouseholds(state);
  state.redraws?.push(id);
}
