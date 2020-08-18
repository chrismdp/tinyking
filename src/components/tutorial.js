import React from "react";

import { GameState } from "components/contexts";

const tutorial = [
  {
    description: "You are a Tiny King, destined for greatness! Your little lands may only consist of a small wooden shack, and a field, but in them there is the potential for a bustling economy!"
  },
  {
    show: { clock: true },
    description: "It's the beginning of spring - plenty of time until winter. You can take three actions a season."
  },
  {
    show: { supplies: true },
    description: "You have some food stored, but it's a great time to grow some grain to stop your supplies dwindling too much: one person eats one food at the end of each season. You have a small field to plough; time to make use of it."
  },
  {
    show: { next_action: true },
    task: {
      main: "Survive The Winter",
      sub: [ "Drag your character to the nearest field to plough it" ]
    }
  }
];

export function Tutorial() {
  const [ hiding, setHiding ] = React.useState(false);
  const [ stepCount, setStepCount ] = React.useState(0);

  const state = React.useContext(GameState);
  const ui = state.ui;

  const nextStep = React.useCallback(() => {
    setHiding(true);
    window.setTimeout(() => {
      setStepCount(s => s + 1);
      setHiding(false);
    }, 250);
  }, []);

  const step = tutorial[stepCount];

  React.useEffect(() => {
    if (step && step.show && ui.show[Object.keys(step.show)[0]] != true) {
      ui.actions.change_visibility(step.show);
    }
  });

  return (
    <>
      { step &&
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
      }
    </>
  );
}
