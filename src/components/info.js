import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";

import { GameState } from "components/contexts";
import { JobList } from "components/job_list";
import { TraitList } from "components/trait_list";
import { NameList } from "components/name_list";
import { Name } from "components/name";
import { SleepingQuarters } from "components/sleeping_quarters";
import { Stockpile } from "components/stockpile";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const [showDebug, setShowDebug] = React.useState(false);
  const toggleDebug = React.useCallback(() => setShowDebug(sd => !sd), [setShowDebug]);

  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? t("terrain." + entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable} clickable={false}/>) : "Information");

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
      { entity.building && (<><span>Rooms: </span>
        <ul>{
          entity.building.rooms.map(r => (<li key={r}>
            {state.ecs.stockpile[r] && <Stockpile entityId={r}/>}
            {state.ecs.sleepable[r] && <SleepingQuarters entityId={r}/>}
          </li>))}
        </ul>
      </>)}
      { entity.controllable && entity.controllable.controllerId != entity.id && (<>
        <span>{ entity.personable ? "Liege:" : "Controlled by:"} </span>
        <NameList ids={[entity.controllable.controllerId]}/>
      </>)}
      { entity.workable && <JobList workable={entity.workable}/>}
      <div><a className="knockedback" onClick={toggleDebug}>(debug)</a>{ showDebug &&
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
