/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function Model({ ...props }) {
  const group = useRef()
  const { nodes, materials } = useGLTF('/models/grass.glb')
  return (
    <group ref={group} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_grass.geometry} material={materials.dirt} />
      <mesh receiveShadow geometry={nodes.Mesh_grass_1.geometry} material={materials.grass}>
      </mesh>
    </group>
  )
}

useGLTF.preload('/models/grass.glb')