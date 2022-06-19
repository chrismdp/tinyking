import { Suspense } from 'react';
import { Canvas } from "@react-three/fiber";

import Grading from "../../Grading.js"

import Tile from "../map/Tile.js"
import { SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";

export default function TileSelectionPanel({ type, lut, callback, selected }) {
  return (
    <div className="w-32 h-32">
      <Canvas shadows camera={{ fov: 25, position: [2, 2, 2] }}>
        <directionalLight castShadow intensity={0.8} position={[1, 2.5, 3]} />
        <directionalLight intensity={0.2} position={[0, 2, 3]} />
        <directionalLight intensity={0.2} position={[0, 2, -3]} />
        <directionalLight intensity={0.2} position={[-3, 2, -3]} />
        <directionalLight intensity={0.2} position={[3, 2, -3]} />
        <Suspense fallback={null}>
          <Tile x={0} y={0} type={type} rotating={selected} onClick={() => callback(type)}/>
        </Suspense>
        <EffectComposer>
          <SMAA/>
          { lut && (<Grading lut={lut}/>)}
          <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.8} height={300}/>
          <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
