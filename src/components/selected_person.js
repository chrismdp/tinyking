import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";

import { Name } from "components/name";
import { TraitList } from "components/trait_list";

import { fullEntity } from "game/entities";

export function SelectedPerson({ entityId }) {
  const state = React.useContext(GameState);
  const entity = fullEntity(state.ecs, entityId);

  if (entityId) {
    return (<div id="selected-person">
      <h1 className="capitalise handle">
        <Name nameable={entity.nameable} clickable={true}/>
        &nbsp;<span className="knockedback">
          { entity.personable.dead && "Dead" ||
            (entity.planner && entity.planner.task && entity.planner.task[0])
          }</span>
      </h1>
      <div className="traits">
        <TraitList traits={entity.traits}/>
      </div>
    </div>);
  } else { return (<></>); }
}

SelectedPerson.propTypes = {
  entityId: PropTypes.string.isRequired
};
