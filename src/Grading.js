import React from "react";
import { LUT } from "@react-three/postprocessing";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader";
import { useLoader } from "@react-three/fiber";

export default function Grading({ lut }) {
  const texture3D = useLoader(LUTCubeLoader, `/luts/${lut}.CUBE`); // Bright / sharp
  return (<LUT lut={texture3D.texture}/>);
}

