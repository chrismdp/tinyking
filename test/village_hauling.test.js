import { walk_to } from "game/tasks";
import { Task } from "game/htn";
import { rowOfTiles } from "./support/world";

it("forgets a cached loose grain target already taken by another family member", () => {
  const { state, villager } = rowOfTiles(2);
  const world = { places: { "haulable_with grain": "already-eaten" } };
  expect(walk_to(state, villager, world, 0, true, "haulable_with grain")).toBe(Task.ABORT);
  expect(world.places["haulable_with grain"]).toBeUndefined();
});
