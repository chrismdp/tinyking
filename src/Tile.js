import { Hex } from "./hex.js";

import SelectTile from "./SelectTile.js"
import Water from "./models/Water.js"
import Grass from "./models/Grass.js"
import Grass_forest from "./models/Grass_forest.js"
import Building_cabin from "./models/Building_cabin.js"
import Unit_house from "./models/Unit_house.js"
// import Building_house from "./models/Building_house.js"

// TODO: Really necessary to have this layer of indirection here?
const COMPONENTS = {
  "forest": Grass_forest,
  "coast": Water,
  "grass": Grass,
  "select": SelectTile,
  "cabin": Building_cabin,
  "house": Unit_house,
}

export default function Tile({x, y, type, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = COMPONENTS[type];
  if (Component) {
    return (
      <Component position={[point.x, 0,  point.y]} {...props}/>
    )
  }
}
