import { personComponent } from "game/residents";
import { boundId } from "game/social_conditions";

const spouseOf = (s, id) => personComponent(s, "kinship", id)?.spouse;
const householdHeadOf = (s, id) => {
  const house = personComponent(s, "household", id)?.houseId;
  return personComponent(s, "controllable", house)?.controllerId;
};
const villageOf = (s, id) => s.ecs.village?.[id]?.villageId;

// Each question owns its storage access. Data supplies only a lookup and a role.
export function socialLookup(s, bindings, source) {
  const entries = Object.entries(source);
  if (entries.length !== 1) throw new Error("Expected one named social lookup");
  const [name, role] = entries[0], id = boundId(bindings, role);
  switch (name) {
  case "spouseOf": return spouseOf(s, id);
  case "householdHeadOf": return householdHeadOf(s, id);
  case "villageOf": return villageOf(s, id);
  default: throw new Error("Unknown social lookup: " + name);
  }
}
