const tiring = [
  {
    conditions: {
      "me.traits": {
        not: { includes: [ "exhausted", "very_tired", "tired" ] }
      }
    },
    event: { "me.traits": { add: "tired" } }
  },
  {
    conditions: {
      "me.traits": {
        includes: "tired"
      }
    },
    event: { "me.traits": { change: [ "tired", "very_tired" ] } },
  },
  {
    conditions: {
      "me.traits": {
        includes: "very_tired"
      }
    },
    event: { "me.traits": { change: [ "very_tired", "exhausted" ] } },
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
        { event: { "target.mappable.terrain": "ploughed" } }
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
        { event: { "target.mappable.terrain": "sown" } },
        { event: { "me.supplies.wheat": { lose: 1 } } }
      ]
    },
  },
  {
    conditions: {
      "target.habitable": "exists",
      "target.habitable.owners": { includes: "$me.id" } },
    event: {
      name: "Rest",
      rules: [
        { event: { "me.traits": { remove: "tired" } } },
        { event: { "me.traits": { remove: "very_tired" } } },
        { event: { "me.traits": { add: "rested" } } },
        { conditions: { "me.traits": { includes: "rested" } },
          event: { "me.traits": { remove: "exhausted" } } },
        { conditions: { "other.personable": "exists" },
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
            "target.traits": {
              not: { includes: ["thinned", "deforested", "decimated" ] }
            }
          },
          event: { "target.traits": { add: "thinned" } }
        },
        {
          conditions: {
            "target.traits": {
              includes: "thinned"
            }
          },
          event: { "target.traits": { change: [ "thinned", "deforested" ] } }
        },
        {
          conditions: {
            "target.traits": {
              includes: "deforested"
            }
          },
          event: { "target.traits": { change: [ "deforested", "decimated" ] } }
        },
        {
          conditions: {
            "target.traits": {
              includes: "deforested"
            }
          },
          event: { "target.mappable.terrain": { change: "grassland" } },
        },
      ]
    },
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "forest" },
      not: { "target.traits": { include: "planted" } },
    },
    event: {
      name: "Plant trees",
      rules: [
        { event: { "target.traits": { add: "planted" } } },
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
        { event: { "target.traits": { add: "fished" } } },
      ],
    }
  }
];
