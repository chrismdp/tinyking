import React from "react"
import TERRAINS from "../../data/terrains.json"

import { animated, useSpring } from '@react-spring/web';

export default function TileSelectionPanel({ terrain, callback, selected }) {
  const info = TERRAINS[terrain];

  const imageStyles = useSpring({ to: { transform: `scale(${selected ? 1.5 : 1.25 })` } });

  return (<>
    { info &&
      <div className="flex flex-col" onClick={() => callback(terrain)}>
        <animated.img style={imageStyles} className="pointer-events-none object-bottom object-cover h-20 w-28" src={`/images/${info.image}.png`} alt={terrain}/>
        <animated.div className="text-center h-8 text-xs">{info.name}</animated.div>
      </div>
    }
  </>)
}
