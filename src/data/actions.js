const tiring = factor => ([
  {
    event: { "attributes": { lose: { energy: factor } } }
  }
]);

const energy = amt => (
  { "me.attributes.energy": { greaterEq: amt } }
);

export const actions = [
  {
    conditions: {
      ...energy(4),
      "target.mappable.terrain": { is: "grassland" },
      not: { other: { habitable: "exists" } }
    },
    event: {
      name: "Plough field",
      description: "Create furrows with minimal tools suitable for growing crops.",
      rules: {
        me: tiring(4),
        target: [
          { event: { "mappable": { set: { terrain: "ploughed" } } } }
        ]
      }
    },
  },
  {
    conditions: {
      ...energy(2),
      not: { other: { habitable: "exists" } },
      "target.mappable.terrain": { is: "grassland" },
      season: {
        or: [ { is: "summer" } , { is: "autumn" } ]
      }
    },
    event: {
      name: "Gather grain",
      description: "Comb the fields for enough kernels of wild wheat to be able to sow a field.",
      rules: {
        me: [
          ...tiring(2),
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
      ...energy(2),
      "me.supplies.grain": { greater: 0 },
      season: {
        or: [ { is: "spring" } , { is: "summer" } ]
      }
    },
    event: {
      name: "Sow field",
      rules: {
        me: [
          ...tiring(2),
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
      "target.habitable.owners": { includes: "$me.id" },
      "me.attributes.energy": { less: 4 },
    },
    event: {
      name: "Recover",
      description: "Time to crash out and recuperate.",
      rules: {
        me: [
          {
            event: { attributes: { gain: { energy: 2 } } }
          },
        ],
      }
    }
  },
  {
    conditions: {
      "target.habitable": "exists",
      "target.habitable.owners": { includes: "$me.id" },
      "me.attributes.energy": { greaterEq: 4, less: 10 },
    },
    event: {
      name: "Rest",
      description: "Relax at home to boost energy.",
      rules: {
        me: [
          {
            event: { attributes: { gain: { energy: 4 } } }
          },
        ],
      }
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "forest" },
      ...energy(4),
    },
    event: {
      name: "Chop trees",
      rules: {
        me: [
          ...tiring(4),
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
      ...energy(4),
      not: { "target.traits.values": { includes: "planted" } },
    },
    event: {
      name: "Plant trees",
      rules: {
        me: tiring(4),
        target: [
          { event: { "traits.values": { add: "planted" } } },
        ]
      }
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "shallow water" },
      ...energy(2),
      "me.traits.values": { includes: "boat" } // TODO: Really a placeholder
    },
    event: {
      name: "Fish",
      rules: {
        me: tiring(2),
        target: [
          { event: { "traits.values": { add: "fished" } } },
        ]
      }
    }
  }
];
