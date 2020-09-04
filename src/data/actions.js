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
      "target.mappable.terrain": { or: [ { is: "grassland" }, { is: "dirt" } ] },
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
      ...energy(4),
      "target.mappable.terrain": { is: "harvestable" },
    },
    event: {
      name: "Harvest field",
      description: "Time to bring in the crops and reap the rewards of your hard work.",
      rules: {
        me: [
          ...tiring(4),
          { event: { "supplies": { gain: { grain: 5 } } } }
        ],
        target: [
          { event: { "mappable": { set: { terrain: "dirt" } } } },
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
      "me.attributes.energy": { less: 3 },
    },
    event: {
      name: "Recover",
      description: "The world is starting to swim before your eyes... time to crash out and recuperate.",
      rules: {
        me: [
          {
            event: { attributes: { gain: { energy: 1 } } }
          },
        ],
      }
    }
  },
  {
    conditions: {
      "target.habitable": "exists",
      "target.habitable.owners": { includes: "$me.id" },
      "me.attributes.energy": { greaterEq: 3, less: 10 },
    },
    event: {
      name: "Rest",
      description: "There's nothing to eat, but at least there's time to relax.",
      rules: {
        me: [
          { event: { attributes: { gain: { energy: 1 } } } },
        ],
      }
    }
  },
  {
    conditions: {
      "target.habitable": "exists",
      "target.habitable.owners": { includes: "$me.id" },
      "me.supplies.grain": { greater: 0 },
      "me.attributes.energy": { greater: 0, less: 10 },
    },
    event: {
      name: "Prepare gruel",
      description: "Mash together a basic gruel from the grain you have, and eat it cold.",
      rules: {
        me: [
          { event: { attributes: { gain: { energy: 5 } } } },
          { event: { supplies: { lose: { grain: 1 } } } },
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
            event: { "mappable": { set: { terrain: "dirt" } } },
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
