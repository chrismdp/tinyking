import { currentActivity } from "game/person_activity";
import messages from "data/messages.json";
import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";

import { Name } from "components/name";
import { TraitList } from "components/trait_list";
import { PersonPanel } from "./person_panel";

import { hungerStage } from "game/hunger";
import { fullEntity } from "game/entities";

export function SelectedPerson({ entityId }) {
  const state = React.useContext(GameState);
  if (entityId == state.ui?.playerId) return null;
  if (state.ecs.personality?.[entityId]) return <PersonPanel key={entityId} entityId={entityId}/>;
  const entity = fullEntity(state.ecs, entityId);

  if (entityId) {
    return (<div id="selected-person">
      <h1 className="capitalise handle">
        <Name nameable={entity.nameable} clickable={true}/>
        &nbsp;<span className="knockedback">
          { entity.personable.dead && "Dead" ||
            currentActivity(state.ecs, entityId, key => messages.tasks[key.split(".")[1]], undefined, state.ui?.debug)
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
