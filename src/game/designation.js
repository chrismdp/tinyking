import { tileContents } from "game/land_use";
import { resourcePermission } from "game/village_customs";

// Only natural forage can be removed by designation work. Any other entity
// component keeps its existing obstruction, even if it also has forageable.
const plantComponents = new Set(["spatial", "nameable", "forageable", "controllable"]);
export function clearableForage(state, actorId, id) {
  const e = state.ecs;
  return !!e.forageable?.[id] && e.spatial?.[id]?.immovable &&
    Object.keys(e).every(component => !e[component]?.[id] || plantComponents.has(component)) &&
    resourcePermission(state, actorId, id).permitted;
}

// null means blocked; [] means clear. Read live contents/permissions on every
// call, including the final work tick. The working actor may stand on the tile.
export function designationPlants(state, actorId, tileId) {
  const e = state.ecs;
  if (e.personable?.[actorId]?.dead || e.mappable?.[tileId]?.terrain != "grassland" ||
    !resourcePermission(state, actorId, tileId).permitted) return null;
  const contents = tileContents(state, tileId).filter(id => id != tileId && id != actorId);
  return contents.every(id => clearableForage(state, actorId, id)) ? contents : null;
}
