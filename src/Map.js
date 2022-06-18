import { Suspense } from 'react';
import { useSelector } from 'react-redux';

import { Canvas } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";

import { selectable } from './features/map/mapSlice';

import Tile from "./Tile.js"
import Building from "./Building.js"
import Grading from "./Grading.js"

export default function Map({ lut, setTileChoices }) {
  const tiles = useSelector(state => state.map.tiles);
  const buildings = useSelector(state => state.map.buildings);
  const selectableTiles = useSelector(selectable);

  return (
    <Canvas className="absolute top-0 bottom-0" shadows camera={{ position: [0, 2.5, -3.5] }}>
      <color attach="background" args={[0x222244]}/>
      <directionalLight castShadow intensity={0.8} position={[1, 2.5, 3]} />
      <directionalLight intensity={0.2} position={[0, 2, 3]} />
      <directionalLight intensity={0.2} position={[0, 2, -3]} />
      <directionalLight intensity={0.2} position={[-3, 2, -3]} />
      <directionalLight intensity={0.2} position={[3, 2, -3]} />
      <MapControls/>
      <Suspense fallback={null}>
        {
          Object.keys(tiles).map(key => ( <Tile key={key} {...tiles[key]}/> ))
        }
        {
          Object.keys(selectableTiles).map(key => (
            <Tile key={"ts" + key} {...selectableTiles[key]} type="select" onClick={() => setTileChoices(["grass"])}/>
          ))
        }
        {
          Object.keys(buildings).map(key => ( <Building key={key} {...buildings[key]}/> ))
        }
      </Suspense>
      <EffectComposer>
        <SMAA/>
        { lut && (<Grading lut={lut}/>)}
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.8} height={300}/>
        <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
      </EffectComposer>
    </Canvas>
  );
}
