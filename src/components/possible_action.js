import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

import { name } from "game/name";

import { fullEntity } from "game/entities";
import { validEventsFor } from "game/turn";
import { phrasesFromObjectTree } from "game/i18n";

import { GameState } from "components/contexts";
import { EventList } from "components/event_list";

export function describeConditions(conditions, entity, t) {
  return phrasesFromObjectTree(conditions).map(({ phrase, value }) => t(phrase, {
    target: name(entity.nameable),
    value,
    smart_count: value
  }));
}

export async function describeValidEvents(rules, payload, t) {
  const events = await validEventsFor(rules, payload);
  const phrases = events.map(event => phrasesFromObjectTree(event)).flat();
  return {
    [name(payload.nameable)]: phrases.map(({ phrase, value }) =>
      t(phrase, { name: name(payload.nameable), value, smart_count: value }))
  };
}

export function PossibleAction({ actorId, targetId, action }) {
  const [events, setEvents] = React.useState(null);
  const state = React.useContext(GameState);
  const t = useTranslate();

  React.useEffect(() => {
    let isCancelled = false;
    (async () => {
      const events = {
        ...await describeValidEvents(action.rules.me, fullEntity(state.ecs, actorId), t),
        ...await describeValidEvents(action.rules.target, fullEntity(state.ecs, targetId), t)
      };
      if (!isCancelled) {
        setEvents(events);
      }
    })();

    return () => { isCancelled = true; };
  }, [state, actorId, targetId, action, t]);

  return (
    <div>
      <h1>{ t("action." + action.key + ".name") }</h1>
      <EventList level={action.level} summary={t("action." + action.key + ".summary")} events={events}/>
    </div>
  );
}

PossibleAction.propTypes = {
  actorId: PropTypes.string.isRequired,
  targetId: PropTypes.string.isRequired,
  action: PropTypes.object.isRequired,
};
