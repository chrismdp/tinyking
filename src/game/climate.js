import { Hex } from "game/hex";
import { HOUR, DAYS_IN_SEASON, season } from "game/time";
import crops from "data/crops.json";

// The existing twelve-day year: summer lifts the snowline, winter lowers it.
// Altitude is physical ground height; biome temperature remains a visual/ecology band.
export function snowlineAt(tile, days) {
  const warmth = Math.sin(2 * Math.PI * (days - DAYS_IN_SEASON / 2) / (4 * DAYS_IN_SEASON));
  const w=tile.climateWarmth;
  const base = Number.isFinite(w) ? (w<.5 ? 230+500*w : 480+600*(w-.5)) : { hot: 780, temperate: 480, cold: 230 }[tile.climateTemperature || tile.temperature || "temperate"];
  return base + 450 * warmth;
}
export const frozenAt = (tile, days) => tile.elevation != null ? tile.elevation >= snowlineAt(tile, days) :
  tile.temperature == "cold" || tile.temperature == "temperate" && season(days) == "winter";

const stationaryTiles=new WeakMap();
export function climateTile(state, id) {
  if (state.ecs?.mappable?.[id]) return state.ecs.mappable[id];
  const point = state.ecs?.spatial?.[id];
  if(!point)return {};
  const cached=point.immovable && stationaryTiles.get(point);
  if(cached && cached.x==point.x && cached.y==point.y && cached.tiles===state.ecs.mappable && cached.space===state.space)return state.ecs.mappable[cached.id] || {};
  const tile=(state.space?.[Hex().fromPoint(point)] || []).find(e=>state.ecs.mappable?.[e]);
  if(point.immovable && tile)stationaryTiles.set(point,{x:point.x,y:point.y,tiles:state.ecs.mappable,space:state.space,id:tile});
  return state.ecs.mappable?.[tile] || {};
}
export const growingAt = (state, id) => season(state.days) != "winter" &&
  (climateTile(state,id).elevation == null || !frozenAt(climateTile(state,id), state.days));

export function updateCrops(state) {
  for (const [id, farm] of Object.entries(state.ecs.farmable || {})) {
    if (!growingAt(state, id)) continue;
    for (const slot of farm.slots) if (slot.content && slot.state == "sown") {
      slot.growth = (slot.growth || 0) + HOUR;
      if (slot.growth + 1e-12 >= crops[slot.content].growingTime) {
        slot.state = "harvestable";
        slot.amount = crops[slot.content].harvestableAmount;
      }
      state.redraws.push(id);
    }
  }
}
