import React from "react";
import PropTypes from "prop-types";

import { GameState } from "components/contexts";

import { growingAt } from "game/climate";

import crops from "data/crops.json";

export function FarmProgress({ farmable }) {
  const state = React.useContext(GameState);

  const next = farmable.slots.filter(s => s.state == "sown")
    .reduce((res, s) => {
      const progress = (s.growth || 0) / crops[s.content].growingTime;
      return (!res[0] || progress > res[1]) ? [s, progress] : res;
    }, [null, 0]);

  return next[0] && (<div>
    <div>
      Next harvest: {next[0].content} <progress max="1" value={next[1]}/>
    </div>
    <div>{!growingAt(state,farmable.id) ? "Growth paused for winter" :
      (crops[next[0].content].growingTime * (1 - next[1])).toFixed(1) + " growing days left"}</div>
  </div>);
}

FarmProgress.propTypes = {
  farmable: PropTypes.object.isRequired
};
