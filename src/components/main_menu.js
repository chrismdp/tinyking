import React from "react";
import PropTypes from "prop-types";

import { GameState } from "components/contexts";

export function MainMenu({ show }) {
  const state = React.useContext(GameState);
  const year = new Date().getFullYear();

  return (
    <div id="main-menu" className={show ? "" : "hiding"}>
      <div className="header">
        <div className="small">Welcome to</div>
        <div className="main">Tiny King</div>
        <div className="strapline">The kingdom builder that&rsquo;s all about the people.<br/>Placeholder art, alpha gameplay, open development.</div>
      </div>
      <menu className={show ? "" : "hiding"}>
        {state.persistence?.hasSave && <li><button disabled={!!state.generating} onClick={state.ui.actions.continue_game}>Continue</button></li>}
        <li>{(state.renderer || state.persistence?.ready && (state.persistence.hasSave || state.persistence.error)) && <a onClick={state.ui.actions.custom_game}>Start new game</a>}</li>
        {state.persistence?.error && <li className="save-message" role="alert">{state.persistence.error}</li>}
        <div className="social">
          <a href="https://discord.gg/ZgXcVyn" target="_blank" rel="noreferrer"><img src="https://img.shields.io/discord/731912590489288795?color=417154&label=discord"/></a>
          <a href="https://github.com/chrismdp/tinyking/" target="_blank" rel="noreferrer"><img src="https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1"/></a>
        </div>
        <div className="disclaimer">
          Technical Demo {VERSION}
          <br/>
          Copyright &copy; {year} Think Code Learn Ltd t/a Revelation Games</div>
      </menu>
    </div>);
}

MainMenu.propTypes = {
  show: PropTypes.bool.isRequired
};
