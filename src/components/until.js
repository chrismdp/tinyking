import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";
import * as timeDisplay from "game/time";

export function Until({ time }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  return (<>
    {t("info.until", { time: timeDisplay.full(time), smart_count: time - state.clock })}
  </>);
}

Until.propTypes = {
  time: PropTypes.number
};
