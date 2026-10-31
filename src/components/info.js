import { historicalDate, centreHousehold, villageArea } from "game/settlement_details";
import { canPlaceField } from "game/land_use";
import { frozenAt } from "game/climate";
import { TravelOffer } from "./travel_offer";
import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";
import { Hex } from "game/map";
import { topController } from "game/playable";
import { homeOf } from "game/overworld";

import { GameState } from "components/contexts";
import { JobList } from "components/job_list";
import { TraitList } from "components/trait_list";
import { NameList } from "components/name_list";
import { Name } from "components/name";
import { FarmProgress } from "components/farm_progress";
import { SleepingQuarters } from "components/sleeping_quarters";
import { EntityContainer } from "components/entity_container";

import Engine from "json-rules-engine-simplified";
import { canPlaceShelter, STAGES } from "game/construction";
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

// NOTE: how a tile feels (high ground is colder) and the world hex it is in
function WorldHex({ mappable }) {
  const state = React.useContext(GameState);
  const t = useTranslate();
  const home = homeOf(state.world);
  const high = mappable.temperature != home.temperature;
  return (
    <div className="world-hex">
      <div>{t(high ? "world.high_ground" : "world.temperature", { value: mappable.temperature })}</div>
      <div>{t("world.world_hex", home)}</div>
      {mappable.elevation >= 260 && <div>{frozenAt(mappable,state.days) ? "Frozen highlands · a shorter growing season" : "Highland thaw · a shorter growing season"}</div>}
    </div>
  );
}

WorldHex.propTypes = {
  mappable: PropTypes.object.isRequired,
};

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const [showDebug, setShowDebug] = React.useState(false);
  const toggleDebug = React.useCallback(() => setShowDebug(sd => !sd), [setShowDebug]);

  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? t("terrain." + entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable} clickable={false}/>) : "Information");
  const houseId = (entity.animal || entity.farmable || entity.workplace || entity.backyard || entity.pasture)?.houseId;
  const ownerId = houseId && state.ecs.controllable?.[houseId]?.controllerId;
  const villageId=houseId ? state.ecs.village?.[houseId]?.villageId : state.ecs.village?.[entityId]?.villageId;
  const village = state.villages?.[villageId];
  const origin=village?.origin, growth=state.ecs.growth?.[entityId], centre=centreHousehold(state,villageId);

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
        const offered = result.map(r => r.jobs).flat().filter(job => job.key != "create_field" || canPlaceField(state,entityId));
        if (canPlaceShelter(state, entityId) || (entity.construction && !payload.job_targets.includes(entityId))) offered.push({ key: "build_shelter" });
        setJobs(offered);
      }
    })();

    return function cleanup() {
      isCancelled = true;
    };
  }, [setJobs, entity, state, state.ecs, state.ui.playerId, entityId, state.space]);

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
      {state.settlement?.fixture && state.settlement.fixture.villageId==villageId && <p className="settlement-fixture">{state.settlement.fixture.label}: {state.settlement.fixture.stocks}</p>}
      {origin && <div className="settlement-history">
        <p><strong>{village.name}</strong> · {village.houses.length} homes · {villageArea(state,villageId).length} plots and access tiles</p>
        {entity.meetingPlace?.kind=="green" && <>
          <p>Founded {historicalDate(origin.day)} by a household of {origin.people.length}: {origin.reason}.</p>
          <p>Centre household: {centre.name}.</p>
          {!!village.greenMoves?.length && <p>The green moved {historicalDate(village.greenMoves.at(-1).day)} for more gathering space. The founding well remains at the original centre.</p>}
          <p>Grey main connections, brown local tracks. The outline shows the village homes, plots and access.</p>
        </>}
      </div>}
      {growth && (entity.building || entity.workplace || entity.meetingPlace?.kind=="alehouse") && <div className="building-history">
        <p>Built {historicalDate(growth.builtDay)}{growth.construction ? " using "+growth.construction.timber+" timber" : ""} · {growth.stage ? "Expanded stage "+growth.stage : "Original building"}</p>
        {growth.additions.map(a=><p key={a.stage}>{a.name}: {historicalDate(a.day)} · {a.timber} timber from its household store.</p>)}
        <p>{growth.stage>=2 ? "Both additions are complete." : <>{entity.meetingPlace?.kind=="alehouse" ? "Regular visitors" : "Residents, productive work and food reserves"}: {growth.supportedSeasons} seasons towards the next addition{growth.waiting ? " · "+growth.waiting : ""}.</>}</p>
      </div>}
      { entity.mappable && entity.mappable.temperature && state.world && (<WorldHex mappable={entity.mappable}/>) }
      {entity.mappable && <TravelOffer entityId={entityId}/>}
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
      {entity.construction && <p>{entity.construction.delivered} of {STAGES[entity.construction.stage].logs} logs · {Math.floor(entity.construction.work * 60)} of {STAGES[entity.construction.stage].hours * 60} minutes of work</p>}
      {entity.container && <EntityContainer entityId={entityId}/>}
      { entity.building && (<><span>Rooms: </span>
        <ul>{
          entity.building.rooms.map(r => (<li key={r}>
            {state.ecs.container[r] && <EntityContainer entityId={r}/>}
            {state.ecs.sleepable[r] && <SleepingQuarters entityId={r}/>}
          </li>))}
        </ul>
      </>)}
      {houseId && <div className="household-owner">
        <div>Household: {state.ecs.nameable?.[ownerId] ? <NameList ids={[ownerId]}/> : "Unknown"}</div>
        <div>Village: {village?.name || "Unknown"}</div>
      </div>}
      { !houseId && entity.controllable && entity.controllable.controllerId != entity.id && (<>
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
