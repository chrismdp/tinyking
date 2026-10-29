import { rowOfTiles } from "./world";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";

export function peopleWorld() {
  const { state, villager: player, tiles } = rowOfTiles(6);
  state.ui.playerId = player;
  state.game_speed = "fast";
  state.peopleSeed = 13;
  state.opinionThresholds = { hate: -100, love: 100 };
  state.villages = { village: { name: "Withyford" } };
  const [person, parent, sibling] = newEntities(state, [30, 60, 28].map(age => ({
    spatial: { ...state.ecs.spatial[tiles[3]] }, personable: { age, hunger: 0, tiredness: 0 },
    holder: { held: [], capacity: 20 }, controllable: { controllerId: player },
    nameable: { male: false, nickname: age == 30 ? "Agnes Miller" : age == 60 ? "Edith Miller" : "Alice Miller" }
  })));
  // Villagers own their households; they are never recruited by interactions.
  for (const id of [person, parent, sibling]) state.ecs.controllable[id].controllerId = id;
  state.ecs.personable[player] = { age: 24, hunger: 0, tiredness: 0 };
  state.ecs.nameable[player] = { nickname: "Will Ashdown" };
  state.ecs.kinship = {};
  state.ecs.personality = {};
  state.ecs.relationships = {};
  state.ecs.village = {};
  state.ecs.household = {};
  state.ecs.planner = {};
  state.ecs.manager = {};
  for (const id of [player, person, parent, sibling]) {
    state.ecs.kinship[id] = { parents: [], spouse: null, children: [] };
    state.ecs.personality[id] = { traits: ["generous", "proud", "brave"], likes: [], dislikes: [] };
    state.ecs.relationships[id] = { known: {} };
    state.ecs.village[id] = { villageId: "village" };
    state.ecs.household[id] = { houseId: tiles[3] };
    state.ecs.planner[id] = { id, world: { places: {}, no_place_for: {}, feeling: {}, holding: {}, days: state.days, ordered: id == player } };
    state.ecs.manager[id] = { id, ordered: id == player, jobs: [] };
  }
  state.ecs.nameable[tiles[3]] = { nickname: "Miller cottage" };
  state.ecs.kinship[parent].children = [person, sibling];
  state.ecs.kinship[person].parents = [parent];
  state.ecs.kinship[sibling].parents = [parent];
  state.ecs.relationships[person].known[parent] = { ring: "personal", goodwill: 36 };
  state.ecs.relationships[person].known[sibling] = { ring: "social", goodwill: 16 };
  state.ecs.controllable[tiles[3]] = { controllerId: parent };
  state.ecs.playable[player] = { known: [] };
  const sim = createSimulation(state);
  const step = hours => { for (let i = 0; i < hours * 60; i++) sim.step(1); };
  return { state, player, person, parent, sibling, tiles, step };
}
