import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";
import { validEventsFor, endTurnPayload } from "game/turn";

import { GameState } from "components/contexts";
import { Name } from "components/name";
import { Until } from "components/until";
import { name } from "game/name";
import { describeConditions, describeValidEvents } from "components/possible_action";
import { EventList } from "components/event_list";

import turnRules from "data/turn.json";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const [endTurnEvents, setEndTurnEvents] = React.useState(null);
  const [actionDescription, setActionDescription] = React.useState(null);
  const t = useTranslate();

  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? t("terrain." + entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable}/>) : "Information");
  const iControl = entity.personable && entity.personable.controller == state.ui.playerId;

  React.useEffect(() => {
    var isCancelled = false;
    (async () => {
      const payload = endTurnPayload(state.ecs, entity, state.clock);
      const events = await validEventsFor(turnRules.filter(r => !r.hidden), payload);
      const textEvents = await Promise.all(events.map(async event => ({
        summary: event.summary,
        level: event.level,
        conditions: describeConditions(event.conditions, entity, t),
        effects: event.rules ? await describeValidEvents(event.rules.target, entity, t) : {},
      })));
      if (!isCancelled) {
        setEndTurnEvents(textEvents);
      }
    })();

    return () => { isCancelled = true; };
  }, [entity, t, state.clock, state.ecs]);

  // Job assignment
  React.useEffect(() => {
    var isCancelled = false;
    (async () => {
      if (entity.assignable && entity.assignable.task) {
        const target = fullEntity(state.ecs, entity.assignable.task.id);
        const action = entity.assignable.task.action;
        const events = {
          ...await describeValidEvents(action.rules.me, entity, t),
          ...await describeValidEvents(action.rules.target, target, t)
        };
        if (!isCancelled) {
          setActionDescription({ action, events });
        }
      }
    })();

    return () => { isCancelled = true; };
  }, [entity, t, state.ecs]);

  return (
    <div>
      {title && (<h1 className="capitalise handle">{title}
        <span className="knockedback"> #{entity.id}</span>
      </h1>)}
      { entity.traits && (Object.keys(entity.traits.values).length > 0) && (
        <div><strong>{ Object.keys(entity.traits.values).map(trait => {
          return (<div key={trait}>{trait} {
            entity.traits.values[trait] !== true && (
              <span className="knockedback">
                <Until time={entity.traits.values[trait]}/>
              </span>)}
          </div>);
        }) }
        </strong></div>) }
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
      { actionDescription && (<>
        <p>
          <strong>{t("info.chosen_action")} {t("action." + actionDescription.action.key + ".name")}</strong>
        </p>
        <p><Until time={entity.assignable.endTime}/></p>
        <EventList level={actionDescription.action.level} summary={t("action." + actionDescription.action.key + ".summary")} events={actionDescription.events}/>
      </>)
          || (iControl && (<p>{t("info.you_control")}</p>)) }
      { endTurnEvents && endTurnEvents.length > 0 && endTurnEvents.map((event, idx) => (
        <div key={idx}>
          <p>
            <strong>{t("info.end_turn_conditions")}</strong>
          </p>
          <p>{t("info.unless_actions")}</p>
          <EventList
            events={event.effects}
            level={event.level}
            summary={event.summary && t(event.summary, { target: name(entity.nameable) })}
            conditions={event.conditions}/>
        </div>)) }
      { entity.spatial && (<span className="knockedback">{ JSON.stringify(entity.spatial) }</span>) }
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
