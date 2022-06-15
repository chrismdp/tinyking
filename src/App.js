import { Suspense } from 'react';

import { Counter } from './features/counter/Counter';
import './App.css';

import * as Honeycomb from 'honeycomb-grid';

import { Canvas } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";

import Model from "./models/Grass_forest.js";

const Hex = Honeycomb.extendHex({
  size: 1,
  orientation: 'pointy'
});

function App() {
  return (
    <>
    <Canvas shadows camera={{ position: [0, 4, 3]}}>
      <directionalLight castShadow color={0xf3fbd9} intensity={0.8} position={[0, 4, 3]}
      />
      <directionalLight color={0xf3fbd9} intensity={0.2} position={[0, 2, 3]} />
      <directionalLight color={0xf3fbd9} intensity={0.2} position={[0, 2, -3]} />
      <directionalLight color={0xf3fbd9} intensity={0.2} position={[-3, 2, -3]} />
      <directionalLight color={0xf3fbd9} intensity={0.2} position={[3, 2, -3]} />
      <MapControls/>
      <Suspense fallback={null}>
        <Model/>
        <Model position={[1, 0, 0]}/>
      </Suspense>
      <EffectComposer>
        <SMAA/>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.8} height={300}/>
        <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
      </EffectComposer>
    
    </Canvas>
    <div className="App">
      Temp UI
      <header className="App-header">
        <Counter />
      </header>
    </div>
  </>
  );
}

export default App;
