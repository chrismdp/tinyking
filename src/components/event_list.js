import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

export function EventList({ summary, conditions, events, level }) {
  const t = useTranslate();
  return (<>
    { summary && (<p className={"level-" + level || "info"}>{(summary)}</p>) }
    { conditions && (<div className="knockedback">
      <p>{t("info.because")}</p>
      <ul>{
        conditions.map(c => (
          <li key={c}>{c}</li>
        ))
      }</ul>
    </div>) }
    { events && (Object.keys(events).map(name => (events[name].length > 0 ? <div key={name} className="knockedback">
      <span>{name}:</span>
      <ul>
        { events[name].map(e => (<li key={e}>{e}</li>)) }
      </ul>
    </div> : null))) }
  </>);
}

EventList.propTypes = {
  summary: PropTypes.string,
  level: PropTypes.string,
  description: PropTypes.string,
  conditions: PropTypes.arrayOf(PropTypes.string),
  events: PropTypes.object,
};
