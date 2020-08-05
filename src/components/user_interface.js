import React from "react";

import { useSelector, useDispatch } from "react-redux";

import { MapGenParams } from "components/mapgen";
import { Info } from "components/info";
import { Window } from "components/window";
import { MainMenu } from "components/main_menu";
import { Tutorial } from "components/tutorial";
import { Clock } from "components/clock";
import { Supplies } from "components/supplies";
import { startGame, getWindows, getVisibility } from "features/ui_slice";

export function UserInterface() {
  const windows = useSelector(getWindows);
  const show = useSelector(getVisibility);

  const dispatch = useDispatch();
  const start = React.useCallback(() => dispatch(startGame()), [dispatch]);

  return (
    <div id="ui">
      {show.clock && <Clock/>}
      {show.supplies && <Supplies/>}
      {windows.map((w, index) => {
        const offset = (index + 2) * 30;
        switch(w.type) {
        case "main-menu":
          return (<MainMenu key={w.id}/>);
        case "tutorial":
          return (<Tutorial key={w.id}/>);
        case "info":
          return (<Window windowId={w.id} key={w.id} x={offset} y={offset}><Info entityId={w.entityId}/></Window>);
        case "mapgen":
          return (<Window onclose={start} windowId={w.id} key={w.id} x={offset} y={offset}><MapGenParams/></Window>);
        }
      })
      }
    </div>);
}
