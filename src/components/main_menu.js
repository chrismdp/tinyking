import React from "react";
import PropTypes from "prop-types";

import { GameState } from "components/contexts";
import { loadWeekChoices } from "game/world_menu";

export function MainMenu({ show }) {
  const state = React.useContext(GameState);
  const year = new Date().getFullYear();
  const [weeks, setWeeks] = React.useState([]);
  const [earlierOpen, setEarlierOpen] = React.useState(false);
  const [loadingWeeks, setLoadingWeeks] = React.useState(false);
  const [weekError, setWeekError] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    setEarlierOpen(false);
    if (show) loadWeekChoices().then(choices => { if (active) setWeeks(choices); }).catch(() => {});
    return () => { active = false; };
  }, [show]);

  const openEarlierWeeks = async () => {
    if (earlierOpen) { setEarlierOpen(false); return; }
    setEarlierOpen(true);
    setLoadingWeeks(true);
    setWeekError(null);
    try { setWeeks(await loadWeekChoices()); }
    catch { setWeekError("Could not load earlier weeks. Please try again."); }
    finally { setLoadingWeeks(false); }
  };

  return (
    <div id="main-menu" className={show ? "" : "hiding"}>
      <div className="header">
        <div className="small">Welcome to</div>
        <div className="main">Tiny King</div>
        <div className="strapline">Arrive in a valley, find your mother&rsquo;s family and meet the people you come to care about.</div>
      </div>
      <menu className={show ? "" : "hiding"}>
        {state.persistence?.hasSave && <li><button disabled={!!state.generating} onClick={state.ui.actions.continue_game}>Continue</button></li>}
        <li>{(state.renderer || state.persistence?.ready) && <a onClick={() => state.ui.actions.custom_game()}>Start new game</a>}</li>
        {!!weeks.length && <li className="earlier-weeks">
          <button className="week-toggle" disabled={!!state.generating} aria-expanded={earlierOpen} onClick={openEarlierWeeks}>Play an earlier week</button>
          {earlierOpen && <div className="week-picker">
            {loadingWeeks ? <p role="status">Loading earlier weeks…</p> : weekError ? <p role="alert">{weekError}</p> :
              <ul>{weeks.map(week => <li key={week.id}><button disabled={!!state.generating || !state.persistence?.ready} onClick={() => state.ui.actions.custom_game(week.id)}>{week.label}</button></li>)}</ul>}
          </div>}
        </li>}
        {state.persistence?.error && <li className="save-message" role="alert">{state.persistence.error}</li>}
        <div className="social">
          <a href="https://discord.gg/ZgXcVyn" target="_blank" rel="noreferrer"><img src="https://img.shields.io/discord/731912590489288795?color=417154&label=discord"/></a>
          <a href="https://github.com/chrismdp/tinyking/" target="_blank" rel="noreferrer"><img src="https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1"/></a>
        </div>
        <div className="disclaimer">
          Technical Demo {VERSION}
          <br/>
          &copy; {year} chrismdp ltd. A <a href="https://www.chrismdp.com" target="_blank" rel="noreferrer">Chris Parsons</a> project.</div>
      </menu>
    </div>);
}

MainMenu.propTypes = {
  show: PropTypes.bool.isRequired
};
