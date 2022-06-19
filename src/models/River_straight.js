/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function Model({ ...props }) {
  const group = useRef()
  const { nodes, materials } = useGLTF('/river_straight.glb')
  return (
    <group ref={group} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_river_straight.geometry} material={materials.dirt} />
      <mesh geometry={nodes.Mesh_river_straight_1.geometry} material={materials.grass} />
      <mesh geometry={nodes.Mesh_river_straight_2.geometry} material={materials.wood} />
      <mesh geometry={nodes.Mesh_river_straight_3.geometry} material={materials.water} />
    </group>
  )
}

useGLTF.preload('/river_straight.glb')