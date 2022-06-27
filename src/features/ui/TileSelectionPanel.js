import TERRAINS from "../../data/terrains.json"

import { animated, useSpring, config } from '@react-spring/web';

export default function TileSelectionPanel({ terrain, lut, callback, selected }) {
  const info = TERRAINS[terrain];

  const imageStyles = useSpring({
    reset: true,
    from: { transform: "scale(1.25)" },
    to: { transform: `scale(${selected ? 1.5 : 1.25 })` },
  });

  const labelStyles = useSpring({
    reset: true,
    from: { opacity: 0 },
    to: { opacity: selected ? 1 : 0 }
  });

  if (!info) {
    return;
  }

  return (
    <div className="flex flex-col" onClick={() => callback(terrain)}>
      <animated.img style={imageStyles} className="object-bottom object-cover h-20 w-28" src={`/images/${info.image}.png`} alt={terrain}/>
      <animated.div style={labelStyles} className="text-center h-8 text-xs">Choose this?</animated.div>
    </div>
  )
}
