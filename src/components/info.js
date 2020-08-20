import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import Engine from "json-rules-engine-simplified";

import { phrasesFromObjectTree } from "game/i18n";
import { fullEntity } from "game/entities";
import { name } from "game/name";
import * as time from "game/time";

import { GameState } from "components/contexts";
import { Name } from "components/name";

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
      const rules = turnRules.map(r => ({ conditions: {}, ...{...r, event: { conditions: r.conditions, ...r.event } } }));
      const season = time.season(state.clock);
      const events = await new Engine(rules).run({ target: entity, season });
      const effects = events.map(event => ({
        description: event.description,
        conditions: phrasesFromObjectTree(event.conditions).map(({ phrase, value }) => t(phrase, {
          target: name(entity.nameable),
          value,
        })),
        effects: event.rules.reduce((result, e) => [
          ...result, ...phrasesFromObjectTree(e.event)
        ], []).map(({ phrase, value }) => t(phrase, {
          target: name(entity.nameable),
          value,
        }))
      }));
      if (!isCancelled) {
        setEndTurnEvents(effects);
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
      { iControl && (<p>You control this character. Click and drag to assign to a job.</p>) }
      { entity.habitable && ("Owners: " + entity.habitable.owners)}
      { endTurnEvents && endTurnEvents.length > 0 &&
          (<>
            <h2>At the end of this turn:</h2>
            <ul>
              { endTurnEvents.map(event => {
                return (<li key={event}>
                  {t("grammar.sentence." + event.effects.length, { ...event.effects })}
                  &nbsp;({t("grammar.sentence." + event.conditions.length, { ...event.conditions })})
                </li>); }) }
            </ul>
          </>)
      }
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
