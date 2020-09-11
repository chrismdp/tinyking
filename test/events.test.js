import handleEvent from "game/events";

describe("handlingEvent", () => {
  it("returns an empty array of changes when passed no events", () => {
    expect(handleEvent({})).toEqual([]);
  });
  it ("returns things that have changed", () => {
    var payload = { id: 1, personable: { dead: false } };
    expect(handleEvent({ personable: { die: { "foo": true }}}, payload)).toEqual([ 1 ]);
  });
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
    const state = { clock: 3 };
    handleEvent({ "traits.values": { remove: "foo", add: {"bar": 5} }}, payload, state);
    expect(payload.traits.values.starving).toBe(true);
    expect(payload.traits.values.bar).toEqual(8);
  });
  it ("requires an object for adding traits", () => {
    var payload = { traits: { values: {} } };
    expect(() => handleEvent({ "traits.values": { add: "hungry" }}, payload)).toThrow();
  });
  it ("explores neigbouring tiles", () => {
    var payload = { personable: { id: 2, controller: 1 }, spatial: {id: 2, x: 2, y: 2 } };
    var state = {
      ecs: {
        playable: { "1": { id: 1,  known: [ { x: 2, y: 2 } ] } },
        spatial: {
          "2": payload.spatial,
          "3": { id: 3, x: 1, y: 2 },
          "4": { id: 4, x: 13, y: 2 }
        }
      }
    };
    handleEvent({ "personable": { explore: { radius: 1 }}}, payload, state);
    expect(state.ecs.playable["1"].known.length).toEqual(7);
  });
  it ("throws an error on unknown actions", () => {
    expect(() => handleEvent(
      { "traits.values": { UNKNOWN_ACTION: "hungry" }},
      { traits: { values: {}}})).toThrow();
  });
});
