import handleEvent from "game/events";

describe("handlingEvent", () => {
  it("handles death", () => {
    var payload = { personable: { dead: false } };
    handleEvent({ personable: { die: { "foo": true }}}, payload);
    expect(payload.personable.dead).toBe(true);
  });
  it("adds and removes traits", () => {
    var payload = { traits: { values: {"hungry" : true } } };
    handleEvent({ "traits.values": { remove: "hungry", add: { "starving": true } }}, payload);
    expect(Object.keys(payload.traits.values)).toEqual(["starving"]);
    expect(payload.traits.values.starving).toBe(true);
    const clock = 3;
    handleEvent({ "traits.values": { remove: "foo", add: {"bar": 5} }}, payload, clock);
    expect(payload.traits.values.starving).toBe(true);
    expect(payload.traits.values.bar).toEqual(8);
  });
  it ("requires an object for adding traits", () => {
    var payload = { traits: { values: {} } };
    expect(() => handleEvent({ "traits.values": { add: "hungry" }}, payload)).toThrow();
  });
});
