import React from "react";

import * as PIXI from "pixi.js";
import * as render from "pixi/render";

import { useTranslate } from "react-polyglot";
import { fullEntity } from "game/entities";

import { Grid, Hex } from "game/map";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameState } from "components/contexts";
import { firstName, familyName } from "game/name";

function newSeed() {
  return Math.round(Math.random() * 10000000);
}

export function CustomGame() {
  const characterView = React.useRef();

  const state = React.useContext(GameState);

  const t = useTranslate();

  const progress = state.ui.progress || {};

  const seedField = React.useRef();
  const randomiseSeed = React.useCallback(() => {
    state.map.seed = newSeed();
    seedField.current.value = state.map.seed;
  }, [state.map]);

  const nameField = React.useRef();
  const randomiseNameSeed = React.useCallback(() => {
    state.ecs.nameable[state.ui.playerId].seed = newSeed();
    nameField.current.value = firstName(state.ecs.nameable[state.ui.playerId]);
  }, [state.ecs.nameable, state.ui.playerId]);

  const familyNameField = React.useRef();
  const randomiseFamilyNameSeed = React.useCallback(() => {
    state.ecs.nameable[state.ui.playerId].familySeed = newSeed();
    familyNameField.current.value = familyName(state.ecs.nameable[state.ui.playerId]);
  }, [state.ecs.nameable, state.ui.playerId]);

  const [ gender, setGender ] = React.useState();
  const update = React.useCallback(() => {
    state.ecs.personable[state.ui.playerId].body = gender ? 0xff0000 : 0x00ff00;
    state.redraws.push(state.ui.playerId);
  }, [state, gender]);

  const reset = React.useCallback(() =>
    state.ui.actions.generate_map(seedField.current.value), [state]);

  const [ stage, setStage ] = React.useState(null);

  React.useEffect(() => {
    const ref = characterView.current;
    let app;
    if (ref) {
      app = new PIXI.Application({
        width: 300,
        height: 250,
        antialias: true,
        transparent: true,
        resolution: window.devicePixelRatio || 1,
        autoResize: true
      });
      setStage(app.stage);

      ref.appendChild(app.view);
    }

    return function cleanup() {
      if (ref) {
        ref.removeChild(app.view);
      }
      if (app) {
        app.destroy();
      }
    };
  }, [state, state.map]);

  React.useEffect(() => {
    if (!stage) {
      return;
    }

    let displayObject;
    if (state.ui.playerId) {
      const spiral = Grid.spiral({ center: { x: 0, y: 0 }, radius: 1 });
      const map = new PIXI.Container();
      for (let spiral_index = 0; spiral_index < spiral.length; spiral_index++) {
        const hex = spiral[spiral_index];

        const neighbour = new PIXI.Graphics();
        neighbour.position = Hex(hex).toPoint();
        neighbour.beginFill(render.COLOURS.grassland);
        neighbour.lineStyle({color: "black", width: 2, alpha: 0.04});
        neighbour.drawPolygon(...Hex().corners());
        neighbour.endFill();
        neighbour.interactive = true;
        map.addChild(neighbour);

        if (spiral_index > 0) {
          const town = new PIXI.Graphics();
          const point = Hex(hex).toPoint();
          town.position.set(point.x * 1.0, point.y * 1.0);
          town.beginFill(render.COLOURS.stone, 0.5);
          town.drawCircle(0, 0, 20);
          map.addChild(town);
        }
      }
      map.position.set(135, 125);
      map.scale.set(0.75, 0.75);
      map.anchor = { x: 0.5, y: 0.5 };
      stage.addChild(map);

      const entity = fullEntity(state.ecs, state.ui.playerId);
      if (entity.spatial && entity.personable) {
        displayObject = render.person(state, entity, null, t);
        displayObject.position.set(135, 125);
        displayObject.scale.set(1, 1);
        displayObject.anchor = { x: 0.5, y: 0.5 };
        stage.addChild(displayObject);
      }
    }

    if (seedField.current && state.map) {
      seedField.current.value = state.map.seed;
    }

    if (state.ecs.nameable && state.ecs.nameable[state.ui.playerId]) {
      const n = state.ecs.nameable[state.ui.playerId];

      nameField.current.value = firstName(n);
      familyNameField.current.value = familyName(n);
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
      { state.map && <>
        <div icon="person">
          <div className="character" ref={characterView}></div>
          <div className="row" style={{clear: "both"}}>
            <label htmlFor="name">First name:</label>
            <input type="text" ref={nameField}/>
            <button onClick={randomiseNameSeed}><FontAwesomeIcon icon="dice"/></button>
          </div>
          <div className="row">
            <button onClick={() => { setGender(0); update(); }} selected={gender == 0}>Male</button>
            <button onClick={() => { setGender(1); update(); }} selected={gender == 1}>Female</button>
          </div>
          <div className="row" style={{display: "none"}}>
            <label htmlFor="name">House:</label>
            <input type="text" ref={familyNameField}/>
            <button onClick={randomiseFamilyNameSeed}><FontAwesomeIcon icon="dice"/></button>
          </div>
        </div>
        <hr/>
        <div icon="dice">
          <div className="row">
            <label htmlFor="seed">Map seed:</label>
            <input id="seed" type="text" ref={seedField} onChange={() => state.map.seed = seedField.current.value}/>
            <button onClick={randomiseSeed}><FontAwesomeIcon icon="dice"/></button>
          </div>
          <div className="row">
            <button onClick={reset}>Reset to seed</button>
            { progress.label && <div className="progress">{progress.label}</div> }
          </div>
        </div>
      </> }
    </div>
  );
}
