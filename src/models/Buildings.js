import React from 'react'
import { useGLTF } from '@react-three/drei'

export const House = React.forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/models/unit_house.glb')
  return (
    <group scale={0.5} rotation={[0, 0.4, 0]} ref={ref} {...props} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.Mesh_unit_house.geometry} material={materials.roof} />
      <mesh castShadow receiveShadow geometry={nodes.Mesh_unit_house_1.geometry} material={materials.dirt} />
      <mesh castShadow receiveShadow geometry={nodes.Mesh_unit_house_2.geometry} material={materials.wood} />
    </group>
  )
});

useGLTF.preload('/models/unit_house.glb')