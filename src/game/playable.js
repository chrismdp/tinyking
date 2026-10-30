export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}

export function directlyControlledBy(ecs, id) {
  return Object.values(ecs.controllable).filter(c => c.controllerId == id && c.id != c.controllerId);
}

export function anyControlledAlive(ecs, playableId) {
  return [playableId, ...directlyControlledBy(ecs, playableId).map(c => c.id)]
    .map(id => ecs.personable[id])
    .some(p => p && !p.dead);
}

export function topController(ecs, id) {
  if (!ecs.controllable[id]) {
    throw "Called topController on " + id + " which isn't a controllable entity";
  }

  const controllerId = ecs.controllable[id].controllerId;
  if (controllerId == id) {
    return id;
  } else {
    return topController(ecs, controllerId);
  }
}

// A resident works and eats in their own household even when somebody elsewhere
// inherited the building. Ownership remains in controllable; this is use access.
export function householdAccess(ecs, actorId, assetId) {
  const assetHouse = ecs.household?.[assetId]?.houseId ||
    ecs.farmable?.[assetId]?.houseId || ecs.workplace?.[assetId]?.houseId ||
    ecs.interior?.[assetId]?.buildingId || (ecs.building?.[assetId] ? assetId : null);
  if (assetHouse && ecs.household?.[actorId]?.houseId) return ecs.household[actorId].houseId == assetHouse;
  return topController(ecs, actorId) == topController(ecs, assetId);
}
