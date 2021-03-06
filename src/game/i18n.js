export function phrasesFromObjectTree(object, sofar = "") {
  return Object.keys(object || {}).reduce((arr, key) => {
    if (key == "conditions") {
      return arr;
    }
    const value = object[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return [...arr, { phrase: [...sofar, key].join("."), value } ];
    } else {
      return [...arr, ...phrasesFromObjectTree(value, [...sofar, key]) ];
    }
  }, []).map(p => ({ ...p, phrase: p.phrase.replace(/or\.\d+\./g, "")}));
}
