import { useState, Suspense } from 'react';
import { useSelector } from 'react-redux';

import { Counter } from './features/counter/Counter';
import './App.css';

import { Canvas, useLoader } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { LUT, SMAA, EffectComposer, DepthOfField, Bloom } from "@react-three/postprocessing";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader";

import Tile from "./Tile.js"

const LUTS = [
  "Arabica 12",
  "Ava 614",
  "Azrael 93",
  "Bourbon 64",
  "Byers 11",
  "Chemical 168",
  "Clayton 33",
  "Clouseau 54",
  "Cobi 3",
  "Contrail 35",
  "Cubicle 99",
  "Django 25",
  "Domingo 145",
  "Faded 47",
  "Folger 50",
  "Fusion 88",
  "Hyla 68",
  "Korben 214",
  "Lenox 340",
  "Lucky 64",
  "McKinnon 75",
  "Milo 5",
  "Neon 770",
  "Paladin 1875",
  "Pasadena 21",
  "Pitaya 15",
  "Reeve 38",
  "Remy 24",
  "Sprocket 231",
  "Teigen 28",
  "Trent 18",
  "Tweed 71",
  "Vireo 37",
  "Zed 32",
  "Zeke 39",
]

function Grading({ lut }) {
  const texture3D = useLoader(LUTCubeLoader, `/luts/${lut}.CUBE`); // Bright / sharp
  return (<LUT lut={texture3D.texture}/>);
}

function App() {
  const tiles = useSelector(state => state.map.tiles);

  const [ lut , setLut ] = useState("Bourbon 64");
  return (
    <>
      <Canvas shadows camera={{ position: [0, 2.5, -3.5] }}>
      <color attach="background" args={[0x222244]}/>
      <directionalLight castShadow intensity={0.8} position={[0, 2, 3]} />
      <directionalLight intensity={0.2} position={[0, 2, 3]} />
      <directionalLight intensity={0.2} position={[0, 2, -3]} />
      <directionalLight intensity={0.2} position={[-3, 2, -3]} />
      <directionalLight intensity={0.2} position={[3, 2, -3]} />
      <MapControls/>
      <Suspense fallback={null}>
        {
          Object.keys(tiles).map((key) => ( <Tile key={key} {...tiles[key]}/> ))
        }
      </Suspense>
      <EffectComposer>
        <SMAA/>
        { lut && (<Grading lut={lut}/>)}
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.8} height={300}/>
        <DepthOfField focusDistance={0} focalLength={0.1} bokehScale={2} height={480} />
      </EffectComposer>
    
    </Canvas>
    <div className="App">
      Temp UI
      <header className="App-header">
        <Counter />
      </header>
      <select onChange={e => setLut(e.target.value)} value={lut}>
        <option/>
        { LUTS.map(option => (<option key={option}>{option}</option>)) }
    </select>
    </div>
  </>
  );
}

export default App;
