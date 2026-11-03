import { hashUnit } from "game/math";
import { personComponent } from "game/residents";

export const ORIENTATION_SHARES = { opposite: .93, same: .04, both: .03 };

export function orientationForSeed(seed) {
  const roll = hashUnit(seed + ":orientation");
  let threshold = 0;
  for (const [orientation, share] of Object.entries(ORIENTATION_SHARES)) {
    threshold += share;
    if (roll < threshold) return orientation;
  }
  return "both";
}

export function initialiseOrientation(person, fallbackSeed) {
  if (person.personality) person.personality.orientation ??= orientationForSeed(person.nameable?.seed ?? fallbackSeed);
}

// This is romantic compatibility only. Disposition and friendship stay separate.
// Legacy fixtures/identities can be read without mutating a caller's snapshot.
export function mutuallyOriented(s, a, b, other = s) {
  const nameA = personComponent(s, "nameable", a), nameB = personComponent(other, "nameable", b);
  if (typeof nameA?.male != "boolean" || typeof nameB?.male != "boolean") return false;
  const accepts = (state, id, name) => {
    const orientation = personComponent(state, "personality", id)?.orientation ?? orientationForSeed(name.seed ?? id);
    return orientation == "both" || orientation == (nameA.male == nameB.male ? "same" : "opposite");
  };
  return accepts(s, a, nameA) && accepts(other, b, nameB);
}

// Run once at the save boundary, including old per-map and remote identities.
export function restoreOrientations(s) {
  const ecs = s.ecs || {};
  for (const [id, personality] of Object.entries(ecs.personality || {}))
    initialiseOrientation({ personality, nameable: ecs.nameable?.[id] }, id);
  for (const [id, person] of Object.entries(s.travel?.people || {})) initialiseOrientation(person, id);
  for (const map of Object.values(s.travel?.maps || {})) restoreOrientations(map);
}
