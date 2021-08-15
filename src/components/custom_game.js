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

const TABS = {
  PERSON: 0,
  HOUSE: 1,
  NEIGHBOUR: 2,
  SEED: 3
};

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

  const [ tab, setTab ] = React.useState(TABS.PERSON);
  const [ selectedNeighbour, setSelectedNeighbour ] = React.useState(0);

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

    stage.removeChildren();

    let displayObject;
    if (state.ui.playerId) {
      const spiral = Grid.spiral({ center: { x: 0, y: 0 }, radius: 1 });
      const map = new PIXI.Container();
      map.interactive = true;
      for (let spiral_index = 0; spiral_index < spiral.length; spiral_index++) {
        const hex = spiral[spiral_index];

        const neighbour = new PIXI.Graphics();
        neighbour.position = Hex(hex).toPoint();
        neighbour.beginFill(render.COLOURS.grassland);
        neighbour.lineStyle({color: "black", width: 2, alpha: 0.04});
        neighbour.drawPolygon(...Hex().corners());
        neighbour.endFill();
        if (spiral_index > 0) {
          const town = new PIXI.Graphics();

          town.beginFill(render.COLOURS.stone, 0.5);
          town.drawCircle(0, 0, 16);

          town.beginFill(0x993333, 0.5);
          town.drawRoundedRect(-30, 20, 60, 15, 5);
          town.endFill();
          let text = new PIXI.Text("Town", {fontFamily: "Alegreya", fontSize: 10, fill: "white"});
          text.position.set(0, 27.5);
          text.anchor = { x: 0.5, y: 0.5 };
          town.addChild(text);

          if (tab == TABS.NEIGHBOUR && selectedNeighbour + 1 == spiral_index) {
            town.addChild(render.selection(75, 0xff0000));
          }

          neighbour.addChild(town);
        }
        neighbour.interactive = true;
        neighbour.on("click", () => { setTab(TABS.NEIGHBOUR); setSelectedNeighbour(spiral_index - 1); });
        neighbour.on("tap", () => { setTab(TABS.NEIGHBOUR); setSelectedNeighbour(spiral_index - 1); });
        map.addChild(neighbour);
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

      if (nameField.current) {
        nameField.current.value = firstName(n);
      }

      if (familyNameField.current) {
        familyNameField.current.value = familyName(n);
      }
    }

    return function cleanup() {
      if (displayObject) {
        stage.removeChild(displayObject);
      }
    };
  }, [stage, state, t, state.ecs.nameable,
    state.ui.playerId, gender, tab, selectedNeighbour]);

  return (
    <div>
      <h1 className="handle">Start new game</h1>
      { state.map && <>
        <div icon="person">
          <div className="row overlay">
            <button onClick={() => setTab(TABS.PERSON)} className={`${tab == TABS.PERSON ? "" : "unselected"}`}><FontAwesomeIcon icon="user"/></button>
            <button onClick={() => setTab(TABS.HOUSE)} className={`${tab == TABS.HOUSE ? "" : "unselected"}`}><FontAwesomeIcon icon="shield-alt"/></button>
            <button onClick={() => setTab(TABS.NEIGHBOUR)} className={`${tab == TABS.NEIGHBOUR ? "" : "unselected"}`}><FontAwesomeIcon icon="mountain"/></button>
            <button onClick={() => setTab(TABS.SEED)} className={`${tab == TABS.SEED ? "" : "unselected"}`}><FontAwesomeIcon icon="random"/></button>
          </div>
          <div className="character" ref={characterView}></div>
        </div>
        { tab == TABS.PERSON && <>
          <div className="row" style={{clear: "both"}}>
            <label htmlFor="name">First name:</label>
            <input type="text" ref={nameField}/>
            <button onClick={randomiseNameSeed}><FontAwesomeIcon icon="dice"/></button>
          </div>
          <div className="row">
            <label>Gender:</label>
            <button onClick={() => { setGender(0); update(); }} disabled={gender == 0}>Male</button>
            <button onClick={() => { setGender(1); update(); }} disabled={gender == 1}>Female</button>
          </div>
        </>}
        { tab == TABS.HOUSE &&
          <div className="row">
            <label htmlFor="name">House:</label>
            <input type="text" ref={familyNameField}/>
            <button onClick={randomiseFamilyNameSeed}><FontAwesomeIcon icon="dice"/></button>
          </div> }
        { tab == TABS.SEED && <>
          <div className="row">
            <label htmlFor="seed">Map seed:</label>
            <input id="seed" type="text" ref={seedField} onChange={() => state.map.seed = seedField.current.value}/>
            <button onClick={randomiseSeed}><FontAwesomeIcon icon="dice"/></button>
          </div>
          <div className="row">
            <button onClick={reset}>Reset to seed</button>
            { progress.label && <div className="progress">{progress.label}</div> }
          </div>
        </>}
      </> }
    </div>
  );
}
