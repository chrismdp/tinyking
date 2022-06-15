/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function Model({ ...props }) {
  const group = useRef()
  const { nodes, materials } = useGLTF('/stone_mountain.glb')
  return (
    <group ref={group} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_stone_mountain.geometry} material={materials.dirt} />
      <mesh geometry={nodes.Mesh_stone_mountain_1.geometry} material={materials.stone} />
      <group position={[0, 0.2, 0]}>
        <mesh geometry={nodes.Mesh_rockLarge.geometry} material={materials.snow} />
        <mesh geometry={nodes.Mesh_rockLarge_1.geometry} material={materials.stone} />
      </group>
    </group>
  )
}

useGLTF.preload('/stone_mountain.glb')
