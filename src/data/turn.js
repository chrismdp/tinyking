export const turnRules = [
  {
    conditions: {
      "target.mappable.terrain": { is: "sown" },
      season: { is: "summer" }
    },
    event: {
      rules: {
        target: [
          { event: { mappable: { set: { terrain: "growing" } } } }
        ]
      }
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "growing" },
      season: { is: "autumn" }
    },
    event: {
      rules: {
        target: [
          { event: { mappable: { set: { terrain: "harvestable" } } } }
        ]
      }
    }
  },
  {
    conditions: {
      "target.attributes.energy": { lessEq: 2 },
      "target.attributes.health": { greater: 2 }
    },
    event: {
      rules: {
        target: [
          { event: { attributes: { lose: { health: 2 } } } }
        ]
      }
    }
  },
  {
    conditions: {
      "target.attributes.energy": { lessEq: 2 },
      "target.attributes.health": { lessEq: 2 }
    },
    event: {
      rules: {
        target: [
          { event: { personable: { die: { exhaustion: true } } } }
        ]
      }
    }
  }
];

