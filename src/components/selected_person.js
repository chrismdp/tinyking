import React from "react";
import { GameState } from "components/contexts";

import { useTranslate } from "react-polyglot";

import { Name } from "components/name";
import { TraitList } from "components/trait_list";
import { Until } from "components/until";

import { fullEntity } from "game/entities";

export function SelectedPerson({ entityId }) {
  const state = React.useContext(GameState);
  const entity = fullEntity(state.ecs, entityId);
  const t = useTranslate();

  if (entityId) {
    return (<div id="selected-person">
      <h1 className="capitalise handle">
        <Name nameable={entity.nameable} clickable={true}/>
        &nbsp;<span className="knockedback">
          { entity.personable.dead ?
            "Dead" :
            (entity.assignable.task
              && t("action." + entity.assignable.task.action.key + ".name")
              || <>Moves: {entity.attributes.moves}</>)
          }</span>
      </h1>
      <p>
        { entity.assignable.task && <Until time={entity.assignable.endTime}/> }
      </p>
      <div className="traits">
        <TraitList traits={entity.traits}/>
      </div>
    </div>);
  } else { return (<></>); }
}
