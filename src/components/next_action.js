import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";

import { getKnown, filterByKnown } from "features/entities/playable_slice";
import { getAllComponents } from "features/entities_slice";
import { endTurn } from "features/turn_slice";
import { PlayerContext } from "components/player_context";

const knownAssignables = () => createSelector(
  getAllComponents("assignable", "spatial"),
  getKnown,
  filterByKnown);

export function NextAction() {
  const playerId = React.useContext(PlayerContext);
  console.log(playerId);
  const getKnownAssignables = React.useMemo(knownAssignables, [playerId]);
  const assignables = useSelector(state => getKnownAssignables(state, playerId));
  const toAssign = assignables.filter(a => !a.assignable.task).length;

  const dispatch = useDispatch();
  const clickEndTurn = React.useCallback(() => dispatch(endTurn()), [dispatch]);

  return (
    <div id="next-action">
      {toAssign > 0 &&
        <button disabled="disabled">{toAssign} left to assign</button>
        || <button onClick={clickEndTurn}>End Turn</button>}
    </div>
  );
}
