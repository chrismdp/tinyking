export function give(ecs, id, holderId) {
  if (holderId) {
    if (ecs.holder[holderId].held.length >= ecs.holder[holderId].capacity) {
      return false;
    }
    ecs.holder[holderId].held.push(id);
  }

  const previousHolderId = ecs.haulable[id].heldBy;
  if (previousHolderId) {
    const idx = ecs.holder[previousHolderId].held
      .findIndex(heldId => heldId == id);
    if (idx == -1) {
      throw "Hang on: held " + id + " by " + previousHolderId + " has no record of the holding: " + ecs.holder[previousHolderId].held;
    }
    ecs.holder[previousHolderId].held.splice(idx, 1);
  }

  ecs.haulable[id].heldBy = holderId;
  return true;
}

export function take(ecs, id) {
  give(ecs, id, null);
}
