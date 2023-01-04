import React from "react";
import TERRAINS from "../../data/terrains.json"

export default function TerrainPanelImage({ terrain }) {
  const image = terrain && TERRAINS[terrain].image;
  if (image) {
    return <img className="absolute pointer-events-none object-bottom object-cover -right-12 hidden sm:block -top-56 w-80" src={`/images/${image}.png`} alt={terrain}/>;
  }
}
