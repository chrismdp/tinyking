import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";
import * as time from "game/time";
import { validEventsFor } from "game/turn";

import { GameState } from "components/contexts";
import { Name } from "components/name";
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
  const iControl = state.ecs.playable[state.ui.playerId].controls.includes(entityId);

  React.useEffect(() => {
    var isCancelled = false;
    (async () => {
      const season = time.season(state.clock);
      const time_of_day = time.time(state.clock);
      const events = await validEventsFor(turnRules.filter(r => !r.hidden), { target: entity, season, time_of_day });
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
  }, [entity, t, state.clock]);

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
      {title && (<h1 className="capitalise handle">{title}</h1>)}
      { entity.traits && (Object.keys(entity.traits.values).length > 0) && (
        <div><strong>{ Object.keys(entity.traits.values).map(trait => {
          return (<span key={trait}>{trait} {
            entity.traits.values[trait] !== true && (
              <span className="knockedback">{t("info.until", {
                time: time.full(entity.traits.values[trait]),
                turns: entity.traits.values[trait] - state.clock
              })}</span>)}
          </span>);
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
      { entity.habitable && ("Owners: " + entity.habitable.owners)}
      { actionDescription && (<>
        <p>
          <strong>{t("info.chosen_action")} {t("action." + actionDescription.action.key + ".name")}</strong>
        </p>
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
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
