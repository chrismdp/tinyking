import { historyStep, advanceSeason } from "game/social";
import { createPossession, repairHouseholds } from "game/possessions";
import { recalibrateRelationships, drift, withRelationshipIndex } from "game/people";
import { recordEvent, withEventIndex } from "game/events";

// Keep geography and vegetation out of seasonal copies. These records are all
// a distant world hex needs to continue its families while the player travels.
export function generateHistory(state, seed) {
  const started = performance.now();
  const components = ["personable", "personality", "kinship", "relationships", "household", "village", "building", "controllable", "possession", "nameable", "playable", "spatial"];
  const people = new Set(Object.keys(state.ecs.personable));
  const houses = new Set(Object.keys(state.ecs.building));
  let summary = { ecs: { nextId: state.ecs.nextId }, villages: state.villages, days: -540, peopleSeed: seed,
    opinionThresholds: state.opinionThresholds, generatingHistory: true, events: [], knowledge: {}, social: { courtships: {}, avoidance: {} } };
  for (const key of components) summary.ecs[key] = Object.fromEntries(Object.entries(state.ecs[key] || {}).filter(([id]) => people.has(id) || houses.has(id)));
  const names = ["Silver ring", "Bronze brooch", "Carved box", "Family sword", "Psalter"];
  for (const village of Object.values(summary.villages)) {
    const founders = [...people].filter(id => summary.ecs.village[id]?.villageId == village.id);
    const owner = founders[0];
    if (owner) createPossession(summary, owner, names[Math.floor(village.houses.length % names.length)], "heirloom");
    for (const a of founders) {
      const b = summary.ecs.kinship[a].spouse;
      if (b && a < b) recordEvent(summary, "marriage", [a, b]);
    }
  }
  // Generation owns this detached summary. Reuse it between seasons; public
  // historyStep still copies callers' snapshots for travel/replay.
  withEventIndex(summary, () => withRelationshipIndex(summary, () => {
    for (let season = -180; season < 0; season++) {
      summary.days = season * 3;
      drift(summary, 72);
      advanceSeason(summary, season, true);
    }
  }));
  for (const key of components) {
    state.ecs[key] ||= {};
    Object.assign(state.ecs[key], summary.ecs[key]);
  }
  for (const p of Object.values(state.ecs.personable)) if (p.dead) p.historical = true;
  // Every newborn gets a real planner on entering the rendered simulation.
  for (const id of Object.keys(summary.ecs.personable)) if (!state.ecs.planner[id]) {
    const fields = { traits: { values: {} }, attributes: {}, holder: { held: [], capacity: 2 }, manager: { jobs: [] },
      planner: { world: { no_place_for: {}, jobs: [], places: {}, feeling: {}, holding: {}, days: state.days } } };
    for (const [key, value] of Object.entries(fields)) (state.ecs[key] ||= {})[id] = { ...value, id };
  }
  state.ecs.nextId = summary.ecs.nextId;
  state.villages = summary.villages; state.events = summary.events; state.knowledge = summary.knowledge;
  state.social = { ...summary.social, lastSeason: 0 };
  // Calibrate once for the people the player actually meets. Ancestors remain
  // known records; current living opinions retain the rule-of-five quantiles.
  recalibrateRelationships(state);
  repairHouseholds(state);
  Object.defineProperty(state, "historyGenerationMs", { value: performance.now() - started, writable: true, configurable: true, enumerable: false });
}

export function giveTradeTools(state) {
  for (const [id, p] of Object.entries(state.ecs.profession || {})) {
    if (!state.ecs.personable[id].dead) createPossession(state, id, ({ smith: "Smith's hammer", carpenter: "Carpenter's adze", weaver: "Weaver's shuttle", baker: "Baker's peel", tanner: "Tanner's knife", miller: "Miller's scoop" })[p.trade], "tool");
  }
}

export { historyStep };
