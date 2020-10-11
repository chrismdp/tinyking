import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";

export function EntityContainer({ entityId }) {
  const state = React.useContext(GameState);
  const container = state.ecs.container[entityId];
  const t = useTranslate();

  return (<span>{t("rooms.container", { smart_count: container.capacity })} {
    Object.keys(container.amounts)
      .filter(k => k != "id")
      .map(k => k + ": " + container.amounts[k]).join(", ")
  }</span>);
}

EntityContainer.propTypes = {
  entityId: PropTypes.string.isRequired
};
