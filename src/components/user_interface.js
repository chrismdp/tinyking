import React from "react";

import { useSelector, useDispatch } from "react-redux";

import { MapGenParams } from "components/mapgen";
import { Info } from "components/info";
import { Window } from "components/window";
import { startGame, getWindows } from "features/ui_slice";

export function UserInterface() {
  const windows = useSelector(getWindows);

  const dispatch = useDispatch();
  const start = React.useCallback(() => dispatch(startGame()), [dispatch]);

  return (
    <div id="ui">
      {windows.map((w, index) => {
        const offset = (index + 2) * 30;
        switch(w.type) {
        case "info":
          return (<Window windowId={w.id} key={w.id} x={offset} y={offset}><Info entityId={w.entityId}/></Window>);
        case "mapgen":
          return (<Window onclose={start} windowId={w.id} key={w.id} x={offset} y={offset}><MapGenParams/></Window>);
        }
      })
      }
    </div>);
}
