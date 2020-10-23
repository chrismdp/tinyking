import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";
import { Hex } from "game/map";

import { GameState } from "components/contexts";
import { JobList } from "components/job_list";
import { TraitList } from "components/trait_list";
import { NameList } from "components/name_list";
import { Name } from "components/name";
import { SleepingQuarters } from "components/sleeping_quarters";
import { EntityContainer } from "components/entity_container";

import Engine from "json-rules-engine-simplified";
import rules from "data/jobs.json";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const [showDebug, setShowDebug] = React.useState(false);
  const toggleDebug = React.useCallback(() => setShowDebug(sd => !sd), [setShowDebug]);

  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? t("terrain." + entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable} clickable={false}/>) : "Information");

  const [jobs, setJobs] = React.useState([]);

  React.useEffect(() => {
    let isCancelled = false;

    (async () => {
      const payload = {
        target: entity,
        actor: fullEntity(state.ecs, state.ui.playerId),
        other: state.space[Hex().fromPoint(entity.spatial)]
          .filter(id => id != entityId)
      };
      const result = await new Engine(rules).run(payload);
      if (!isCancelled) {
        setJobs(result.map(r => r.jobs).flat());
      }
    })();

    return function cleanup() {
      isCancelled = true;
    };
  }, [setJobs, entity, state.ecs, state.ui.playerId, entityId, state.space]);

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
            {state.ecs.container[r] && <EntityContainer entityId={r}/>}
            {state.ecs.sleepable[r] && <SleepingQuarters entityId={r}/>}
          </li>))}
        </ul>
      </>)}
      { entity.controllable && entity.controllable.controllerId != entity.id && (<>
        <span>{ entity.personable ? "Liege:" : "Controlled by:"} </span>
        <NameList ids={[entity.controllable.controllerId]}/>
      </>)}
      { entity.manager && (<div>
        {entity.manager.jobs.map((j, idx) => (<li key={idx}>
          { JSON.stringify(j.job) } : {j.targetId}
          { j.assignedId && (<span>Assigned to:
            <Name nameable={state.ecs.nameable[j.assignedId]}/>
          </span>)}
        </li>))}
      </div>)}
      { <JobList jobs={jobs} targetId={entity.id}/>}
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
