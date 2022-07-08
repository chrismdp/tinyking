import React from 'react'
import { useGLTF } from '@react-three/drei'

export const House = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/unit_house.glb')
  return (
    <group scale={1} ref={ref} {...props} dispose={null}>
      <group scale={0.5} position={[0, 0.2, 0]}>
        <mesh castShadow receiveShadow geometry={nodes.Mesh_unit_house.geometry} material={materials.roof} />
        <mesh castShadow receiveShadow geometry={nodes.Mesh_unit_house_1.geometry} material={materials.dirt} />
        <mesh castShadow receiveShadow geometry={nodes.Mesh_unit_house_2.geometry} material={materials.wood} />
      </group>
    </group>
  )
});

export const Campfire = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/building_house.glb')
  return (
    <group {...props} dispose={null}>
      <mesh geometry={nodes.path_1.geometry} material={materials.dirt} position={[0, 0.2, 0.06]} rotation={[0, -0.26, 0]} />
    </group>
  )
});

useGLTF.preload('/models/building_house.glb')
useGLTF.preload('/models/unit_house.glb')
