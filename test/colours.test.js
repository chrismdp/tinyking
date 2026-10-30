import { realmColour, PLAYER_REALM } from "render/colours";

it("keeps prefixed household identities visibly distinct and preserves player red", () => {
  const ids = ["person-101", "person-102", "social-103", "social-104", "social-105", "social-106"];
  const colours = ids.map(id => realmColour(id, "player"));
  expect(new Set(colours).size).toBeGreaterThan(2);
  expect(colours.every(c => c != null && c != PLAYER_REALM)).toBe(true);
  expect(realmColour("person-101", "person-101")).toBe(PLAYER_REALM);
  expect(realmColour("person-101", "player")).toBe(realmColour("person-101", "player"));
});
