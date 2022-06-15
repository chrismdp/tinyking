/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function Model({ ...props }) {
  const group = useRef()
  const { nodes, materials } = useGLTF('/path_intersectionA.glb')
  return (
    <group ref={group} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_path_intersectionA.geometry} material={materials.wood} />
      <mesh geometry={nodes.Mesh_path_intersectionA_1.geometry} material={materials.dirt} />
    </group>
  )
}

useGLTF.preload('/path_intersectionA.glb')
