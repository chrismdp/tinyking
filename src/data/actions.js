const tiring = factor => ([
  {
    event: { "me.attributes": { lose: { energy: factor * 2 } } }
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
      rules: [
        ...tiring(2),
        { event: { "target.mappable": { set: { terrain: "ploughed" } } } }
      ]
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
      name: "Gather wheat",
      description: "Comb the fields for enough kernels of wild wheat to be able to sow a field.",
      rules: [
        ...tiring(1),
        { event: { "me.supplies": { gain: { wheat: 1 } } } },
      ]
    },
  },
  {
    conditions: {
      "target.mappable.terrain": {
        is: "ploughed"
      },
      "me.supplies.wheat": { greater: 0 },
      season: {
        or: [ { is: "spring" } , { is: "summer" } ]
      }
    },
    event: {
      name: "Sow field",
      rules: [
        ...tiring(1),
        { event: { "target.mappable": { set: { terrain: "sown" } } } },
        { event: { "me.supplies": { lose: { wheat: 1 } } } }
      ]
    },
  },
  {
    conditions: {
      "target.habitable": "exists",
      "target.habitable.owners": { includes: "$me.id" }
    },
    event: {
      name: "Rest",
      rules: [
        {
          conditions: { "me.attributes.energy": { less: 2 } },
          event: { "me.attributes": { gain: { energy: 1 } } }
        },
        {
          conditions: { "me.attributes.energy": { greaterEq: 2, less: 5 } },
          event: { "me.attributes": { gain: { energy: 2 } } }
        },
        {
          conditions: { "me.attributes.energy": { greaterEq: 5, less: 9 } },
          event: { "me.attributes": { gain: { energy: 4 } } }
        },
        {
          conditions: { "me.attributes.energy": { is: 9 } },
          event: { "me.attributes": { gain: { energy: 1 } } }
        },
      ],
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "forest" },
    },
    event: {
      name: "Chop trees",
      rules: [
        ...tiring(2),
        { event: { "me.supplies": { gain: { wood: 1 } } } },
        {
          conditions: {
            "target.traits.values": {
              not: {
                or: [
                  { includes: "thinned" },
                  { includes: "deforested" },
                  { includes:  "decimated" }
                ]
              }
            }
          },
          event: { "target.traits.values": { add: "thinned" } }
        },
        {
          conditions: {
            "target.traits.values": {
              includes: "thinned"
            }
          },
          event: { "target.traits.values": { remove: "thinned", add: "deforested" } }
        },
        {
          conditions: {
            "target.traits.values": {
              includes: "deforested"
            }
          },
          event: { "target.traits.values": { remove: "deforested", add: "decimated" } }
        },
        {
          conditions: {
            "target.traits.values": {
              includes: "deforested"
            }
          },
          event: { "target.mappable": { set: { terrain: "grassland" } } },
        },
      ]
    },
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "forest" },
      not: { "target.traits.values": { includes: "planted" } },
    },
    event: {
      name: "Plant trees",
      rules: [
        ...tiring(2),
        { event: { "target.traits.values": { add: "planted" } } },
      ],
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "shallow water" },
      "me.traits.values": { includes: "boat" } // TODO: Really a placeholder
    },
    event: {
      name: "Fish",
      ...tiring(1),
      rules: [
        { event: { "target.traits.values": { add: "fished" } } },
      ],
    }
  }
];
