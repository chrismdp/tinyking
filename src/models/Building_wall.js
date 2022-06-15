/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
*/

import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function Model({ ...props }) {
  const group = useRef()
  const { nodes, materials } = useGLTF('/building_wall.glb')
  return (
    <group ref={group} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_building_wall.geometry} material={materials.grass} />
      <mesh geometry={nodes.Mesh_building_wall_1.geometry} material={materials._defaultMat} />
      <mesh geometry={nodes.Mesh_building_wall_2.geometry} material={materials.dirt} />
      <group position={[-0.19, 0.2, -0.32]}>
        <mesh geometry={nodes.Mesh_tower.geometry} material={materials.stone} />
        <mesh geometry={nodes.Mesh_tower_1.geometry} material={materials.stoneDark} />
      </group>
      <group position={[0.19, 0.2, 0.32]}>
        <mesh geometry={nodes.Mesh_tower.geometry} material={materials.stone} />
        <mesh geometry={nodes.Mesh_tower_1.geometry} material={materials.stoneDark} />
      </group>
      <group position={[-0.36, 0.2, -0.11]} rotation={[-Math.PI, 0.96, -Math.PI]} scale={0.62}>
        <mesh geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.25, 0.2, -0.1]} rotation={[0, 1.31, 0]} scale={0.62}>
        <mesh geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.37, 0.2, 0.08]} rotation={[0, Math.PI / 6, 0]} scale={0.62}>
        <mesh geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.1, 0.2, 0.3]} rotation={[0, 0.15, 0]} scale={0.77}>
        <mesh geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.31, 0.2, 0.22]} rotation={[0, 1.31, 0]} scale={0.62}>
        <mesh geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.13, 0.2, -0.39]} rotation={[0, 0.15, 0]} scale={0.77}>
        <mesh geometry={nodes.Mesh_tree_2.geometry} material={materials.foliage} />
        <mesh geometry={nodes.Mesh_tree_3.geometry} material={materials.wood} />
      </group>
      <group position={[0, 0.2, 0]}>
        <mesh geometry={nodes.Mesh_wall.geometry} material={materials.stoneDark} />
        <mesh geometry={nodes.Mesh_wall_1.geometry} material={materials.stone} />
      </group>
    </group>
  )
}

useGLTF.preload('/building_wall.glb')
