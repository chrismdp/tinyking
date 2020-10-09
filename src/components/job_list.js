import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";

export function JobList({ workable }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const choose = React.useCallback((job) => {
    state.ui.actions.choose_job(state.ui.playerId, job, workable.id);
  }, [state.ui.playerId, state.ui.actions, workable]);

  if (workable.jobs && workable.jobs.length > 0) {
    return <div className="job-list">
      { workable.jobs.map(job => <button key={job.key} onClick={() => choose(job)}>{t("jobs." + job.key)}</button>) }
    </div>;
  } else {
    return "";
  }
}

JobList.propTypes = {
  workable: PropTypes.object
};

