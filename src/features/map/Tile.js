import { Hex } from "./hex.js";

import { useRef, useCallback } from 'react';
import { useFrame } from "@react-three/fiber";

import { SelectTile } from "./SelectTile.js"
import { Water } from "../../models/Water.js"
import { Grass } from "../../models/Grass.js"
import { GrassForest } from "../../models/Grass_forest.js"

const COMPONENTS = {
  "forest": GrassForest,
  "coast": Water,
  "grass": Grass,
  "select": SelectTile,
}

export default function Tile({x, y, type, rotating, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = COMPONENTS[type];

  const ref = useRef();
  const rotate = useCallback(delta => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  }, []);
  useFrame((state, delta) => rotating && rotate(delta));

  if (Component) {
    return (
      <Component ref={ref} position={[point.x, 0,  point.y]} {...props}/>
    )
  }
}
