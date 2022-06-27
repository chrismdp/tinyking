import { useSelector, useDispatch } from 'react-redux';
import { Suspense, useEffect, useState, useRef } from 'react';

import { animated, useSpring } from '@react-spring/three';

import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, MapControls } from "@react-three/drei";
import { SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";

import { removeZeroValues, selectable, areaEffects, availableTerrains } from './mapSlice';
import { limits } from "./limits";
import { explore, hide } from '../ui/uiSlice';

import Tile from "./Tile.js"
import Building from "./Building.js"
import Grading from "../../Grading.js"

import TILES from "../../data/tiles.json"
import TERRAINS from "../../data/terrains.json"

function isSelected(tile, selectedTile) {
  return tile.x === selectedTile.x && tile.y === selectedTile.y;
}

const AnimatedMapControls = animated(MapControls);
const AnimatedPerspectiveCamera = animated(PerspectiveCamera);

export default function Map({ lut }) {
  const tiles = useSelector(state => state.map.tiles);
  const buildings = useSelector(state => state.map.buildings);
  const selectedTile = useSelector(state => state.ui.explore.hex);

  const [ selectableTiles, setSelectableTiles ] = useState([]);
  useEffect(() => {
    (async () => {
      const sel = selectable(tiles);
      for (let idx = 0; idx < sel.length; idx++) {
        const hex = sel[idx];
        hex.effects = areaEffects(tiles, hex);
        hex.limits = limits(TERRAINS, TILES, tiles, hex);
        const payload = { ...hex.effects, limits: hex.limits };
        hex.availableTerrains = await availableTerrains(payload);
        hex.label = removeZeroValues(hex.effects);
      }
      setSelectableTiles(sel);
    })().catch(console.error);
  }, [tiles]);

  const dispatch = useDispatch();

  const camera = useRef();
  const controls = useRef();
  const { target, position } = useSpring({
    from: {
      position: camera.current && camera.current.position.toArray(),
      target: controls.current && controls.current.target.toArray()
    },
    to: {
      position: [0, 4.5, - 5.5],
      target: [0, 0, 0]
    }
  });

  return (
    <Canvas className="absolute top-0 bottom-0" shadows>
      <Suspense>
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
        <AnimatedMapControls ref={controls} target={target} maxPolarAngle={0.45 * Math.PI}/>
        {
          Object.keys(tiles).map(key => ( <Tile key={key} component={TILES[tiles[key].type].component} {...tiles[key]}/> ))
        }
        {
          selectableTiles.map(tile => (
            <Tile
              {...tile}
              highlighted={isSelected(tile, selectedTile)}
              component="SelectTile"
              label={Object.keys(tile.label).length > 0 && JSON.stringify(tile.label)}
              onClick={() => dispatch(isSelected(tile, selectedTile) ? hide() : explore({ ...tile}))}
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
      </Suspense>
    </Canvas>
  );
}
