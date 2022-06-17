import { Hex } from "./hex.js";

import Unit_house from "./models/Unit_house.js"

// TODO: Really necessary to have this layer of indirection here?
const COMPONENTS = {
  "house": Unit_house,
}

export default function Building({x, y, type, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = COMPONENTS[type];
  if (Component) {
    return (
      <Component position={[point.x, 0.2,  point.y]} {...props}/>
    )
  }
}
