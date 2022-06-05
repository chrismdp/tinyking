import React from "react";
import PropTypes from "prop-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameState } from "components/contexts";

export function CharacterSelection({ label, id, attribute, selections, onChange }) {
  const state = React.useContext(GameState);

  const [ value, setValue ] = React.useState(0);
  React.useEffect(() => {
    if (state.ecs.personable && state.ecs.personable[id]) {
      setValue(state.ecs.personable[id][attribute]);
    }
  }, [state, id, attribute, state.ecs.personable]);
  React.useEffect(() => {
    state.ecs.personable[id][attribute] = value;
    state.redraws.push(id);
    if (onChange) {
      onChange();
    }
  }, [state, id, attribute, value, onChange]);

  return (<div className="row">
    <label>{label}</label>
    <button onClick={() => { setValue((value - 1 + selections.length) % selections.length); }}><FontAwesomeIcon icon="caret-left"/></button>
    <div className="selection">{value + 1}</div>
    <button onClick={() => { setValue((value + 1) % selections.length); }}><FontAwesomeIcon icon="caret-right"/></button>
  </div>);
}

CharacterSelection.propTypes = {
  label: PropTypes.string.isRequired,
  id: PropTypes.string,
  attribute: PropTypes.string.isRequired,
  selections: PropTypes.arrayOf(PropTypes.number).isRequired,
  onChange: PropTypes.func
};
