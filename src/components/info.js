import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { fullEntity } from "game/entities";
import * as time from "game/time";
import { validEventsFor } from "game/turn";

import { GameState } from "components/contexts";
import { Name } from "components/name";
import { describeConditions, describeValidEvents } from "components/possible_action";
import { EventList } from "components/event_list";

import { turnRules } from "data/turn";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const [endTurnEvents, setEndTurnEvents] = React.useState(null);
  const t = useTranslate();

  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? t("terrain." + entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable}/>) : "Information");
  const iControl = state.ecs.playable[state.ui.playerId].controls.includes(entityId);

  React.useEffect(() => {
    var isCancelled = false;
    (async () => {
      const season = time.season(state.clock);
      const events = await validEventsFor(turnRules, { target: entity, season });
      const textEvents = await Promise.all(events.map(async event => ({
        description: event.description,
        conditions: describeConditions(event.conditions, entity, t),
        effects: await describeValidEvents(event.rules.target, entity, t)
      })));
      if (!isCancelled) {
        setEndTurnEvents(textEvents);
      }
    })();

    return () => { isCancelled = true; };
  }, [entity, t, state.clock]);

  return (
    <div>
      {title && (<h1 className="capitalise handle">{title}</h1>)}
      { entity.traits && entity.traits.values.length > 0 && (<div>Traits: <strong>{ entity.traits.values.join(", ") }</strong></div>) }
      { entity.attributes && (<div>
        {
          Object.keys(entity.attributes).filter(a => a != "id").map(k => {
            return (
              <div className="capitalise attribute" key={k}>
                {k} ({entity.attributes[k]} / 10)
                <progress max="10" value={entity.attributes[k]}/>
              </div>
            );
          })
        }
      </div>)}
      { iControl && (<p>{t("info.youcontrol")}</p>) }
      { entity.habitable && ("Owners: " + entity.habitable.owners)}
      { endTurnEvents && endTurnEvents.length > 0 &&
          (<>
            <p>{t("info.endturnconditions")}</p>
            { endTurnEvents.map(event => (
              <EventList
                key={event}
                description={event.description}
                events={event.effects}
                conditions={event.conditions}/>))
            }
          </>)
      }
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
