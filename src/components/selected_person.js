import React from "react";
//import { GameState } from "components/contexts";

//import { useTranslate } from "react-polyglot";

export function SelectedPerson({ entityId }) {
  //const state = React.useContext(GameState);

  if (entityId) {
    return (
      <div id="selected-person">
      Selected person: {entityId}
      </div>
    );
  } else { return (<></>); }
}
