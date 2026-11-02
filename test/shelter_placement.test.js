import { canPlaceShelter, placeShelter } from "game/construction";
import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";

it("offers only one nearby site, rejects occupied tiles and upgrades only the player's shelter", () => {
  const { state, tiles, villager } = rowOfTiles(6);
  state.ui.playerId = villager;
  state.ecs.building = {};
  newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: villager } }]);
  expect(canPlaceShelter(state, tiles[5])).toBe(false);
  const site = placeShelter(state, tiles[1]);
  expect(site).toBeTruthy();
  expect(placeShelter(state, tiles[2])).toBeNull();
  expect(placeShelter(state, site)).toBeNull();
});

it("does not place a site on nearby land disconnected from the camp", () => {
  const { state, tiles, villager } = rowOfTiles(3);
  state.ui.playerId = villager;
  state.ecs.building = {};
  newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: villager } }]);
  for (const id of tiles) state.ecs.walkable[id].neighbours = {};
  expect(canPlaceShelter(state, tiles[1])).toBe(false);
});
