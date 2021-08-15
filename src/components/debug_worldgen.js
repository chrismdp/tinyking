import React from "react";
import { GameState } from "components/contexts";
import { SpeedControls } from "components/speed_controls";

export function DebugWorldgen() {
  const state = React.useContext(GameState);

  React.useEffect(() => {
    if (state && state.ui) {
      state.ui.show.main_menu = false;
    }
  }, [state, state.ui]);

  return (
    <div id="ui">
    </div>
  );
}
