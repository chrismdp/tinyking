import * as Honeycomb from 'honeycomb-grid';

import ForestTile from "./ForestTile.js"
import CoastTile from "./CoastTile.js"
import GrassTile from "./GrassTile.js"

// TODO: Really necessary to have this layer of indirection here?
const COMPONENTS = {
  "forest": ForestTile,
  "coast": CoastTile,
  "grass": GrassTile
}

const Hex = Honeycomb.extendHex({
  size: 0.57725,
  orientation: 'pointy'
});

export default function Tile({x, y, type}) {
  const point = Hex(x, y).toPoint();
  const Component = COMPONENTS[type];
  if (Component) {
    return (
      <Component x={point.x} y={point.y}/>
    )
  }
}
