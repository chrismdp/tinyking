import { Hex, Grid } from "game/hex";
import { deleteEntity } from "game/entities";
import { topController } from "game/playable";

// Conservative horizontal envelope of every rendered mature crown, including
// the strongest storm sway. Seedlings reserve their eventual full-size crown.
export const MATURE_CANOPY_RADIUS = 48;
const HOUSE = { halfWidth: 45.5, halfDepth: 30.1 };
export function buildingFootprint(state, id) {
  const e = state.ecs, p = e.spatial[id];
  if (!p) return null;
  const kind = e.meetingPlace?.[id]?.kind;
  let size;
  if (e.building?.[id] || e.shelter?.[id]) size = HOUSE;
  else if (kind == "alehouse") size = { halfWidth: 30, halfDepth: 34 };
  else if (kind == "chapel") size = { halfWidth: 26, halfDepth: 26 };
  else if (e.workplace?.[id]) size = { halfWidth: 31, halfDepth: 45 };
  else return null;
  return { x: p.x, y: p.y, ...size, angle: e.building?.[id] ? -2 * Math.PI * (e.building[id].entrance - 1) / 6 : 0,
    // A body-width approach from the rendered door to the next tile.
    door: { halfWidth: 15, from: size.halfDepth, to: 108 } };
}
function intersects(p, f, radius = MATURE_CANOPY_RADIUS) {
  const dx=p.x-f.x, dy=p.y-f.y, c=Math.cos(f.angle), s=Math.sin(f.angle);
  const x=dx*c-dy*s, y=dx*s+dy*c;
  const box = (hw, lo, hi) => Math.hypot(Math.max(0, Math.abs(x)-hw), Math.max(lo-y, 0, y-hi)) <= radius;
  return box(f.halfWidth, -f.halfDepth, f.halfDepth) || box(f.door.halfWidth, f.door.from, f.door.to);
}
function treesInFootprint(state, footprint) {
  const hex=Hex().fromPoint(footprint), ids=[];
  for (const h of Grid.hexagon({center:hex,radius:Math.ceil((Math.hypot(footprint.halfWidth,Math.max(footprint.halfDepth,footprint.door.to))+MATURE_CANOPY_RADIUS)/Hex().height())+1})) for(const id of state.space[h] || []) {
    if ((state.ecs.tree?.[id] || state.ecs.good?.[id]?.type == "wood" && !state.ecs.haulable?.[id]) && intersects(state.ecs.spatial[id],footprint)) ids.push(id);
  }
  return ids;
}
export function canClearForBuilding(state, footprint, owner) {
  return treesInFootprint(state,footprint).every(id => !state.ecs.controllable?.[id] || topController(state.ecs,id) == owner);
}
// Call only after placement/ownership validation. The reservation is keyed by
// the real entity, so upgrades replace it and demolition stops excluding growth.
// Clearance destroys standing timber without creating harvestable logs.
export function reserveBuildingClearance(state, id, footprint = buildingFootprint(state, id)) {
  if (!footprint) return [];
  const owner=state.ecs.controllable?.[id] ? topController(state.ecs,id) : null;
  if (!canClearForBuilding(state,footprint,owner)) throw new Error("Building would clear another owner's trees");
  (state.ecs.treeClearance ||= {})[id]={id,...footprint};
  const removed=treesInFootprint(state,footprint);
  for(const tree of removed) deleteEntity(state,tree);
  return removed;
}
export function treeAllowed(state, point) {
  return !Object.values(state.ecs.treeClearance || {}).some(f => state.ecs.spatial[f.id] && intersects(point,f));
}
