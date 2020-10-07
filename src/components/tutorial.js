import React from "react";
import { useTranslate } from "react-polyglot";

import { GameState } from "components/contexts";


const tutorial = [
  { description: "start" },
  {
    show: { clock: true },
    description: "time",
  },
  {
    task: "plough",
    count: 4,
    continueOnClock: 1
  },
  { description: "afternoon" },
  {
    task: "eat_grain",
    count: 3,
    continueOnClock: 3
  },
  { description: "eat" },
  { description: "skipping_turns" },
  {
    task: "skip_turns",
    count: 1,
    continueOnClock: 4
  },
  { description: "summer" },
  {
    task: "gather",
    count: 3,
    continueOnClock: 6
  },
  { description: "sow" },
  {
    task: "sow",
    count: 2,
    continueOnClock: 8
  },
  { description: "harvest" },
  {
    task: "harvest",
    count: 1,
    continueOnClock: 9
  },
  { description: "survived" },
];

export function Tutorial() {
  const t = useTranslate();
  const [ hiding, setHiding ] = React.useState(false);
  const [ stepCount, setStepCount ] = React.useState(0);

  const state = React.useContext(GameState);
  const ui = state.ui;

  const nextStep = React.useCallback(() => {
    if (!hiding) {
      setHiding(true);
      window.setTimeout(() => {
        let newState;
        setStepCount(s => newState = s + 1);
        if (newState < tutorial.length) {
          setHiding(false);
        }
      }, 250);
    }
  }, [hiding]);

  const skip = React.useCallback(() => {
    tutorial.map(s => s.show).forEach(show => {
      show && ui.actions.change_visibility(show);
    });
    setHiding(true);
  }, [ui.actions]);

  const step = tutorial[stepCount];

  React.useEffect(() => {
    if (step && step.show && ui.show[Object.keys(step.show)[0]] != true) {
      ui.actions.change_visibility(step.show);
    }
  });

  React.useEffect(() => {
    if (step && state.days >= step.continueOnClock) {
      nextStep();
    }
  }, [state.days, stepCount, nextStep, step]);

  return (<>
    { step &&
      <div id="tutorial">
        {step.task &&
          (<div className={`task ${hiding ? "hiding" : ""}`}>
            <div className="main">{t("tutorial.tasks." + step.task + ".main")}</div>
            {Array(step.count).fill().map((_, i) => (<li key={i}>{t("tutorial.tasks." + step.task + ".steps."+ i)}</li>))}
          </div>)}
        {step.description && (
          <div className={`description ${hiding ? "hiding" : ""}`}>
            <p>{t("tutorial.descriptions." + step.description)}</p>
            <p>
              <a onClick={nextStep}>{t("tutorial.continue")}</a>
              <a onClick={skip}>{t("tutorial.skip")}</a>
            </p>
          </div>)}
      </div>
    }
  </>);
}
