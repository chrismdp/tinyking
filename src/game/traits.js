export default function removeExpiredTraits(traits, clock) {
  for (const id in traits) {
    const values = traits[id].values;
    for (const trait in values) {
      if (values[trait] === true) {
        continue;
      }
      if (values[trait] <= clock) {
        delete values[trait];
      }
    }
  }
}

