import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";

import { GameState } from "components/contexts";
import { Name } from "components/name";
import { EndTurnEvents } from "components/end_turn_events";
import { AssignedTask } from "components/assigned_task";
import { TraitList } from "components/trait_list";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? t("terrain." + entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable}/>) : "Information");

  return (
    <div>
      {title && (<h1 className="capitalise handle">{title}
        <span className="knockedback"> #{entity.id}</span>
      </h1>)}
      <TraitList traits={entity.traits}/>
      { entity.attributes && (<div>
        {
          Object.keys(entity.attributes).filter(a => a != "id" && entity.attributes[a] < 10).map(k => {
            return (
              <div className="capitalise attribute" key={k}>
                {k} ({entity.attributes[k]} / 10)
                <progress max="10" value={entity.attributes[k]}/>
              </div>
            );
          })
        }
      </div>)}
      { entity.habitable && (<>
        <span>Owners: </span>
        {entity.habitable.owners.map(o => (<span key={o}>
          <Name nameable={state.ecs.nameable[o]}/>&nbsp;
        </span>))}
      </>)}
      { entity.assignable && <AssignedTask assignable={entity.assignable}/>}
      <EndTurnEvents entity={entity} detail={true}/>
      { entity.spatial && (<span className="knockedback">{ JSON.stringify(entity.spatial) }</span>) }
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
