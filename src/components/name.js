import React from "react";
import PropTypes from "prop-types";

import { name } from "game/name";

export function Name({ nameable }) {
  return (<span>{ name(nameable) }</span>);
}

Name.propTypes = {
  nameable: PropTypes.any.isRequired,
};
