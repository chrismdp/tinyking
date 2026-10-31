import { HOUR } from "game/time";
import { isResident } from "game/residents";
import { die } from "game/possessions";
import { householdAccess } from "game/playable";
import { consumeStored } from "game/settlement_growth";
import { FOODS } from "game/goods";

// The same physiological clock and death rule apply on and off screen.
export function updateNeeds(state, elapsed = HOUR) {
  for (const [id, person] of Object.entries(state.ecs.personable || {})) {
    if (person.dead || !isResident(state, id)) continue;
    person.tiredness += elapsed;
    person.hunger += elapsed;
    person.starving = person.hunger > 2.5;
    if (person.hunger > 6 + 1e-12) die(state, id, "starvation");
  }
  state.needsUpdatedAt = state.days;
}

// Summary residents can eat from their real accessible stores and rest at home.
// Missing meals accrue hunger; neither a season nor map activation resets it.
export function advanceOffscreenNeeds(state, end) {
  if (!state.map || state.generatingHistory) return; // no physiology in prehistory or on the road
  const now = state.days, from = state.needsUpdatedAt ?? state.environmentUpdatedAt ?? end - 3;
  const stores = Object.keys(state.ecs.container || {});
  const supplies = new Map(Object.keys(state.residents || state.ecs.personable).map(id => [id,
    stores.filter(store => state.ecs.controllable?.[store] && householdAccess(state.ecs, id, store))]));
  for (let at = from + HOUR; at <= end + 1e-9; at += HOUR) {
    state.days = at;
    for (const [id, person] of Object.entries(state.ecs.personable)) {
      if (person.dead || !isResident(state, id)) continue;
      if (person.hunger > .9) {
        const house = state.ecs.household?.[id]?.houseId;
        const store = supplies.get(id)?.find(store => FOODS.some(type => state.ecs.container[store].amounts[type] >= 1));
        if (store) {
          const type = FOODS.find(type => state.ecs.container[store].amounts[type] >= 1);
          consumeStored(state, house, type, 1, store);
          const ledger = state.ecs.household?.[house]?.livelihood;
          if (ledger) ledger.foodConsumed++;
          person.hunger = 0;
        }
      }
      const house = state.ecs.household?.[id]?.houseId;
      if (person.tiredness > .9 && state.ecs.sleepable?.[house]?.capacity) person.tiredness = .1;
    }
    updateNeeds(state);
  }
  state.days = now;
}
