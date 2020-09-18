import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";
import { Until } from "components/until";
import { EventList } from "components/event_list";
import { describeValidEvents } from "components/possible_action";

import { fullEntity } from "game/entities";

export function AssignedTask({ assignable }) {
  const state = React.useContext(GameState);
  const [actionDescription, setActionDescription] = React.useState(null);
  const t = useTranslate();

  const personable = state.ecs.personable[assignable.id];
  const iControl = personable && personable.controller == state.ui.playerId;

  React.useEffect(() => {
    var isCancelled = false;
    (async () => {
      if (assignable && assignable.task) {
        const target = fullEntity(state.ecs, assignable.task.id);
        const action = assignable.task.action;
        const events = {
          ...await describeValidEvents(action.rules.me, fullEntity(state.ecs, assignable.id), t),
          ...await describeValidEvents(action.rules.target, target, t)
        };
        if (!isCancelled) {
          setActionDescription({ action, events });
        }
      }
    })();

    return () => { isCancelled = true; };
  }, [assignable, assignable.task, t, state.ecs]);

  return (<>{ actionDescription &&
    (<>
      <p>
        <strong>{t("info.chosen_action")} {t("action." + actionDescription.action.key + ".name")}</strong>
      </p>
      <p><Until time={assignable.endTime}/></p>
      <EventList level={actionDescription.action.level} summary={t("action." + actionDescription.action.key + ".summary")} events={actionDescription.events}/>
    </>)
        || (iControl && (<p>{t("info.you_control")}</p>)) }
  </>);
}

AssignedTask.propTypes = {
  assignable: PropTypes.object
};

