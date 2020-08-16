const tiring = [
  {
    conditions: {
      "me.traits.values": {
        not: {
          or: [
            { includes: "exhausted" },
            { includes: "very_tired" },
            { includes: "tired" }
          ]
        }
      }
    },
    event: { "me.traits.values": { add: "tired" } }
  },
  {
    conditions: {
      "me.traits.values": {
        includes: "tired"
      }
    },
    event: { "me.traits.values": { change: [ "tired", "very_tired" ] } },
  },
  {
    conditions: {
      "me.traits.values": {
        includes: "very_tired"
      }
    },
    event: { "me.traits.values": { change: [ "very_tired", "exhausted" ] } },
  },
];

export const actions = [
  {
    conditions: {
      "target.mappable.terrain": { is: "grassland" },
      not: { other: { habitable: "exists" } }
    },
    event: {
      name: "Plough field",
      rules: [
        ...tiring,
        { event: { "target.mappable": { set: { terrain: "ploughed" } } } }
      ]
    },
  },
  {
    conditions: {
      "target.mappable.terrain": {
        is: "ploughed"
      },
      "me.supplies.wheat": { greater: 0 }
    },
    event: {
      name: "Sow field",
      rules: [
        { event: { "target.mappable": { set: { terrain: "sown" } } } },
        { event: { "me.supplies.wheat": { lose: 1 } } }
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
        { event: { "me.traits.values": { remove: "tired" } } },
        { event: { "me.traits.values": { remove: "very_tired" } } },
        { event: { "me.traits.values": { add: "rested" } } },
        { conditions: { "me.traits.values": { includes: "rested" } },
          event: { "me.traits.values": { remove: "exhausted" } } },
        { conditions: { other: { personable: "exists" } },
          event: { me: { socialise: "random_other" } } },
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
        ...tiring,
        { event: { "me.supplies.wood": { gain: 1 } } },
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
          event: { "target.traits.values": { change: [ "thinned", "deforested" ] } }
        },
        {
          conditions: {
            "target.traits.values": {
              includes: "deforested"
            }
          },
          event: { "target.traits.values": { change: [ "deforested", "decimated" ] } }
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
        { event: { "target.traits.values": { add: "planted" } } },
      ],
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "shallow_water" },
    },
    event: {
      name: "Fish",
      rules: [
        { event: { "target.traits.values": { add: "fished" } } },
      ],
    }
  }
];
