import { peopleWorld } from "./support/people";
import { createPossession } from "game/possessions";
import { giftChoices } from "game/gift_choices";
import { collect_gift, talk } from "game/tasks";
import { Task } from "game/htn";

it("keeps unique gifts separate and preserves identity, maker, inscription and owner chain on real delivery", () => {
  const { state: s, player, person } = peopleWorld();
  const a = createPossession(s, player, "Alice's brooch", "heirloom");
  const b = createPossession(s, player, "Edith's brooch", "heirloom");
  s.ecs.possession[a].inscription = "For Alice";
  expect(giftChoices(s, player).map(c => c.gift.sourceId)).toEqual(expect.arrayContaining([a, b]));
  expect(giftChoices(s, player).filter(c => c.gift.type == "heirloom")).toHaveLength(2);
  const w = s.ecs.planner[player].world;
  s.ecs.spatial[player] = { ...s.ecs.spatial[person] };
  s.ecs.manager[player].jobs.push({ assignedId: player, gift: { sourceId: a, type: "heirloom" } });
  expect(collect_gift(s, player, w, 0, true, a, "heirloom")).toBe(Task.FINISH);
  talk(s, player, w, 0, true, person, "give_gift");
  expect(talk(s, player, w, 1, false, person, "give_gift")).toBe(Task.FINISH);
  expect(s.ecs.possession[a]).toMatchObject({ name: "Alice's brooch", ownerId: person, maker: player, inscription: "For Alice" });
  expect(s.ecs.possession[a].owners.map(o => o.personId)).toEqual([player, person]);
  expect(s.ecs.possession[b].ownerId).toBe(player);
});

it("keeps a personal gift safe when both working hands are full", () => {
  const { state: s, player } = peopleWorld();
  const item = createPossession(s, player, "Carved box", "heirloom");
  s.ecs.holder[player].held = ["left", "right"]; s.ecs.holder[player].capacity = 2;
  s.ecs.manager[player].jobs.push({ assignedId: player });
  expect(collect_gift(s, player, s.ecs.planner[player].world, 0, true, item, "heirloom")).toBe(Task.ABORT);
  expect(s.ecs.possession[item].carried).toBe(true);
});
