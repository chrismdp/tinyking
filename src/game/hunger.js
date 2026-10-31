// Hunger is days since the last full meal. Thresholds are strict: someone
// at exactly six days can still be saved by a meal.
export const hungerStage = person => person.dead ? "Dead" :
  person.hunger > 2.5 ? "Starving" : person.hunger > 0.9 ? "Hungry" : "Fed";

export const hungerSpeed = person => !person ? 1 :
  person.hunger > 2.5 ? 0.6 : person.hunger > 0.9 ? 0.8 : 1;

// The sleep sensor requests rest at .9. Give a newcomer their first day
// (9am arrival, initial tiredness .2–.6) before missed sleep slows them.
export const tirednessSpeed = person => !person ? 1 :
  person.tiredness > 1.8 ? 0.6 : person.tiredness > 1.2 ? 0.8 : 1;

export const careSpeed = person => hungerSpeed(person) * tirednessSpeed(person);
