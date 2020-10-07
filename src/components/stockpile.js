import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";

export function Stockpile({ entityId }) {
  const state = React.useContext(GameState);
  const stockpile = state.ecs.stockpile[entityId];
  const t = useTranslate();

  return (<span>{t("rooms.stockpile", { smart_count: stockpile.capacity })} {
    Object.keys(stockpile.amounts)
      .filter(k => k != "id")
      .map(k => k + ": " + stockpile.amounts[k]).join(", ")
  }</span>);
}

Stockpile.propTypes = {
  entityId: PropTypes.string.isRequired
};
