import { Hex } from "game/hex";
import { giftOptions } from "game/people";

// Group only equivalent goods at the same location. Each button still queues
// one original owned source; its displayed total never becomes a delivery amount.
export function giftChoices(state, actorId) {
  const ecs = state.ecs, choices = new Map();
  for (const gift of giftOptions(state, actorId)) {
    const holder = ecs.haulable?.[gift.sourceId]?.heldBy;
    const building = ecs.interior?.[gift.sourceId]?.buildingId;
    const atHome = building && building == ecs.household?.[actorId]?.houseId;
    const hex = Hex().fromPoint(ecs.spatial[holder || gift.sourceId]);
    const location = `tile ${hex.x}, ${hex.y}`;
    const source = gift.possession?.carried ? "Personal possession" : holder == actorId ? "In your hands" : holder ? "Stockpile · " + location :
      ecs.container?.[gift.sourceId] ? (atHome ? "Home stores" : "Container · " + location) : "On the ground · " + location;
    const key = JSON.stringify([gift.type, gift.value, source, gift.possession ? gift.sourceId : null]);
    if (choices.has(key)) choices.get(key).amount += gift.amount;
    else choices.set(key, { gift, source, amount: gift.amount });
  }
  return [...choices.values()];
}
