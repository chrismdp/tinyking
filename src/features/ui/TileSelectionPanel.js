import { Canvas } from "@react-three/fiber";
import { Suspense } from 'react';

import Grading from "../../Grading.js"

import Tile from "../map/Tile.js"
import { SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";

import TERRAINS from "../../data/terrains.json"

export default function TileSelectionPanel({ terrain, lut, callback, selected }) {
  return (
    <div className="relative" onClick={() => callback(terrain)}>
      <div className="w-28 h-28">
        <Canvas shadows camera={{ fov: 25, position: [2, 2, 2] }}>
          <Suspense>
            <directionalLight castShadow intensity={0.8} position={[1, 2.5, 3]} />
            <directionalLight intensity={0.2} position={[0, 2, 3]} />
            <directionalLight intensity={0.2} position={[0, 2, -3]} />
            <directionalLight intensity={0.2} position={[-3, 2, -3]} />
            <directionalLight intensity={0.2} position={[3, 2, -3]} />
            { terrain && <Tile x={0} y={0} component={TERRAINS[terrain].component} rotating={selected}/> }
            <EffectComposer>
              <SMAA/>
              { lut && (<Grading lut={lut}/>)}
              <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.8} height={300}/>
              <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>
      { selected && <div className="absolute left-0 right-0 text-center bottom-1 opacity-75 text-sm">Choose this?</div> }
    </div>
  )
}
