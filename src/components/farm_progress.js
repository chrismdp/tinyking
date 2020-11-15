import React from "react";
import PropTypes from "prop-types";

import { GameState } from "components/contexts";

import { Until } from "components/until";

import crops from "data/crops.json";

export function FarmProgress({ farmable }) {
  const state = React.useContext(GameState);

  const next = farmable.slots.filter(s => s.state == "sown")
    .reduce((res, s) => {
      const progress = (state.days - s.updated) / crops[s.content].growingTime;
      return (progress > res[1]) ? [s, progress] : res;
    }, [null, 0]);

  return next[0] && (<div>
    <div>
      Next harvest: {next[0].content} <progress max="1" value={next[1]}/>
    </div>
    <Until time={next[0].updated + crops[next[0].content].growingTime}/>
  </div>);
}

FarmProgress.propTypes = {
  farmable: PropTypes.object.isRequired
};
