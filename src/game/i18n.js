export function phrasesFromObjectTree(object, sofar = "") {
  return Object.keys(object).reduce((arr, key) => {
    const value = object[key];
    if (typeof value === "string" || typeof value === "number") {
      return [...arr, { phrase: [...sofar, key].join("."), value } ];
    } else {
      return [...arr, ...phrasesFromObjectTree(value, [...sofar, key]) ];
    }
  }, []);
}
