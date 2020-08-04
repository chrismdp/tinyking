import React from "react";

import { useSelector, useDispatch } from "react-redux";
import { getTutorialSteps, continueTutorial } from "features/ui_slice";

export function Tutorial() {
  const [ hiding, setHiding ] = React.useState(false);
  const step = useSelector(getTutorialSteps);
  const dispatch = useDispatch();
  const nextStep = React.useCallback(() => {
    setHiding(true);
    window.setTimeout(() => {
      dispatch(continueTutorial());
      setHiding(false);
    }, 500);
  }, [dispatch]);
  return (
    <div id="tutorial">
      {step.task &&
        (<div className={`task ${hiding ? "hiding" : ""}`}>
          <div className="main">{step.task.main}</div>
          { step.task.sub && step.task.sub.map((sub, i) => (<li key={i}>{sub}</li>))}
        </div>)}
      {step.description && (
        <div className={`description ${hiding ? "hiding" : ""}`}>
          <p>{step.description}</p>
          <p><a onClick={nextStep}>Continue</a></p>
        </div>)}
    </div>
  );
}
