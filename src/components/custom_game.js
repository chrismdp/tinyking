import React from "react";

import { createPreview } from "render/preview";

import { useTranslate } from "react-polyglot";

import { BODY_MALE, BODY_FEMALE, HAIR } from "game/map";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameState } from "components/contexts";
import { firstName, familyName } from "game/name";
import { CharacterSelection } from "components/character_selection";
import { WeatherMap } from "components/overworld";
import { homeOf } from "game/overworld";

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
  const currentSeed=state.travel?.seed ?? state.map?.seed;
  const seedDraft=React.useRef(currentSeed);
  React.useEffect(()=>{seedDraft.current=currentSeed;if(seedField.current)seedField.current.value=currentSeed;},[currentSeed]);
  const randomiseSeed = React.useCallback(() => {
    seedDraft.current = newSeed();
    seedField.current.value = seedDraft.current;
  }, []);

  const nameField = React.useRef();
  const randomiseNameSeed = React.useCallback(() => {
    delete state.ecs.nameable[state.ui.playerId].firstName;
    state.ecs.nameable[state.ui.playerId].seed = newSeed();
    nameField.current.value = firstName(state.ecs.nameable[state.ui.playerId]);
  }, [state.ecs.nameable, state.ui.playerId]);

  const familyNameField = React.useRef();
  const randomiseFamilyNameSeed = React.useCallback(() => {
    delete state.ecs.nameable[state.ui.playerId].familyName;
    state.ecs.nameable[state.ui.playerId].familySeed = newSeed();
    familyNameField.current.value = familyName(state.ecs.nameable[state.ui.playerId]);
  }, [state.ecs.nameable, state.ui.playerId]);

  const [ male, setMale ] = React.useState();
  React.useEffect(() => {
    if (state.ecs.personable && state.ecs.personable[state.ui.playerId]) {
      setMale(state.ecs.personable[state.ui.playerId].male);
    }
  }, [state, state.ecs.personable]);

  React.useEffect(() => {
    if (state.generating || male === undefined || !state.ecs.personable?.[state.ui.playerId]) return;
    state.ecs.nameable[state.ui.playerId].male = male;
    state.ecs.personable[state.ui.playerId].male = male;
    state.ecs.personable[state.ui.playerId].body = male ? BODY_MALE : BODY_FEMALE;
    state.redraws.push(state.ui.playerId);
  }, [state, male, state.generating, state.ui.playerId]);

  const reset = React.useCallback(() =>
    state.ui.actions.generate_map(seedField.current.value), [state]);

  const [ preview, setPreview ] = React.useState(null);

  const [ tab, setTab ] = React.useState(TABS.PERSON);
  const [ selectedNeighbour, setSelectedNeighbour ] = React.useState(0);

  React.useEffect(() => {
    const ref = characterView.current;
    let view;
    if (ref && !state.generating) {
      view = createPreview(ref, {
        width: 300,
        height: 250,
        onPickPerson: () => setTab(TABS.PERSON),
        onPickNeighbour: index => { setTab(TABS.NEIGHBOUR); setSelectedNeighbour(index); }
      });
      setPreview(view);
    } else {
      setPreview(null);
    }

    return function cleanup() {
      if (view) {
        view.dispose();
      }
    };
  }, [state, state.map, state.generating]);

  // NOTE: Again this is a way to imperatively tell the preview for this
  // component to re-render - there's probably a better way.
  const [ needsUpdate, setNeedsUpdate ] = React.useState();
  const timeToUpdate = React.useCallback(() => setNeedsUpdate({}), [setNeedsUpdate]);

  React.useEffect(() => {
    if (!preview || state.generating) {
      return;
    }

    preview.update(state, {
      playerId: state.ui.playerId,
      personSelected: tab == TABS.PERSON,
      selectedNeighbour: tab == TABS.NEIGHBOUR ? selectedNeighbour : -1
    }, t);

    if (seedField.current && state.map) {
      seedField.current.value = seedDraft.current ?? currentSeed;
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
  }, [preview, state, t, currentSeed, state.ecs.nameable,
    state.generating, state.ui.playerId, state.redraws, needsUpdate, male, tab, selectedNeighbour]);

  return (
    <div className="custom-game">
      <h1 className="handle">Start new game</h1>
      { state.generating && <p role="status">Preparing world: {progress.label || "starting"}…</p> }
      { state.map && !state.generating && <>
        <div className="game-preview" icon="person">
          <div className="row overlay">
            <button aria-label="Character" aria-pressed={tab == TABS.PERSON} onClick={() => setTab(TABS.PERSON)} className={`${tab == TABS.PERSON ? "" : "unselected"}`}><FontAwesomeIcon icon="user"/></button>
            <button aria-label="House" aria-pressed={tab == TABS.HOUSE} onClick={() => setTab(TABS.HOUSE)} className={`${tab == TABS.HOUSE ? "" : "unselected"}`}><FontAwesomeIcon icon="shield-alt"/></button>
            <button aria-label="Neighbours" aria-pressed={tab == TABS.NEIGHBOUR} onClick={() => setTab(TABS.NEIGHBOUR)} className={`${tab == TABS.NEIGHBOUR ? "" : "unselected"}`}><FontAwesomeIcon icon="mountain"/></button>
            <button aria-label="Game settings" aria-pressed={tab == TABS.SEED} onClick={() => setTab(TABS.SEED)} className={`${tab == TABS.SEED ? "" : "unselected"}`}><FontAwesomeIcon icon="random"/></button>
          </div>
          <div className="character" ref={characterView}></div>
        </div>
        <div className="game-options">
          { tab == TABS.PERSON && <>
            <h2>Customise your character</h2>
            <div className="row">
              <label>Gender:</label>
              <button onClick={() => { setMale(true); }} disabled={male == true}>Male</button>
              <button onClick={() => { setMale(false); }} disabled={male == false}>Female</button>
            </div>
            <div className="row" style={{clear: "both"}}>
              <label htmlFor="name">First name:</label>
              <input id="name" type="text" ref={nameField} onChange={event => { state.ecs.nameable[state.ui.playerId].firstName = event.target.value; }}/>
              <button aria-label="Randomise first name" onClick={randomiseNameSeed}><FontAwesomeIcon icon="dice"/></button>
            </div>
            <CharacterSelection label="Hair colour:" id={state.ui.playerId} attribute="hair" selections={HAIR} onChange={timeToUpdate}/>
          </>}
          { tab == TABS.HOUSE && <>
            <h2>Customise your house</h2>
            <div className="row">
              <label htmlFor="house">House:</label>
              <input id="house" type="text" ref={familyNameField} onChange={event => { state.ecs.nameable[state.ui.playerId].familyName = event.target.value; }}/>
              <button aria-label="Randomise house name" onClick={randomiseFamilyNameSeed}><FontAwesomeIcon icon="dice"/></button>
            </div>
          </>}
          { tab == TABS.NEIGHBOUR && <>
            <h2>Customise neighbouring tile</h2>
          </>}
          { tab == TABS.SEED && <>
            <h2>Game settings</h2>
            <div className="row">
              <label htmlFor="seed">Map seed:</label>
              <input id="seed" type="text" ref={seedField} defaultValue={currentSeed} onChange={() => seedDraft.current = seedField.current.value}/>
              <button aria-label="Randomise map seed" onClick={randomiseSeed}><FontAwesomeIcon icon="dice"/></button>
            </div>
            <div className="row">
              <button onClick={reset}>Reset to seed</button>
              { progress.label && <div className="progress">{progress.label}</div> }
            </div>
            { state.world && <>
              <WeatherMap weather={state.weather} world={state.world} size={18}/>
              <div className="world-hex">{t("world.world_hex", homeOf(state.world))}</div>
            </> }
          </>}
        </div>
      </> }
      <button className="mobile-start" disabled={!!state.generating} onClick={state.ui.actions.start_game}>Start game</button>
    </div>
  );
}
