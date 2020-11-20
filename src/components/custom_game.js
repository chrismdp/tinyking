import React from "react";

import * as PIXI from "pixi.js";
import * as render from "pixi/render";

import { useTranslate } from "react-polyglot";
import { fullEntity } from "game/entities";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameState } from "components/contexts";
import { name } from "game/name";

function newSeed() {
  return Math.round(Math.random() * 10000000);
}

export function CustomGame() {
  const input = React.useRef();
  const nameField = React.useRef();
  const characterView = React.useRef();

  const [ currentName, setCurrentName ] = React.useState("");

  const state = React.useContext(GameState);

  const t = useTranslate();

  const seed = state.map.seed;
  const progress = state.ui.progress || {};

  const randomiseSeed = React.useCallback(() => input.current.value = newSeed(), []);
  const randomiseNameSeed = React.useCallback(() => {
    state.ecs.nameable[state.ui.playerId].seed = newSeed();
    state.ecs.nameable[state.ui.playerId].familySeed = newSeed();
    nameField.current.value = name(state.ecs.nameable[state.ui.playerId]);
  }, [state.ecs.nameable, state.ui.playerId]);

  const [ gender, setGender ] = React.useState(1);

  const update = React.useCallback(() => {
    state.ecs.personable[state.ui.playerId].body = gender ? 0xff0000 : 0x00ff00;
    state.redraws.push(state.ui.playerId);
  }, [state, gender]);

  const [ stage, setStage ] = React.useState(null);

  React.useEffect(() => {
    let app = new PIXI.Application({
      width: 100,
      height: 80,
      antialias: true,
      transparent: true,
      resolution: window.devicePixelRatio || 1,
      autoResize: true
    });
    setStage(app.stage);

    const ref = characterView.current;
    ref.appendChild(app.view);

    return function cleanup() {
      ref.removeChild(app.view);
      app.destroy();
    };
  }, [state]);

  React.useEffect(() => {
    if (!stage) {
      return;
    }

    let displayObject;
    if (state.ui.playerId) {
      const entity = fullEntity(state.ecs, state.ui.playerId);
      if (entity.spatial) {
        displayObject = render.person(state, entity, null, t);
        displayObject.position.set(35, 50);
        displayObject.scale.set(2, 2);
        displayObject.anchor = { x: 0.5, y: 0.5 };
        stage.addChild(displayObject);
      }
    }

    if (state.ecs.nameable && state.ecs.nameable[state.ui.playerId]) {
      const n = name(state.ecs.nameable[state.ui.playerId]);
      setCurrentName(n);
      nameField.current.value = n;
    }

    return function cleanup() {
      if (displayObject) {
        stage.removeChild(displayObject);
      }
    };
  }, [stage, state, t, state.ecs.nameable, state.ui.playerId, gender]);

  return (
    <div>
      <h1 className="handle">Start new game</h1>
      <div className="row">
        <div className="character" ref={characterView}></div>
        <button onClick={() => { setGender(0); update(); }} selected={gender == 0}>Male</button>
        <button onClick={() => { setGender(1); update(); }} selected={gender == 1}>Female</button>
      </div>
      <div className="row">
        <label htmlFor="name">Your name:</label>
        <input id="name" type="text" ref={nameField} defaultValue={currentName}/>
        <button onClick={randomiseNameSeed}><FontAwesomeIcon icon="dice"/></button>
      </div>
      <div className="row">
        <label htmlFor="seed">Map seed:</label>
        <input id="seed" type="text" ref={input} defaultValue={seed}/>
        <button onClick={randomiseSeed}><FontAwesomeIcon icon="dice"/></button>
      </div>
      <div className="row">
        <button onClick={() => state.ui.actions.generate_map(input.current.value)}>Reset to seed</button>
        { progress.label && <div className="progress">{progress.label}</div> }
      </div>
    </div>
  );
}
