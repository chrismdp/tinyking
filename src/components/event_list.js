import React from "react";
import PropTypes from "prop-types";
import { useTranslate } from "react-polyglot";

export function EventList({ summary, conditions, events }) {
  const t = useTranslate();
  return (<>
    { summary && (<p>{(summary)}</p>) }
    { conditions && (<div className={summary ? "knockedback" : ""}>
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
    { events && Object.keys(events).some(n => events[n].length > 0) ? null : <p className="knockedback">Nothing happens</p> }
  </>);
}

EventList.propTypes = {
  summary: PropTypes.string,
  description: PropTypes.string,
  conditions: PropTypes.arrayOf(PropTypes.string),
  events: PropTypes.object,
};
