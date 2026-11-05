import MersenneTwister from "mersenne-twister";

import male_names from "data/male_names.json";
import female_names from "data/female_names.json";

function bias(g, n) {
  return Math.min(n - 1, Math.abs((g.random_int() % n) + (g.random_int() % n) - n));
}

export function firstName(nameable) {
  if (nameable.firstName) return nameable.firstName;
  const generator = new MersenneTwister(nameable.seed);
  return nameable.male ?
    male_names[bias(generator, male_names.length)] :
    female_names[bias(generator, female_names.length)];
}

const SYLLABLES = [
  ["Bo", "Thu", "Jo", "Cle", "Fri", "See", "Doo", "Ya", "My"],
  ["ra", "ke", "bo", "ba", "bi", "bil", "fob", "wa", "for"],
  ["si", "son", "ho", "run", "lo", "to", "ri", "rin"]
];

export function familyName(nameable) {
  if (nameable.familyName) return nameable.familyName;
  const generator = new MersenneTwister(nameable.familySeed);
  const middle = generator.random_int() % 2;
  return SYLLABLES[0][generator.random_int() % SYLLABLES[0].length] +
    [...Array(middle)].map(() => SYLLABLES[1][generator.random_int() % SYLLABLES[1].length]) +
    SYLLABLES[2][generator.random_int() % SYLLABLES[2].length];
}

export const name = nameable => {
  if (nameable.nickname) {
    return nameable.nickname;
  }

  if (nameable.type == "person") {
    return [firstName(nameable), familyName(nameable)].join(" ");
  }

  return "UNKNOWN NAME TYPE";
};

// Allocate at creation, so references, saves and travel keep the same identity.
export function uniquePersonName(state, nameable) {
  const taken = new Set();
  for (const [id, n] of Object.entries(state.ecs.nameable || {})) {
    if (n.type == "person" || state.ecs.personable?.[id]) taken.add(name(n));
  }
  for (const directory of new Set([state.peopleDirectory, state.travel?.people, state.newsContext?.people])) {
    for (const person of Object.values(directory || {})) if (person.nameable) taken.add(name(person.nameable));
  }
  const surname = familyName(nameable), generator = new MersenneTwister(nameable.seed);
  const names = [...new Set((nameable.male ? male_names : female_names).map(String).filter(Boolean))];
  const original = String(firstName(nameable));
  let first = original;
  const free = names.filter(n => !taken.has(n + " " + surname));
  while (taken.has(first + " " + surname)) {
    // A long-lived family can remember every single name in the catalogue.
    // Compound first names leave the family name intact even then.
    first = free.length ? free[bias(generator, free.length)] : first + " " + names[bias(generator, names.length)];
  }
  return first == original ? { ...nameable } : { ...nameable, firstName: first };
}

