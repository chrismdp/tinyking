import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";
import { EventList } from "components/event_list";
import { describeConditions, describeValidEvents } from "components/possible_action";

import { name } from "game/name";
import { validEventsFor, endTurnPayload } from "game/turn";

import turnRules from "data/turn.json";

export function EndTurnEvents({ entity, detail }) {
  const state = React.useContext(GameState);
  const [endTurnEvents, setEndTurnEvents] = React.useState(null);
  const t = useTranslate();

  React.useEffect(() => {
    let isCancelled = false;
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

  return (<>
    { endTurnEvents && endTurnEvents.length > 0 &&
      <>
        <p>
          <strong>{t("info.end_turn_conditions")}</strong>
        </p>
        {endTurnEvents.map((event, idx) => (
          <div key={idx}>
            {detail && <>
              <p>{t("info.unless_actions")}</p>
              <EventList
                events={event.effects}
                level={event.level}
                summary={event.summary && t(event.summary, { target: name(entity.nameable) })}
                conditions={event.conditions}/>
            </> ||
            <li>{t(event.summary, { target: name(entity.nameable) })}</li>}
          </div>
        ))}
      </>
    }
  </>);
}

EndTurnEvents.propTypes = {
  entity: PropTypes.object,
  detail: PropTypes.bool.isRequired
};
