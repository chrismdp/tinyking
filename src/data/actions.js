const tiring = {
  when: { trait: "tired" },
  then: { add_trait: "very_tired" },
  otherwise: { when: { trait: "very_tired" },
    then: { add_trait: "exhausted" },
    otherwise: { add_trait: "tired" } } };

export const actions = {
  rest: {
    name: "Rest",
    me: [
      { remove_trait: "tired" },
      { remove_trait: "very_tired" },
      { add_trait: "rested" },
      { when: { trait: "rested" }, then: { remove_trait: "exhausted" } },
      { socialise: "all_others_in_tile" },
    ],
    target: []
  },
  plough_field: {
    name: "Plough field",
    needs: { terrain: "grassland" },
    me: [ tiring ],
    target: [
      { change_terrain: "ploughed" }
    ]
  },
  sow_wheat: {
    name: "Sow wheat",
    needs: { wheat: 1, terrain: "ploughed" },
    me: [
      { lose: { wheat: 1 } }
    ],
    target: [
      { change_terrain: "sown" },
    ]
  },
  chop_trees: {
    name: "Chop trees",
    needs: { terrain: "forest" },
    me: [
      tiring,
      { gain: { wood: 1 } }
    ],
    target: [
      { when: { trait: "thinned" },
        then: { add_trait: "deforested" },
        otherwise: {
          when: { trait: "deforested" },
          then: { add_trait: "decimated" },
          otherwise: {
            when: { trait: "decimated" },
            then: { change_terrain: "grassland" },
          }
        }
      }
    ],
  },
  plant_trees: {
    name: "Plant trees",
    needs: { terrain: "forest" },
    target: [
      { add_trait: "planted" },
      { remove_trait: "thinned" },
      { when: { trait: "deforested" },
        then: [ { add_trait: "thinned" }, { remove_trait: "deforested" } ],
        otherwise: {
          when: [ { trait: "decimated" }, { trait: "planted" } ],
          then: { add_trait: "deforested" }
        }
      }
    ]
  }
};
