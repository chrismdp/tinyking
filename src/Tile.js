import { Hex } from "./hex.js";

import ForestTile from "./ForestTile.js"
import CoastTile from "./CoastTile.js"
import GrassTile from "./GrassTile.js"
import SelectTile from "./SelectTile.js"

// TODO: Really necessary to have this layer of indirection here?
const COMPONENTS = {
  "forest": ForestTile,
  "coast": CoastTile,
  "grass": GrassTile,
  "select": SelectTile
}

export default function Tile({x, y, type, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = COMPONENTS[type];
  if (Component) {
    return (
      <Component x={point.x} y={point.y} {...props}/>
    )
  }
}
