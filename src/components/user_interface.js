import React from "react";

import { useSelector } from "react-redux";

import { MapGenParams } from "components/mapgen";
import { Info } from "components/info";
import { getWindows } from "features/ui_slice";

export function UserInterface() {
  const windows = useSelector(getWindows);

  return (
    <div id="ui">
      {windows.map((w, index) => {
        const offset = (index + 2) * 30;
        switch(w.type) {
        case "info":
          return (<Info windowId={w.id} key={w.id} entity={w.entity} x={offset} y={offset}/>);
        case "mapgen":
          return (<MapGenParams key={w.id} x={offset} y={offset}/>);
        }
      })
      }
    </div>);
}
