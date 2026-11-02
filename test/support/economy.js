import { rowOfTiles } from "./world";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";

export function economy(count = 14) {
  const { state: s, villager: p, tiles } = rowOfTiles(count);
  s.opinionThresholds = { hate: -100, love: 100 };
  s.ui.playerId = p; s.game_speed = "normal"; s.villages = {};
  s.map = { playerStartTile: { x: 0, y: 0 }, entrances: {} };
  s.ecs.personable = { [p]: { id: p, age: 25, hunger: 0, tiredness: 0 } };
  s.ecs.playable[p] = { id: p, known: [] };
  s.ecs.planner = { [p]: { id: p, world: { ordered: true, places: {}, no_place_for: {}, feeling: {}, holding: {}, days: s.days } } };
  s.ecs.manager = { [p]: { id: p, ordered: true, jobs: [] } };
  s.ecs.building = {}; s.ecs.interior = {}; s.ecs.household = {};
  const [camp] = newEntities(s, [{ spatial: { ...s.ecs.spatial[p], immovable: true }, camp: {}, controllable: { controllerId: p }, sleepable: { capacity: 1, occupiers: [] }, container: { capacity: 200, amounts: { grain: 100 } } }]);
  s.ecs.household[p] = { houseId: camp };
  s.ecs.household[camp] = { id: camp, storeId: camp, fields: [], backyards: [] };
  const sim = createSimulation(s);
  return { s, p, camp, tiles, world: s.ecs.planner[p].world, step(minutes) { for (let i = 0; i < minutes; i++) sim.step(10*(1), 0); } };
}
