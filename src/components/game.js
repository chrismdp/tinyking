import React from "react";
import { useSelector, useDispatch } from "react-redux";

import { World } from "components/world";
import { MapGenParams } from "components/mapgen";

import { generate } from "features/map_slice";

export function Game() {
  const map = useSelector(state => state.landscape);
  const seed = useSelector(state => state.seed);
  const width = useSelector(state => state.pointWidth);
  const height = useSelector( state => state.pointHeight);

  const dispatch = useDispatch();
  const changeSeed = React.useCallback((seed) => dispatch(generate({ seed })), [dispatch]);

  return (
    <div id='game'>
      <World map={map} width={width} height={height}/>
      <MapGenParams seed={seed} onChange={changeSeed}/>
      <h1 className='header'>Tiny King</h1>
      <div className='disclaimer'>Technical Demo {VERSION}<br/>All features in very early stages and subject to change.<br/>Copyright (c) 2020 Think Code Learn Ltd t/a Revelation Games</div>
      <div className='social'>
        <a href='https://github.com/chrismdp/tinyking/' target='_blank' rel='noreferrer'><img src='https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1'/></a>
        <a href='https://discord.gg/ZgXcVyn' target='_blank' rel='noreferrer'><img src='https://img.shields.io/discord/731912590489288795?color=417154&label=discord'/></a>
      </div>
    </div>);
}
