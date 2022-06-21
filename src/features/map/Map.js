import { useSelector, useDispatch } from 'react-redux';
import { useRef } from 'react';

import { animated, useSpring } from '@react-spring/three';

import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, MapControls } from "@react-three/drei";
import { SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";

import { Hex } from "./hex.js";

import { selectable } from './mapSlice';
import { explore } from '../ui/uiSlice';

import Tile from "./Tile.js"
import Building from "./Building.js"
import Grading from "../../Grading.js"

function selected(tile, selectedTile) {
  return tile.x === selectedTile.x && tile.y === selectedTile.y;
}

const AnimatedMapControls = animated(MapControls);
const AnimatedPerspectiveCamera = animated(PerspectiveCamera);

export default function Map({ lut }) {
  const tiles = useSelector(state => state.map.tiles);
  const buildings = useSelector(state => state.map.buildings);
  const selectableTiles = useSelector(selectable);
  const selectedTile = useSelector(state => state.ui.explore.hex);

  const dispatch = useDispatch();

  const point = Hex(selectedTile.x ?? 0, selectedTile.y ?? 0).toPoint();

  const camera = useRef();
  const controls = useRef();
  const { target, position } = useSpring({
    reset: true,
    from: {
      position: camera.current && camera.current.position.toArray(),
      target: controls.current && controls.current.target.toArray()
    },
    to: {
      position: [point.x, 4.5, point.y - 5.5],
      target: [point.x, 0, point.y]
    }
  });

  return (
    <Canvas className="absolute top-0 bottom-0" shadows>
      <AnimatedPerspectiveCamera
        makeDefault
        ref={camera}
        position={position}
      />
      <color attach="background" args={[0x222244]}/>
      <directionalLight castShadow intensity={0.8} position={[1, 2.5, 3]} />
      <directionalLight intensity={0.2} position={[0, 2, 3]} />
      <directionalLight intensity={0.2} position={[0, 2, -3]} />
      <directionalLight intensity={0.2} position={[-3, 2, -3]} />
      <directionalLight intensity={0.2} position={[3, 2, -3]} />
      <AnimatedMapControls ref={controls} target={target}/>
      {
        Object.keys(tiles).map(key => ( <Tile key={key} {...tiles[key]}/> ))
      }
      {
        Object.keys(selectableTiles).map(key => (
          <Tile
            key={"ts" + key}
            {...selectableTiles[key]}
            highlighted={selected(selectableTiles[key], selectedTile)}
            type="select"
            onClick={() => dispatch(explore({ ...selectableTiles[key] }))}
          />
        ))
      }
      {
        Object.keys(buildings).map(key => ( <Building key={key} {...buildings[key]}/> ))
      }
      <EffectComposer>
        <SMAA/>
        { lut && (<Grading lut={lut}/>)}
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.8} height={300}/>
        <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
      </EffectComposer>
    </Canvas>
  );
}
