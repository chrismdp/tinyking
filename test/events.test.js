import handleEvent from "game/events";

import { fullEntity } from "game/entities";

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
    handleEvent({ "traits.values": { remove: "foo", add: {"bar": 5} }}, payload, {}, state);
    expect(payload.traits.values.starving).toBe(true);
    expect(payload.traits.values.bar).toEqual(8);
  });
  it ("requires an object for adding traits", () => {
    var payload = { traits: { values: {} } };
    expect(() => handleEvent({ "traits.values": { add: "hungry" }}, payload)).toThrow();
  });
  it ("explores neigbouring tiles", () => {
    var state = {
      ecs: {
        personable: {
          1: { id: 1, controller: 1 },
          2: { id: 2, controller: 1 }
        },
        playable: { 1: { id: 1,  known: [ { x: 2, y: 2 } ] } },
        spatial: {
          2: { id: 2, x: 2, y: 2 },
          3: { id: 3, x: 1, y: 2 },
          4: { id: 4, x: 13, y: 2 }
        }
      }
    };
    var payload = fullEntity(state.ecs, 2);
    handleEvent({ "personable": { explore: { radius: 1 }}}, payload, {}, state);
    expect(state.ecs.playable["1"].known.length).toEqual(7);
  });

  describe("recruiting", () => {
    it ("recruits a character", () => {
      var state = {
        ecs: {
          personable: {
            1: { controller: 1, id: 1 },
            2: { controller: 2, id: 2 }
          },
          supplies: {}
        }
      };
      var context = { actor: fullEntity(state.ecs, 1), target: fullEntity(state.ecs, 2) };
      handleEvent({ "personable": { recruited: "actor"}}, context.target, context, state);
      expect(state.ecs.personable["2"].controller).toEqual(1);
    });

    it ("recruits the whole household", () => {
      var state = {
        ecs: {
          personable: {
            1: { controller: 1, id: 1 },
            2: { controller: 2, id: 2 },
            3: { controller: 2, id: 3 }
          },
          supplies: {}
        }
      };
      var context = { actor: fullEntity(state.ecs, 1), target: fullEntity(state.ecs, 2) };
      handleEvent({ "personable": { recruited: "actor"}}, context.target, context, state);
      expect(state.ecs.personable["3"].controller).toEqual(1);
    });

    it ("transfers over supplies", () => {
      var state = {
        ecs: {
          personable: {
            1: { controller: 1, id: 1 },
            2: { controller: 2, id: 2 },
            3: { controller: 2, id: 3 }
          },
          supplies: {
            1: { id: 1, grain: 1, stone: 1 },
            2: { id: 2, grain: 2, wood: 1 },
            3: { id: 3, grain: 1 }
          }
        }
      };
      var context = { actor: fullEntity(state.ecs, 1), target: fullEntity(state.ecs, 2) };
      handleEvent({ "personable": { recruited: "actor"}}, context.target, context, state);
      expect(state.ecs.supplies["1"]).toEqual({ id: 1, grain: 4, stone: 1, wood: 1 });
    });
  });

  it ("moves characters around", () => {
    var state = {
      ecs: {
        personable: { 1: { id: 1 } },
        spatial: {
          1: { id: 1, x: 1, y: 2 },
          2: { id: 2, x: 4, y: 4 }
        }
      }
    };
    var context = { actor: fullEntity(state.ecs, 1), target: fullEntity(state.ecs, 2) };
    handleEvent({ "spatial": { move: "target"}}, context.actor, context, state);
    expect(state.ecs.spatial["1"]).toEqual({ id: 1, x: 4, y: 4 });
  });

  it ("throws an error on unknown actions", () => {
    expect(() => handleEvent(
      { "traits.values": { UNKNOWN_ACTION: "hungry" }},
      { traits: { values: {}}})).toThrow();
  });
});
