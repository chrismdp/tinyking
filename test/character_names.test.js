import { firstName, familyName, name } from "game/name";
jest.mock("data/male_names.json", () => ["Will", "Will", "Will"], { virtual: true });
jest.mock("data/female_names.json", () => ["Rose", "Rose", "Rose"], { virtual: true });
it("uses typed first and family names everywhere a person is named", () => {
  const person = { type: "person", male: true, seed: 13, familySeed: 13, firstName: "Mira", familyName: "Alder" };
  expect(firstName(person)).toBe("Mira");
  expect(familyName(person)).toBe("Alder");
  expect(name(person)).toBe("Mira Alder");
});
it("keeps generated names available when typed overrides are cleared", () => {
  const person = { type: "person", male: true, seed: 13, familySeed: 13 };
  expect(firstName(person)).toBe("Will");
  expect(familyName(person)).toEqual(expect.any(String));
});
