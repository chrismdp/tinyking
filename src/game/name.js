import MersenneTwister from "mersenne-twister";

import male_names from "data/male_names.csv";
import female_names from "data/female_names.csv";

function bias(g, n) {
  return Math.abs((g.random_int() % n) + (g.random_int() % n) - n);
}

function firstName(nameable) {
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

function familyName(nameable) {
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

