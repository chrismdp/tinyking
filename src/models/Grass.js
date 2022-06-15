/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function Model({ ...props }) {
  const group = useRef()
  const { nodes, materials } = useGLTF('/grass.glb')
  return (
    <group ref={group} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_grass.geometry} material={materials.dirt} />
      <mesh geometry={nodes.Mesh_grass_1.geometry} material={materials.grass} />
    </group>
  )
}

useGLTF.preload('/grass.glb')
