import MersenneTwister from "mersenne-twister";

const SYLLABLES = [
  ["Bo", "Thu", "Jo", "Cle", "Fri", "See", "Doo", "Ya", "My"],
  ["ra", "ke", "bo", "ba", "bi", "bil", "fob", "wa", "for"],
  ["si", "son", "ho", "run", "lo", "to", "ri", "rin"]
];

export const name = nameable => {
  if (nameable.nickname) {
    return nameable.nickname;
  }

  if (nameable.type == "person") {
    var generator = new MersenneTwister(nameable.seed);
    const middle = generator.random_int() % 2;
    return SYLLABLES[0][generator.random_int() % SYLLABLES[0].length] +
      [...Array(middle)].map(() => SYLLABLES[1][generator.random_int() % SYLLABLES[1].length]) +
    SYLLABLES[2][generator.random_int() % SYLLABLES[2].length];
  }

  return "UNKNOWN NAME TYPE";
};

