import { energySpeed } from "game/energy";
// NPC hunger is days since a meal. The player uses an energy budget.
export const hungerStage = person => person.dead ? "Dead" :
  person.hunger > 0.9 ? "Ready for a meal" : "Fed";

export const hungerSpeed = person => !person ? 1 :
  person.hunger > 2.5 ? 0.6 : person.hunger > 0.9 ? 0.8 : 1;

// NPC sleep sensors request rest at .9. These fatigue factors apply only
// to people without a player energy budget.
export const tirednessSpeed = person => !person ? 1 :
  person.tiredness > 1.8 ? 0.25 : person.tiredness > 1.2 ? 0.5 : 1;

export const careSpeed = person => Number.isFinite(person?.energy) ? energySpeed(person) : hungerSpeed(person) * tirednessSpeed(person);
