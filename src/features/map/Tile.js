import { useRef, useCallback } from 'react';
import { useFrame } from "@react-three/fiber";
import { Html } from '@react-three/drei';

import { Hex } from "./hex.js";

import * as Tiles from "../../models/Tiles.js"
import tiles from "../../data/tiles.json"

export default function Tile({x, y, type, rotating, label, ...props}) {
  const point = Hex(x, y).toPoint();
  const Component = Tiles[tiles[type].component];

  const ref = useRef();
  const rotate = useCallback(delta => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  }, []);
  useFrame((state, delta) => rotating && rotate(delta));

  if (Component) {
    return (<Component ref={ref} position={[point.x, 0,  point.y]} {...props}>
      { label &&
        <Html position={[0, 0.4, 0]}>
          <div className='bg-neutral-800 opacity-70 whitespace-nowrap select-none rounded px-3 py-1'>{label}</div>
        </Html> }
    </Component>)
  }
}
