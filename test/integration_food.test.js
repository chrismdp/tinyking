import { community } from "./support/travel";
import { historyStep } from "game/social";

// Offscreen hunger (travel fix) must eat every food the economy fix made edible.
it.each(["bread", "flour"])("offscreen residents eat %s from their household store", food => {
  const { s, ids: [, actor], house } = community();
  s.ecs.household[house].storeId = "pantry";
  s.ecs.household[house].estateAccount = { initial: { [food]: 20 }, consumed: {}, produced: {} };
  s.ecs.container = { pantry: { amounts: { [food]: 20 }, capacity: 30 } };
  s.ecs.interior = { pantry: { buildingId: house } };
  s.ecs.controllable.pantry = { controllerId: house };
  s.ecs.personable[actor].hunger = 5.99;
  const away = historyStep(s, 1);
  expect(away.ecs.personable[actor].dead).toBeUndefined();
  expect(away.ecs.container.pantry.amounts[food]).toBeLessThan(20);
});
