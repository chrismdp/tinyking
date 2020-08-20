export const turnRules = [
  {
    conditions: {
      "target.mappable.terrain": { is: "sown" },
      season: { is: "summer" }
    },
    event: {
      rules: [
        { event: { "target.mappable": { set: { terrain: "growing" } } } }
      ]
    }
  },
  {
    conditions: {
      "target.mappable.terrain": { is: "growing" },
      season: { is: "autumn" }
    },
    event: {
      rules: [
        { event: { "target.mappable": { set: { terrain: "harvestable" } } } }
      ]
    }
  }
];

