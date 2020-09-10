import handleEvent from "../src/game/events";

describe("handlingEvent", () => {
  it("handles death", () => {
    var payload = { personable: { dead: false } };
    handleEvent({ personable: { die: { "foo": true }}}, payload);
    expect(payload.personable.dead).toBe(true);
  });
  it("adds and removes traits", () => {
    var payload = { traits: { values: ["hungry"] } };
    handleEvent({ "traits.values": { remove: "hungry", add: "starving" }}, payload);
    expect(payload.traits.values).toEqual(["starving"]);
    handleEvent({ "traits.values": { remove: "foo", add: "bar" }}, payload);
    expect(payload.traits.values).toEqual(["starving", "bar"]);
  });
});
