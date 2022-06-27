import { Hex } from "./hex.js";

import * as Buildings from "../../models/Buildings.js"

import buildings from "../../data/buildings.json"

export default function Building({x, y, type, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = Buildings[buildings[type].component];
  if (Component) {
    return (
      <Component position={[point.x, 0, point.y]} {...props}/>
    )
  }
}
