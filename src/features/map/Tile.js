import { Suspense, useRef, useCallback } from 'react';
import { useFrame } from "@react-three/fiber";

import { Hex } from "./hex.js";

import * as Tiles from "../../models/Tiles.js"
import tiles from "../../data/tiles.json"

export default function Tile({x, y, type, rotating, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = Tiles[tiles[type].component];

  const ref = useRef();
  const rotate = useCallback(delta => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  }, []);
  useFrame((state, delta) => rotating && rotate(delta));

  if (Component) {
    return (
      <Suspense>
        <Component ref={ref} position={[point.x, 0,  point.y]} {...props}/>
      </Suspense>
    )
  }
}
