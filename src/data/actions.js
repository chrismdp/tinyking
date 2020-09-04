const tiring = factor => ([
  {
    event: { "attributes": { lose: { energy: factor * 2 } } }
  }
]);

export const actions = [
  {
    conditions: {
      "target.mappable.terrain": { is: "grassland" },
      not: { other: { habitable: "exists" } }
    },
    event: {
      name: "Plough field",
      description: "Create furrows with minimal tools suitable for growing crops.",
      rules: {
        me: tiring(2),
        target: [
          { event: { "mappable": { set: { terrain: "ploughed" } } } }
        ]
      }
    },
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "grassland" },
      not: { other: { habitable: "exists" } },
      season: {
        or: [ { is: "summer" } , { is: "autumn" } ]
      }
    },
    event: {
      name: "Gather grain",
      description: "Comb the fields for enough kernels of wild wheat to be able to sow a field.",
      rules: {
        me: [
          ...tiring(1),
          { event: { "supplies": { gain: { grain: 1 } } } }
        ],
      }
    },
  },
  {
    conditions: {
      "target.mappable.terrain": {
        is: "ploughed"
      },
      "me.supplies.grain": { greater: 0 },
      season: {
        or: [ { is: "spring" } , { is: "summer" } ]
      }
    },
    event: {
      name: "Sow field",
      rules: {
        me: [
          ...tiring(1),
          { event: { "supplies": { lose: { grain: 1 } } } }
        ],
        target: [
          { event: { "mappable": { set: { terrain: "sown" } } } },
        ]
      }
    },
  },
  {
    conditions: {
      "target.habitable": "exists",
      "target.habitable.owners": { includes: "$me.id" }
    },
    event: {
      name: "Rest",
      rules: {
        me: [
          {
            conditions: { "attributes.energy": { less: 2 } },
            event: { "attributes": { gain: { energy: 1 } } }
          },
          {
            conditions: { "attributes.energy": { greaterEq: 2, less: 5 } },
            event: { "attributes": { gain: { energy: 2 } } }
          },
          {
            conditions: { "attributes.energy": { greaterEq: 5, less: 9 } },
            event: { "attributes": { gain: { energy: 4 } } }
          },
          {
            conditions: { "attributes.energy": { is: 9 } },
            event: { "attributes": { gain: { energy: 1 } } }
          },
        ],
      }
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "forest" },
    },
    event: {
      name: "Chop trees",
      rules: {
        me: [
          ...tiring(2),
          { event: { "supplies": { gain: { wood: 1 } } } },
        ],
        target: [
          {
            conditions: {
              "traits.values": {
                not: {
                  or: [
                    { includes: "thinned" },
                    { includes: "deforested" },
                    { includes:  "decimated" }
                  ]
                }
              }
            },
            event: { "traits.values": { add: "thinned" } }
          },
          {
            conditions: {
              "traits.values": {
                includes: "thinned"
              }
            },
            event: { "traits.values": { remove: "thinned", add: "deforested" } }
          },
          {
            conditions: {
              "traits.values": {
                includes: "deforested"
              }
            },
            event: { "traits.values": { remove: "deforested", add: "decimated" } }
          },
          {
            conditions: {
              "traits.values": {
                includes: "deforested"
              }
            },
            event: { "mappable": { set: { terrain: "grassland" } } },
          },
        ]
      }
    },
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "forest" },
      not: { "target.traits.values": { includes: "planted" } },
    },
    event: {
      name: "Plant trees",
      rules: {
        me: tiring(2),
        target: [
          { event: { "traits.values": { add: "planted" } } },
        ]
      }
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "shallow water" },
      "me.traits.values": { includes: "boat" } // TODO: Really a placeholder
    },
    event: {
      name: "Fish",
      rules: {
        me: tiring(1),
        target: [
          { event: { "traits.values": { add: "fished" } } },
        ]
      }
    }
  }
];
