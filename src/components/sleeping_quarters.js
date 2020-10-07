import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";
import { NameList } from "components/name_list";

export function SleepingQuarters({ entityId }) {
  const state = React.useContext(GameState);
  const sleep = state.ecs.sleepable[entityId];

  const t = useTranslate();

  return (<span className="sleeping-quarters">
    {t("rooms.sleeping_quarters.level" + sleep.level, { smart_count: sleep.capacity })}
    {sleep.occupiers.length > 0 && (<span>
      Occupied by:
      <NameList ids={sleep.occupiers}/>
    </span>)}
  </span>);
}

SleepingQuarters.propTypes = {
  entityId: PropTypes.string.isRequired
};
