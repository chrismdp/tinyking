import React from "react";
import PropTypes from "prop-types";

import { Until } from "components/until";

export function TraitList({ traits }) {
  return (<>
    { traits && (Object.keys(traits.values).length > 0) && (
      <div>
        <strong>
          { Object.keys(traits.values).map(trait => {
            return (<div key={trait}>{trait} {
              traits.values[trait] !== true && (
                <span className="knockedback">
                  <Until time={traits.values[trait]}/>
                </span>)}
            </div>);
          }) }
        </strong>
      </div>)
    }
  </>);
}

TraitList.propTypes = {
  traits: PropTypes.object
};
