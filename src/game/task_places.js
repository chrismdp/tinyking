import { Hex } from "game/hex";
import { topController } from "game/playable";

export function taskPlace(state, targetId) {
  const { ecs } = state;
  const point = ecs.spatial[targetId];
  if (!point) return "";
  const at = Hex().fromPoint(point);
  const home = Object.keys(ecs.shelter || {}).find(id => ecs.shelter[id].stage &&
    topController(ecs, id) == state.ui.playerId);
  if (home && at.distance(Hex().fromPoint(ecs.spatial[home])) <= 1) return "by your " + ecs.shelter[home].stage;
  const camp = Object.keys(ecs.camp || {})[0];
  const from = camp && Hex().fromPoint(ecs.spatial[camp]);
  if (from && at.distance(from) <= 1) return "at camp";
  const villages = Object.values(state.villages || {}).map(v => ({ ...v, distance: at.distance(Hex(v.centre)) }))
    .sort((a, b) => a.distance - b.distance);
  const village = villages[0];
  if (village?.distance <= 3) {
    const inside = village.distance <= 1 || village.houses.some(id => ecs.spatial[id] &&
      at.distance(Hex().fromPoint(ecs.spatial[id])) == 0);
    return (inside ? "in " : "near ") + village.name;
  }
  const ids = [targetId, ...(state.space?.[at] || [])];
  const tile = ids.find(id => ecs.mappable?.[id]);
  const terrain = ids.some(id => ecs.tree?.[id] || (ecs.good?.[id]?.type == "wood" && !ecs.haulable?.[id])) ? "woods" :
    ids.some(id => ecs.farmable?.[id]) ? "field" : ecs.mappable?.[tile]?.terrain || "land";
  if (!from) return terrain;
  const origin = from.toPoint();
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
  const directions = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  const direction = directions[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  return `${terrain} ${direction} of camp · ${at.distance(from)} hexes`;
}
