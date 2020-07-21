import React from "react";
import { useSelector } from "react-redux";

import { World } from "components/world";
import { MapGenParams } from "components/mapgen";

export function Game() {
  const map = useSelector(state => state.map.landscape);
  const width = useSelector(state => state.map.pointWidth);
  const height = useSelector(state => state.map.pointHeight);

  return (
    <div id='game'>
      <World map={map} width={width} height={height}/>
      <MapGenParams/>
      <h1 className='header'>Tiny King</h1>
      <div className='disclaimer'>Technical Demo {VERSION}<br/>All features in very early stages and subject to change.<br/>Copyright (c) 2020 Think Code Learn Ltd t/a Revelation Games</div>
      <div className='social'>
        <a href='https://github.com/chrismdp/tinyking/' target='_blank' rel='noreferrer'><img src='https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1'/></a>
        <a href='https://discord.gg/ZgXcVyn' target='_blank' rel='noreferrer'><img src='https://img.shields.io/discord/731912590489288795?color=417154&label=discord'/></a>
      </div>
    </div>
  );
}
