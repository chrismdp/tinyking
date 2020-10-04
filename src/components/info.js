import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";

import { GameState } from "components/contexts";
import { Name } from "components/name";
import { JobList } from "components/job_list";
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
      { entity.workable && <JobList workable={entity.workable}/>}
      <div><h2>Debug info:</h2>{
        Object.keys(entity).filter(c => entity[c]).map(c => <li key={c} className="knockedback">
          <strong>{c}</strong>: {JSON.stringify(entity[c])}
        </li>)
      }</div>
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
