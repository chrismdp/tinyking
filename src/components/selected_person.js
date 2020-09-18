import React from "react";
import { GameState } from "components/contexts";

import { useTranslate } from "react-polyglot";
import { Name } from "components/name";
import { TraitList } from "components/trait_list";
import { EndTurnEvents } from "components/end_turn_events";

import { fullEntity } from "game/entities";

export function SelectedPerson({ entityId }) {
  const state = React.useContext(GameState);
  const entity = fullEntity(state.ecs, entityId);
  const t = useTranslate();

  if (entityId) {
    return (<div id="selected-person">
      <h1 className="capitalise handle">
        <Name nameable={entity.nameable}/>
        &nbsp;<span className="knockedback">
          { entity.assignable.task
            && t("action." + entity.assignable.task.action.key + ".name")
            || <>Moves: {entity.attributes.moves}</>
          }</span>
      </h1>
      <div className="traits">
        <TraitList traits={entity.traits}/>
      </div>
      <EndTurnEvents entity={entity} detail={false}/>
    </div>);
  } else { return (<></>); }
}
