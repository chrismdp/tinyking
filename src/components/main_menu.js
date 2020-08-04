import React from "react";

import { useSelector, useDispatch } from "react-redux";

import { startGame, customGame } from "features/ui_slice";

export function MainMenu() {
  const showMainMenu = useSelector(state => state.ui.showMainMenu);

  const dispatch = useDispatch();
  const start = React.useCallback(() => dispatch(startGame()), [dispatch]);
  const custom = React.useCallback(() => dispatch(customGame()), [dispatch]);

  return (
    <div id="overlay" className={showMainMenu ? "" : "hiding"}>
      <div className="header">
        <div className="small">Welcome to</div>
        <div className="main">Tiny King</div>
        <div className="strapline">The kingdom builder that&rsquo;s all about the people.<br/>Placeholder art, alpha gameplay, open development.</div>
      </div>
      <menu>
        <li><a onClick={start}>Quick start</a></li>
        <li><a onClick={custom}>Create a custom map</a></li>
        <div className="social">
          <a href="https://discord.gg/ZgXcVyn" target="_blank" rel="noreferrer"><img src="https://img.shields.io/discord/731912590489288795?color=417154&label=discord"/></a>
          <a href="https://github.com/chrismdp/tinyking/" target="_blank" rel="noreferrer"><img src="https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1"/></a>
        </div>
        <div className="disclaimer">Technical Demo {VERSION}<br/>Copyright &copy; 2020 Think Code Learn Ltd t/a Revelation Games</div>
      </menu>
    </div>);
}
