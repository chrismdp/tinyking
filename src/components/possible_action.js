import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

import { name } from "game/name";

import { validEvents } from "game/turn";
import { phrasesFromObjectTree } from "game/i18n";

import { GameState } from "components/contexts";

export function PossibleAction({ actorId, targetId, action }) {
  const [events, setEvents] = React.useState(null);
  const state = React.useContext(GameState);
  const t = useTranslate();

  React.useEffect(() => {
    var isCancelled = false;
    (async () => {
      const { events, payload } = await validEvents(state.ecs, actorId, targetId, action);
      const phrases = events.reduce((result, event) => [...result, ...phrasesFromObjectTree(event)], []);
      const translated = phrases.map(({ phrase, value }) => t(phrase, {
        me: name(payload.me.nameable),
        target: name(payload.target.nameable),
        value
      }));
      if (!isCancelled) {
        setEvents(translated);
      }
    })();

    return () => { isCancelled = true; };
  }, [state, actorId, targetId, action, t]);

  return (
    <div>
      <h1>{ action.name }</h1>
      { events && (<ul>
        { events.map(e => (<li key={e}>{e}</li>)) }
      </ul>)
      }
    </div>
  );
}

PossibleAction.propTypes = {
  actorId: PropTypes.string.isRequired,
  targetId: PropTypes.string.isRequired,
  action: PropTypes.object.isRequired,
};
