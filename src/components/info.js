import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";
import { Hex } from "game/map";
import { topController } from "game/playable";

import { GameState } from "components/contexts";
import { JobList } from "components/job_list";
import { TraitList } from "components/trait_list";
import { NameList } from "components/name_list";
import { Name } from "components/name";
import { FarmProgress } from "components/farm_progress";
import { SleepingQuarters } from "components/sleeping_quarters";
import { EntityContainer } from "components/entity_container";

import Engine from "json-rules-engine-simplified";
import rules from "data/jobs.json";

function Job({ job, managerId, linkToTarget }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const cancelJob = React.useCallback((managerId, key, targetId) => {
    state.ui.actions.cancel_job(managerId, key, targetId);
  }, [state.ui.actions]);

  const click = React.useCallback(() => state.ui.actions.select_entity(job.targetId, false),
    [job, state.ui.actions]);

  return (<li>
    { linkToTarget ? (<a onClick={click}>{t("jobs." + job.job.key)}</a>) : t("jobs." + job.job.key) }
    { job.assignedId && (<span> - assigned to:&nbsp;
      <Name nameable={state.ecs.nameable[job.assignedId]}/>
    </span>)}
    &nbsp;(<a onClick={() => cancelJob(managerId, job.job.key, job.targetId)}>{t("jobs.cancel_job")}</a>)
  </li>);
}

Job.propTypes = {
  job: PropTypes.object.isRequired,
  managerId: PropTypes.string.isRequired,
  linkToTarget: PropTypes.bool.isRequired
};

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
        job_targets: state.ecs.manager[topController(state.ecs, state.ui.playerId)].jobs.map(j => j.targetId),
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

  const [targetOfJobs, setTargetOfJobs] = React.useState([]);
  React.useEffect(() => {
    for (const id in state.ecs.manager) {
      const manager = state.ecs.manager[id];
      setTargetOfJobs(manager.jobs
        .filter(j => j.targetId == entityId)
        .map(j => ({...j, managerId: id})));
    }
  }, [state.ecs.manager, entityId]);

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
      { entity.farmable && entity.farmable.slots.some(s => s.state == "sown") && <FarmProgress farmable={entity.farmable}/> }
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
      <div>
        { targetOfJobs.map((j, idx) => (<Job linkToTarget={false} key={idx} job={j} managerId={j.managerId}/>)) }
      </div>
      { entity.manager && (<div>
        {entity.manager.jobs.map((j, idx) => (<Job linkToTarget={true} key={idx} job={j} managerId={entityId}/>)) }
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
