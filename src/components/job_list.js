import React from "react";
import PropTypes from "prop-types";

import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";

export function JobList({ jobs, targetId }) {
  const state = React.useContext(GameState);
  const t = useTranslate();

  const choose = React.useCallback((job) => {
    state.ui.actions.choose_job(state.ui.playerId, job, targetId);
  }, [state.ui.playerId, state.ui.actions, targetId]);

  if (jobs && jobs.length > 0) {
    return <div className="job-list">
      { jobs.map(job => <button key={job.key} onClick={() => choose(job)}>{t("jobs." + job.key)}</button>) }
    </div>;
  } else {
    return "";
  }
}

JobList.propTypes = {
  jobs: PropTypes.array,
  targetId: PropTypes.string.isRequired
};

