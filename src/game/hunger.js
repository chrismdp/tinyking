// Hunger is days since the last full meal. Thresholds are strict: someone
// at exactly six days can still be saved by a meal.
export const hungerStage = person => person.dead ? "Dead" :
  person.hunger > 2.5 ? "Starving" : person.hunger > 0.9 ? "Hungry" : "Fed";

export const hungerSpeed = person => !person ? 1 :
  person.hunger > 2.5 ? 0.6 : person.hunger > 0.9 ? 0.8 : 1;
