import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";

import { Name } from "components/name";
import { TraitList } from "components/trait_list";

import { hungerStage } from "game/hunger";
import { fullEntity } from "game/entities";

const TASK_LABELS = {
  work_shelter: "Building", build_shelter: "Building", carry_home: "Carrying goods home", walk_to: "Walking",
  chop_tree: "Chopping wood", forage: "Foraging", sleep: "Sleeping", eat: "Eating",
  create_field: "Clearing a field", create_stockpile: "Clearing a stockpile", wait_for: "Waiting"
};

export function SelectedPerson({ entityId }) {
  const state = React.useContext(GameState);
  if (entityId == state.ui?.playerId) return null;
  const entity = fullEntity(state.ecs, entityId);

  if (entityId) {
    return (<div id="selected-person">
      <h1 className="capitalise handle">
        <Name nameable={entity.nameable} clickable={true}/>
        &nbsp;<span className="knockedback">
          { entity.personable.dead && "Dead" ||
            (entity.planner && entity.planner.task && (TASK_LABELS[entity.planner.task[0]] || "Working"))
          }</span>
      </h1>
      <div className="hunger-stage">{hungerStage(entity.personable)}</div>
      <div className="traits">
        <TraitList traits={entity.traits}/>
      </div>
    </div>);
  } else { return (<></>); }
}

SelectedPerson.propTypes = {
  entityId: PropTypes.string.isRequired
};
