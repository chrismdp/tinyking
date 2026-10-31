/* eslint-disable no-undef */
require("./game-register");
const { Hex } = require("../src/game/hex");
const { path } = require("../src/game/pathfinding");
const { canPlaceField, tileContents } = require("../src/game/land_use");
const { designationPlants, clearableForage } = require("../src/game/designation");
const { resourcePermission } = require("../src/game/village_customs");

// Read-only selection on the actual snapshot. Trees are returned for explicit
// Cut down orders; they are never removed from the snapshot or the game here.
async function designationTerrain(page, allowTrees = false) {
  const s = await page.evaluate(() => {
    const s = window.tinyking;
    return { ecs: s.ecs, space: s.space, villages: s.villages, landUseRevision: s.landUseRevision, ui: { playerId: s.ui.playerId } };
  });
  const e = s.ecs, actor = s.ui.playerId, p = e.spatial[actor];
  const known = new Set(e.playable[actor].known.map(h => String(Hex(h))));
  const key = id => String(Hex().fromPoint(e.spatial[id]));
  const start = tileContents(s, actor).find(id => e.mappable[id]);
  return Object.keys(e.mappable).filter(id => known.has(key(id)) && canPlaceField(s, id) && resourcePermission(s, actor, id).permitted)
    .map(id => {
      const others = tileContents(s, id).filter(other => other != id && other != actor);
      const treeComponents = new Set(["spatial", "nameable", "good", "tree", "controllable"]);
      const trees = others.filter(other => e.good?.[other]?.type == "wood" && !e.haulable?.[other] &&
        Object.keys(e).every(component => !e[component]?.[other] || treeComponents.has(component)) &&
        resourcePermission(s, actor, other).permitted);
      const eligible = allowTrees ? others.every(other => trees.includes(other) || clearableForage(s, actor, other)) : designationPlants(s, actor, id) !== null;
      return { id, trees, eligible, distance: Math.hypot(e.spatial[id].x - p.x, e.spatial[id].y - p.y) };
    }).filter(c => c.eligible && path(s, start, c.id, (a, b) => known.has(key(b))))
    .sort((a, b) => a.trees.length - b.trees.length || a.distance - b.distance);
}
module.exports = { designationTerrain };
