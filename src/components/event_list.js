import React from "react";
import PropTypes from "prop-types";

export function EventList({ description, conditions, events }) {
  return (<>
    { description && (<p>{description}</p>) }
    { conditions && (<ul>{
      conditions.map(c => (
        <li key={c}>{c}</li>
      ))
    }</ul>) }
    { events && (Object.keys(events).map(name => (events[name].length > 0 ? <div key={name}>
      <span>{name}:</span>
      <ul>
        { events[name].map(e => (<li key={e}>{e}</li>)) }
      </ul>
    </div> : null))) }
    { events && Object.keys(events).some(n => events[n].length > 0) ? null : <p>Nothing happens</p> }
  </>);
}

EventList.propTypes = {
  description: PropTypes.string,
  conditions: PropTypes.arrayOf(PropTypes.string),
  events: PropTypes.object,
};
