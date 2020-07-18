import React from "react";

import * as Honeycomb from "honeycomb-grid";

import { World } from "components/world";
import { MapGenParams } from "components/mapgen";

import * as mapgen from "mapgen";

export function Game() {
  const [map, setMap] = React.useState([]);
  const [seed, setSeed] = React.useState("");

  const hexSize = 50;
  const mapRadius = 50;

  const Hex = Honeycomb.extendHex({
    size: hexSize,
    orientation: "flat"
  });
  const Grid = Honeycomb.defineGrid(Hex);

  const regenerate = (seed) => {
    console.log("regenerate", seed);
    setSeed(seed);
    let m = Grid.rectangle({width: mapRadius * 2, height: mapRadius * 2});
    mapgen.generate(m, seed);
    setMap(m);
  };

  React.useLayoutEffect(() => {
    regenerate("12345");
  }, []);

  return (
    <div id='game'>
      <World map={map}/>
      <MapGenParams seed={seed} onChange={regenerate}/>
      <h1 className='header'>Tiny King</h1>
      <div className='disclaimer'>Technical Demo.<br/>All features in very early stages and subject to change.<br/>Copyright (c) 2020 Think Code Learn Ltd t/a Revelation Games</div>
    </div>);
}
