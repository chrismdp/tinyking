import React from 'react'
import { useGLTF } from '@react-three/drei'

import { WaterMaterial } from '../materials';

export const Water = React.forwardRef((props, ref) => {
  const { nodes } = useGLTF('/models/water.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh receiveShadow geometry={nodes.water.geometry}>
        <WaterMaterial/>
      </mesh>
    </group>
  )
});

export const Grass = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/grass.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_grass.geometry} material={materials.dirt} />
      <mesh receiveShadow geometry={nodes.Mesh_grass_1.geometry} material={materials.grass}>
      </mesh>
    </group>
  )
});

export const GrassForest = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/grass_forest.glb')
  return (
    <group ref={ref} {...props} dispose={null}>
      <mesh geometry={nodes.Mesh_grass_forest.geometry} material={materials.dirt} />
      <mesh receiveShadow geometry={nodes.Mesh_grass_forest_1.geometry} material={materials.grass} />
      <group position={[0.32, 0.2, -0.08]} rotation={[0, -0.26, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.29, 0.2, 0.21]} rotation={[0, -Math.PI / 6, 0]} scale={0.77}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.01, 0.2, 0.3]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[0.17, 0.2, -0.32]} rotation={[0, Math.PI / 6, 0]} scale={0.62}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.29, 0.2, -0.16]} rotation={[0, -0.66, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.3, 0.2, 0.19]} rotation={[0, -0.05, 0]} scale={0.62}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.04, 0.2, 0.01]} rotation={[0, 0.26, 0]} scale={0.77}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
      <group position={[-0.08, 0.2, -0.35]} rotation={[0, 0.15, 0]} scale={0.77}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_tree.geometry} material={materials.foliage} />
        <mesh castShadow geometry={nodes.Mesh_tree_1.geometry} material={materials.wood} />
      </group>
    </group>
  )
});

export const SelectTile = React.forwardRef(({ x, y, ...props }, ref) => {
  const { nodes } = useGLTF('/models/grass.glb')
  return (
    <group ref={ref} dispose={null} {...props}>
      <mesh geometry={nodes.Mesh_grass_1.geometry}>
        <meshPhongMaterial transparent opacity={0.1} color="gray"/>
      </mesh>
    </group>
  )
});

useGLTF.preload('/models/grass_forest.glb')
useGLTF.preload('/models/grass.glb')
useGLTF.preload('/models/water.glb')
