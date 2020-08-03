import React from "react";
import { useSelector } from "react-redux";

import { World } from "components/world";
import { UserInterface } from "components/user_interface";
import { getPlayerId } from "features/entities_slice";

export function Game() {
  const playerId = useSelector(getPlayerId);
  return (
    <div id="game">
      <World playerId={playerId}/>
      <UserInterface/>
      <div id="overlay">
        <div className="header">
          <div className="small">Welcome to</div>
          <div className="main">Tiny King</div>
          <div className="strapline">The kingdom builder that&rsquo;s all about the people.<br/>Placeholder art, Alpha gameplay, open development.</div>
        </div>
        <menu>
          <a>Continue this game</a><br/>
          <a>Create a custom map</a><br/>
          <div className="social">
            <a href="https://discord.gg/ZgXcVyn" target="_blank" rel="noreferrer"><img src="https://img.shields.io/discord/731912590489288795?color=417154&label=discord"/></a>
            <a href="https://github.com/chrismdp/tinyking/" target="_blank" rel="noreferrer"><img src="https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1"/></a>
          </div>
          <div className="disclaimer">Technical Demo {VERSION}<br/>Copyright &copy; 2020 Think Code Learn Ltd t/a Revelation Games</div>
        </menu>
      </div>
      <div className="social">
      </div>
    </div>
  );
}
