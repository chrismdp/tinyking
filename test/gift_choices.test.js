import { giftChoices } from "game/gift_choices";
import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { give } from "game/holder";

it("distinguishes held, loose, stockpiled and home goods, grouping only equivalent portions at a location", () => {
  const { state, player, person, tiles } = peopleWorld();
  const item = (tile, owner = player) => ({ spatial: { ...state.ecs.spatial[tile] }, good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: owner } });
  const [held, loose, loose2, elsewhere, stolen, stockpile, stored, homeStore] = newEntities(state, [
    item(tiles[0]), item(tiles[1]), item(tiles[1]), item(tiles[4]), item(tiles[0], person),
    { spatial: { ...state.ecs.spatial[tiles[2]] }, holder: { held: [], capacity: 10 }, stockpile: {}, controllable: { controllerId: player } }, item(tiles[2]),
    { spatial: { ...state.ecs.spatial[tiles[0]] }, interior: { buildingId: tiles[0] }, container: { amounts: { wood: 3 } }, controllable: { controllerId: player } }
  ]);
  state.ecs.household[player].houseId = tiles[0];
  give(state.ecs, held, player);
  give(state.ecs, stored, stockpile);
  const before = JSON.stringify(state.ecs);
  const choices = giftChoices(state, player);
  expect(choices).toHaveLength(5);
  expect(choices.find(c => c.gift.sourceId == held)).toMatchObject({ source: "In your hands", amount: 1 });
  expect(choices.find(c => c.gift.sourceId == loose)).toMatchObject({ source: expect.stringContaining("On the ground"), amount: 2, gift: { sourceId: loose, type: "wood", amount: 1 } });
  expect(choices.find(c => c.gift.sourceId == stored).source).toContain("Stockpile");
  expect(choices.find(c => c.gift.sourceId == homeStore)).toMatchObject({ source: "Home stores", amount: 3 });
  expect(new Set(choices.map(c => c.source)).size).toBe(5);
  expect(choices.some(c => [loose2, stolen].includes(c.gift.sourceId))).toBe(false);
  expect(choices.find(c => c.gift.sourceId == elsewhere).amount).toBe(1);
  expect(JSON.stringify(state.ecs)).toBe(before);
});
